// Engine facade: pure TypeScript, no DOM. Used by the Web Worker and by Node tests.
import { Position, START_FEN } from '../chess/position';
import { Searcher, TranspositionTable, MATE_BOUND } from './search';
import { HumanPlayer, makeRng, HumanDecision, Candidate } from './human';
import { getLevel } from './levels';
import { getPersonality } from './personalities';
import { DEFAULT_WEIGHTS } from './eval';

export interface MoveRequest {
  startFen: string;
  moves: string[];      // UCI moves from startFen
  level: string;
  personality: string;
  seed: number;
  timeLeftMs?: number | null;
  incMs?: number;
  forcedUci?: string | null;
  bookPreferUcis?: string[];
  useBook?: boolean;
  bookUnlimited?: boolean;
  fastDelay?: boolean;
  /** colour the engine plays (used for draw offers); defaults to side to move */
  engineColor?: 0 | 1;
}

export interface AnalyzeRequest {
  startFen: string;
  moves: string[];
  maxDepth: number;
  timeMs: number;
  multiPV: number;
}

export interface AnalysisLine {
  uci: string; san: string; score: number; depth: number; pv: string[]; pvUci: string[];
}
export interface AnalysisResult {
  fen: string;
  depth: number;
  nodes: number;
  timeMs: number;
  lines: AnalysisLine[];
  /** side-to-move */
  turn: 0 | 1;
  gameOver: boolean;
}

export function buildPosition(startFen: string, moves: string[]): Position {
  const pos = Position.fromFen(startFen || START_FEN);
  for (const u of moves) {
    const m = pos.parseUci(u);
    if (m === null) throw new Error('Illegal move in history: ' + u);
    pos.make(m);
  }
  return pos;
}

export class EngineCore {
  private tt = new TranspositionTable();
  private searcher = new Searcher(this.tt);
  private human = new HumanPlayer(this.searcher);

  newGame() { this.tt.clear(); }

  chooseMove(req: MoveRequest): HumanDecision {
    const pos = buildPosition(req.startFen, req.moves);
    return this.human.decide({
      pos, level: getLevel(req.level), personality: getPersonality(req.personality), rng: makeRng(req.seed ^ (req.moves.length * 7919)),
      timeLeftMs: req.timeLeftMs, incMs: req.incMs, forcedUci: req.forcedUci, bookPreferUcis: req.bookPreferUcis, useBook: req.useBook, bookUnlimited: req.bookUnlimited, fastDelay: req.fastDelay,
    });
  }

  analyze(req: AnalyzeRequest, onProgress?: (r: AnalysisResult) => void): AnalysisResult {
    const pos = buildPosition(req.startFen, req.moves);
    this.searcher.weights = DEFAULT_WEIGHTS;
    const toLines = (lines: { move: number; score: number; depth: number; pv: number[] }[]): AnalysisLine[] => lines.map(l => {
      const q = pos.clone();
      const pvSan: string[] = [], pvUci: string[] = [];
      for (const m of l.pv) {
        const lg = q.legalMoves();
        if (!lg.includes(m)) break;
        pvSan.push(q.toSAN(m, lg)); pvUci.push(q.moveToUci(m)); q.make(m);
      }
      return { uci: pos.moveToUci(l.move), san: pvSan[0] ?? pos.toSAN(l.move), score: l.score, depth: l.depth, pv: pvSan, pvUci };
    });
    const turn = pos.turn;
    if (!pos.hasLegalMove()) {
      const score = pos.inCheck() ? -(MATE_BOUND + 1000) : 0;
      return { fen: pos.fen(), depth: 0, nodes: 0, timeMs: 0, lines: [], turn, gameOver: true, ...(score ? {} : {}) };
    }
    const res = this.searcher.search(pos, { maxDepth: req.maxDepth, softMs: req.timeMs, hardMs: req.timeMs * 1.6, multiPV: req.multiPV }, onProgress ? (info) => {
      onProgress({ fen: pos.fen(), depth: info.depth, nodes: info.nodes, timeMs: info.timeMs, lines: toLines(info.lines), turn, gameOver: false });
    } : undefined);
    return { fen: pos.fen(), depth: res.depth, nodes: res.nodes, timeMs: res.timeMs, lines: toLines(res.lines), turn, gameOver: false };
  }

  /** Decide whether the engine accepts a draw offer. */
  respondToDraw(req: MoveRequest): { accept: boolean; score: number; reason: string } {
    const pos = buildPosition(req.startFen, req.moves);
    const personality = getPersonality(req.personality);
    const level = getLevel(req.level);
    this.searcher.weights = personality.weights;
    const r = this.searcher.search(pos, { maxDepth: 6, softMs: 400, hardMs: 700, multiPV: 1 });
    const raw = r.lines[0]?.score ?? 0;
    const eng = req.engineColor ?? pos.turn;
    const score = pos.turn === eng ? raw : -raw; // engine's point of view
    // From the engine's perspective (it is to move when a draw is offered)
    const threshold = -60 + personality.risk * 90 * -1 + 20; // risky personalities hold out longer
    const equalish = Math.abs(score) < 35 && pos.fullmove >= 30;
    const worse = score <= threshold - (level.id === 'grandmaster' ? 40 : 0) && pos.fullmove >= 12;
    const accept = worse || equalish || (pos.repetitionCount() >= 1 && Math.abs(score) < 50);
    const reason = accept
      ? (worse ? 'I am slightly worse, I will take the draw.' : 'The position is balanced and has little left in it. Draw agreed.')
      : 'I think I have more chances than you in this position. Let us play on.';
    return { accept, score, reason };
  }
}

export type { HumanDecision, Candidate };
