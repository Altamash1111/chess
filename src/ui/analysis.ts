import { Position } from '../chess/position';
import { EngineClient, Pending } from '../engine/client';
import type { AnalysisLine, AnalysisResult } from '../engine/core';
import { winPercent, classifyLoss, accuracyFromLoss, explainReview, MoveClass } from '../engine/explain';
import { bookMoves } from '../engine/book';
import { MATE_BOUND } from '../engine/search';
import type { GameController } from './controller';

export interface ReviewMove {
  ply: number;            // 1-based
  color: 0 | 1;
  san: string;
  uci: string;
  cls: MoveClass;
  winLoss: number;
  evalBefore: number;     // cp, mover's view
  evalAfter: number;      // cp, mover's view
  bestSan: string;
  bestUci: string;
  text: string;
}
export interface ReviewState {
  status: 'idle' | 'running' | 'done' | 'error';
  progress: number;
  evalsWhite: number[];   // cp from White's view at each position 0..n (clamped to +-1500 for the graph)
  moves: ReviewMove[];
  accuracy: [number, number];
  counts: [Record<string, number>, Record<string, number>];
  error?: string;
}

export const emptyReview = (): ReviewState => ({ status: 'idle', progress: 0, evalsWhite: [], moves: [], accuracy: [0, 0], counts: [{}, {}] });

/** Continuous analysis + full-game review, run in its own worker so it never disturbs the playing engine. */
export class AnalysisManager {
  client = new EngineClient();
  on = false;
  lines: AnalysisLine[] = [];
  depth = 0;
  fen = '';
  turn: 0 | 1 = 0;
  running = false;
  gameOver = false;
  review: ReviewState = emptyReview();
  private token = 0;
  private pending: Pending<AnalysisResult> | null = null;
  private reviewPending: Pending<AnalysisResult[]> | null = null;
  maxTimeMs = 20000;
  multiPV = 3;

  constructor(private ctl: GameController) {}

  setOn(on: boolean) {
    this.on = on;
    if (on) this.refresh(); else this.stop();
    this.ctl.emit();
  }

  stop() {
    this.token++;
    this.pending?.cancel(); this.pending = null;
    this.running = false;
    this.lines = []; this.depth = 0;
  }

  /** Restart analysis for the currently viewed position. */
  refresh() {
    if (!this.on) return;
    this.token++;
    const my = this.token;
    this.pending?.cancel(); this.pending = null;
    const pos = this.ctl.viewPos;
    const idx = this.ctl.viewIndex;
    this.fen = pos.fen();
    this.turn = pos.turn;
    this.lines = []; this.depth = 0;
    if (!pos.hasLegalMove()) { this.running = false; this.gameOver = true; this.lines = []; this.ctl.emit(); return; }
    this.gameOver = false;
    this.running = true;
    const p = this.client.analyze({
      startFen: this.ctl.game.startFen,
      moves: this.ctl.uciHistory().slice(0, idx),
      maxDepth: 40, timeMs: this.maxTimeMs, multiPV: this.multiPV,
    }, (r) => { if (my === this.token) { this.lines = r.lines; this.depth = r.depth; this.ctl.emit(); } });
    this.pending = p;
    p.promise.then(r => { if (my === this.token) { this.lines = r.lines; this.depth = r.depth; this.running = false; this.ctl.emit(); } }).catch(() => { /* cancelled */ });
  }

  /** Evaluation in centipawns from White's point of view (null if unknown). */
  evalWhite(): number | null {
    if (this.gameOver) {
      const pos = this.ctl.viewPos;
      if (pos.inCheck()) return pos.turn === 0 ? -30000 : 30000;
      return 0;
    }
    if (!this.lines.length) return null;
    const s = this.lines[0].score;
    return this.turn === 0 ? s : -s;
  }

  // ---------- review ----------
  cancelReview() { this.reviewPending?.cancel(); this.reviewPending = null; if (this.review.status === 'running') this.review = emptyReview(); this.ctl.emit(); }

  async runReview(depth = 9, timeMs = 600) {
    const g = this.ctl.game;
    if (!g.plies.length) { this.review = { ...emptyReview(), status: 'error', error: 'There are no moves to review yet.' }; this.ctl.emit(); return; }
    const ucis = this.ctl.uciHistory();
    this.review = { ...emptyReview(), status: 'running' };
    this.ctl.emit();
    this.reviewPending?.cancel();
    const pend = this.client.review(g.startFen, ucis, depth, timeMs, (p) => {
      this.review = { ...this.review, progress: (p.index + 1) / p.total };
      this.ctl.emit();
    });
    this.reviewPending = pend;
    try {
      const results = await pend.promise;
      this.review = this.buildReview(results);
      this.ctl.goTo(0);
    } catch (e: any) {
      if (String(e?.message) === 'cancelled') return;
      this.review = { ...emptyReview(), status: 'error', error: String(e?.message ?? e) };
    }
    this.reviewPending = null;
    this.ctl.emit();
  }

  private buildReview(results: AnalysisResult[]): ReviewState {
    const g = this.ctl.game;
    const n = g.plies.length;
    // stm-view score at each position
    const stm: number[] = results.map((r) => {
      if (r.gameOver || !r.lines.length) {
        const pos = Position.fromFen(r.fen);
        return pos.inCheck() ? -(MATE_BOUND + 1000) : 0;
      }
      return r.lines[0].score;
    });
    const evalsWhite = results.map((r, i) => { const s = stm[i]; return (r.turn === 0 ? s : -s); });
    const moves: ReviewMove[] = [];
    const wl: number[][] = [[], []];
    const counts: [Record<string, number>, Record<string, number>] = [{}, {}];
    for (let i = 0; i < n; i++) {
      const ply = g.plies[i];
      const posBefore = g.positionAt(i);
      const mover = posBefore.turn;
      const uci = posBefore.moveToUci(ply.move);
      const best = results[i].lines[0];
      const bestScore = stm[i];
      const afterScore = -stm[i + 1];
      let loss = Math.max(0, winPercent(bestScore) - winPercent(afterScore));
      if (best && best.uci === uci) loss = 0;
      let cls: MoveClass = classifyLoss(loss);
      const bookHit = bookMoves(posBefore).some(b => b.uci === uci);
      if (bookHit && loss < 8) cls = 'book';
      const bestMove = best ? posBefore.parseUci(best.uci) : null;
      const text = explainReview(posBefore, ply.move, ply.san, bestMove, best?.san ?? '', cls, bestScore, afterScore, best?.pv ?? []);
      moves.push({ ply: i + 1, color: mover, san: ply.san, uci, cls, winLoss: loss, evalBefore: bestScore, evalAfter: afterScore, bestSan: best?.san ?? '', bestUci: best?.uci ?? '', text });
      wl[mover].push(loss);
      counts[mover][cls] = (counts[mover][cls] ?? 0) + 1;
    }
    const acc = (a: number[]) => a.length ? accuracyFromLoss(a.reduce((x, y) => x + y, 0) / a.length) : 100;
    return { status: 'done', progress: 1, evalsWhite, moves, accuracy: [acc(wl[0]), acc(wl[1])], counts };
  }

  dispose() { this.stop(); this.reviewPending?.cancel(); this.client.dispose(); }
}
