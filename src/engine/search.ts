import {
  Position, typeOf, colorOf, mfrom, mto, mpromo, mflags, FLAG_CAPTURE, FLAG_EP, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  KNIGHT_MOVES, KING_MOVES, PAWN_ATTACKS, DIAG_RAYS, ORTHO_RAYS, mk,
} from '../chess/position';
import { evaluate, EvalWeights, DEFAULT_WEIGHTS, SEE_VALUE } from './eval';

export const MATE = 30000;
export const MATE_BOUND = MATE - 500;
const INF = 32000;

/** Static exchange evaluation of a move (centipawns, from mover's view). */
export function see(pos: Position, m: number): number {
  const b = pos.board;
  const from = mfrom(m), to = mto(m);
  const flags = mflags(m);
  const us = pos.turn;
  const gain: number[] = [];
  let captured = (flags & FLAG_EP) ? PAWN : typeOf(b[to]);
  let piece = typeOf(b[from]);
  const promo = mpromo(m);
  gain[0] = (captured ? SEE_VALUE[captured] : 0) + (promo ? SEE_VALUE[promo] - SEE_VALUE[PAWN] : 0);
  if (promo) piece = promo;
  // temporarily alter board
  const saved: [number, number][] = [[from, b[from]], [to, b[to]]];
  let epSq = -1;
  if (flags & FLAG_EP) { epSq = us === 0 ? to - 8 : to + 8; saved.push([epSq, b[epSq]]); b[epSq] = 0; }
  b[from] = 0;
  b[to] = mk(piece, us);
  let side = 1 - us;
  let d = 0;
  const lva = (color: number): number => {
    // returns square of least valuable attacker of `to` for color, or -1
    for (const s of PAWN_ATTACKS[1 - color][to]) if (b[s] === mk(PAWN, color)) return s;
    for (const s of KNIGHT_MOVES[to]) if (b[s] === mk(KNIGHT, color)) return s;
    let best = -1, bestT = 99;
    for (const ray of DIAG_RAYS[to]) {
      for (const s of ray) {
        const p = b[s];
        if (p) { if (colorOf(p) === color) { const t = typeOf(p); if ((t === BISHOP || t === QUEEN) && t < bestT) { best = s; bestT = t; } } break; }
      }
    }
    if (bestT === BISHOP) return best;
    for (const ray of ORTHO_RAYS[to]) {
      for (const s of ray) {
        const p = b[s];
        if (p) { if (colorOf(p) === color) { const t = typeOf(p); if ((t === ROOK || t === QUEEN) && t < bestT) { best = s; bestT = t; } } break; }
      }
    }
    if (best >= 0) return best;
    for (const s of KING_MOVES[to]) if (b[s] === mk(KING, color)) return s;
    return -1;
  };
  // swap-off
  const removed: [number, number][] = [];
  while (true) {
    const s = lva(side);
    if (s < 0) break;
    d++;
    gain[d] = SEE_VALUE[piece] - gain[d - 1];
    const attacker = typeOf(b[s]);
    // king can't capture into defended square: if attacker is king and other side still attacks, stop
    if (attacker === KING) {
      const other = lva(1 - side);
      if (other >= 0) { d--; break; }
    }
    removed.push([s, b[s]]);
    b[s] = 0;
    piece = attacker;
    side = 1 - side;
    if (d > 30) break;
  }
  while (--d > 0) gain[d - 1] = -Math.max(-gain[d - 1], gain[d]);
  // restore
  for (const [s, p] of removed.reverse()) b[s] = p;
  for (const [s, p] of saved.reverse()) b[s] = p;
  return gain[0];
}

// ---------- Transposition table ----------
const TT_BITS = 20;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2;

export class TranspositionTable {
  hi = new Int32Array(TT_SIZE);
  move = new Int32Array(TT_SIZE);
  score = new Int16Array(TT_SIZE);
  depth = new Int8Array(TT_SIZE);
  flag = new Uint8Array(TT_SIZE);
  clear() { this.hi.fill(0); this.move.fill(0); this.score.fill(0); this.depth.fill(0); this.flag.fill(0); }
}

export interface SearchLimits {
  maxDepth: number;
  softMs: number;   // do not start a new iteration after this
  hardMs: number;   // abort search after this
  maxNodes?: number;
  multiPV?: number;
}

export interface RootLine {
  move: number;
  score: number; // cp from side-to-move view
  depth: number;
  pv: number[];
}

export interface SearchResult {
  lines: RootLine[];
  depth: number;
  nodes: number;
  timeMs: number;
  bestMove: number;
}

export type ProgressFn = (info: { depth: number; lines: RootLine[]; nodes: number; timeMs: number }) => void;

const MAX_PLY = 96;

export class Searcher {
  pos!: Position;
  tt: TranspositionTable;
  weights: EvalWeights = DEFAULT_WEIGHTS;
  nodes = 0;
  private stopped = false;
  private startTime = 0;
  private hardMs = 0;
  private maxNodes = Infinity;
  private killers: Int32Array = new Int32Array(MAX_PLY * 2);
  private history: Int32Array = new Int32Array(2 * 64 * 64);
  private pvTable: number[][] = [];
  private pvLen: number[] = [];
  private excluded: number[] = [];
  private rootMoves: number[] = [];
  /** Optional moves to be ignored at the root (used to avoid repetition etc.). */
  rootAvoid: number[] = [];

  constructor(tt?: TranspositionTable) {
    this.tt = tt ?? new TranspositionTable();
    for (let i = 0; i < MAX_PLY + 2; i++) this.pvTable.push(new Array(MAX_PLY).fill(0));
    this.pvLen = new Array(MAX_PLY + 2).fill(0);
  }

  private elapsed() { return Date.now() - this.startTime; }

  private checkStop() {
    if ((this.nodes & 2047) === 0) {
      if (this.elapsed() >= this.hardMs || this.nodes >= this.maxNodes) this.stopped = true;
    }
  }

  search(pos: Position, limits: SearchLimits, onProgress?: ProgressFn): SearchResult {
    this.pos = pos;
    this.nodes = 0;
    this.stopped = false;
    this.startTime = Date.now();
    this.hardMs = limits.hardMs;
    this.maxNodes = limits.maxNodes ?? Infinity;
    this.killers.fill(0);
    this.history.fill(0);
    const multiPV = Math.max(1, limits.multiPV ?? 1);

    const root = pos.legalMoves().filter(m => !this.rootAvoid.includes(m));
    const all = root.length ? root : pos.legalMoves();
    this.rootMoves = all;
    if (all.length === 0) return { lines: [], depth: 0, nodes: 0, timeMs: 0, bestMove: 0 };
    if (all.length === 1) {
      return { lines: [{ move: all[0], score: 0, depth: 0, pv: [all[0]] }], depth: 0, nodes: 0, timeMs: 0, bestMove: all[0] };
    }
    const nLines = Math.min(multiPV, all.length);
    let completed: RootLine[] = [];
    let completedDepth = 0;
    const prevScores: number[] = new Array(nLines).fill(0);

    for (let depth = 1; depth <= limits.maxDepth; depth++) {
      this.excluded = [];
      const lines: RootLine[] = [];
      let aborted = false;
      for (let li = 0; li < nLines; li++) {
        let alpha = -INF, beta = INF;
        let window = 30;
        if (depth >= 5 && Math.abs(prevScores[li]) < MATE_BOUND) { alpha = prevScores[li] - window; beta = prevScores[li] + window; }
        let score = 0;
        while (true) {
          score = this.negamax(depth, alpha, beta, 0, true);
          if (this.stopped) break;
          if (score <= alpha && alpha > -INF) { window *= 3; alpha = Math.max(-INF, score - window); continue; }
          if (score >= beta && beta < INF) { window *= 3; beta = Math.min(INF, score + window); continue; }
          break;
        }
        if (this.stopped && depth > 1) { aborted = true; break; }
        const pv = this.pvTable[0].slice(0, this.pvLen[0]);
        if (!pv.length) { aborted = true; break; }
        lines.push({ move: pv[0], score, depth, pv });
        prevScores[li] = score;
        this.excluded.push(pv[0]);
      }
      if (aborted) break;
      completed = lines;
      completedDepth = depth;
      if (onProgress) onProgress({ depth, lines, nodes: this.nodes, timeMs: this.elapsed() });
      // stop early on forced mate found
      if (Math.abs(lines[0].score) > MATE_BOUND && depth >= 4 && nLines === 1) break;
      if (this.elapsed() >= limits.softMs) break;
      // Avoid starting an iteration unlikely to finish: heuristic (typically ~3x cost)
      if (depth >= 4 && this.elapsed() * 2.6 > limits.softMs && limits.softMs < limits.hardMs) { /* allow if still within soft */ }
    }
    if (!completed.length) {
      completed = [{ move: all[0], score: 0, depth: 0, pv: [all[0]] }];
    }
    return { lines: completed, depth: completedDepth, nodes: this.nodes, timeMs: this.elapsed(), bestMove: completed[0].move };
  }

  private isDraw(ply: number): boolean {
    const p = this.pos;
    if (p.halfmove >= 100) return true;
    if (p.insufficientMaterial()) return true;
    // repetition: any previous occurrence in search path or game counts as draw
    if (p.repetitionCount() >= 1 && ply > 0) return true;
    if (p.repetitionCount() >= 2) return true;
    return false;
  }

  private hasNonPawnMaterial(color: number): boolean {
    const b = this.pos.board;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (p && colorOf(p) === color) { const t = typeOf(p); if (t !== PAWN && t !== KING) return true; }
    }
    return false;
  }

  private scoreMoves(moves: number[], ttMove: number, ply: number): number[] {
    const pos = this.pos, b = pos.board;
    const scores = new Array(moves.length);
    const us = pos.turn;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (m === ttMove) { scores[i] = 10_000_000; continue; }
      const flags = mflags(m);
      if (flags & FLAG_CAPTURE) {
        const victim = (flags & FLAG_EP) ? PAWN : typeOf(b[mto(m)]);
        const attacker = typeOf(b[mfrom(m)]);
        const s = SEE_VALUE[victim] * 10 - SEE_VALUE[attacker] / 10 + (mpromo(m) ? 800 : 0);
        scores[i] = (SEE_VALUE[victim] >= SEE_VALUE[attacker] ? 2_000_000 : (see(pos, m) >= 0 ? 2_000_000 : 100_000)) + s;
      } else if (mpromo(m)) {
        scores[i] = mpromo(m) === QUEEN ? 1_900_000 : 50_000;
      } else if (m === this.killers[ply * 2]) scores[i] = 900_000;
      else if (m === this.killers[ply * 2 + 1]) scores[i] = 800_000;
      else scores[i] = this.history[us * 4096 + mfrom(m) * 64 + mto(m)];
    }
    return scores;
  }

  private pickBest(moves: number[], scores: number[], start: number) {
    let bi = start, bs = scores[start];
    for (let i = start + 1; i < moves.length; i++) if (scores[i] > bs) { bs = scores[i]; bi = i; }
    if (bi !== start) {
      const tm = moves[start]; moves[start] = moves[bi]; moves[bi] = tm;
      const ts = scores[start]; scores[start] = scores[bi]; scores[bi] = ts;
    }
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const pos = this.pos;
    this.pvLen[ply] = 0;
    this.checkStop();
    if (this.stopped) return 0;
    this.nodes++;

    const inCheck = pos.inCheck();
    if (ply >= MAX_PLY - 1) return evaluate(pos, this.weights);
    if (ply > 0 && this.isDraw(ply)) return 0;

    // mate distance pruning
    alpha = Math.max(alpha, -MATE + ply);
    beta = Math.min(beta, MATE - ply - 1);
    if (alpha >= beta) return alpha;

    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply, 0);

    const isPV = beta - alpha > 1;
    const idx = pos.hashLo & TT_MASK;
    let ttMove = 0;
    const tt = this.tt;
    if (tt.hi[idx] === pos.hashHi && tt.hi[idx] !== 0) {
      ttMove = tt.move[idx];
      if (ply > 0 && tt.depth[idx] >= depth && !isPV) {
        let s = tt.score[idx];
        if (s > MATE_BOUND) s -= ply; else if (s < -MATE_BOUND) s += ply;
        const f = tt.flag[idx];
        if (f === TT_EXACT) return s;
        if (f === TT_LOWER && s >= beta) return s;
        if (f === TT_UPPER && s <= alpha) return s;
      }
    }

    let staticEval = 0;
    if (!inCheck && (depth <= 4 || (allowNull && depth >= 3))) staticEval = evaluate(pos, this.weights);

    if (!isPV && !inCheck && Math.abs(beta) < MATE_BOUND) {
      // reverse futility
      if (depth <= 4 && staticEval - 110 * depth >= beta) return staticEval - 110 * depth;
      // null move
      if (allowNull && depth >= 3 && staticEval >= beta && this.hasNonPawnMaterial(pos.turn)) {
        const R = 2 + (depth >= 6 ? 1 : 0) + (staticEval - beta > 200 ? 1 : 0);
        pos.makeNull();
        const s = -this.negamax(depth - 1 - R, -beta, -beta + 1, ply + 1, false);
        pos.unmakeNull();
        if (this.stopped) return 0;
        if (s >= beta) return s >= MATE_BOUND ? beta : s;
      }
    }

    // internal iterative reduction
    if (isPV && !ttMove && depth >= 5) depth--;

    let moves: number[];
    if (ply === 0) moves = this.rootMoves.filter(m => !this.excluded.includes(m));
    else {
      moves = [];
      pos.genPseudo(moves);
    }
    const scores = this.scoreMoves(moves, ply === 0 && this.pvTable[0][0] ? ttMove : ttMove, ply);
    let best = -INF, bestMove = 0, legalCount = 0;
    const origAlpha = alpha;
    const us = pos.turn;
    const quiets: number[] = [];

    for (let i = 0; i < moves.length; i++) {
      this.pickBest(moves, scores, i);
      const m = moves[i];
      const isCap = (mflags(m) & FLAG_CAPTURE) !== 0;
      const isPromo = mpromo(m) !== 0;
      pos.make(m);
      if (pos.isAttacked(pos.king[us], 1 - us)) { pos.unmake(); continue; }
      legalCount++;
      const givesCheck = pos.inCheck();
      let score: number;

      // futility pruning for quiet moves at low depth
      if (!isPV && !inCheck && !givesCheck && !isCap && !isPromo && depth <= 3 && legalCount > 1 && Math.abs(alpha) < MATE_BOUND) {
        if (staticEval + 90 + 100 * depth <= alpha) { pos.unmake(); continue; }
      }
      // late move pruning
      if (!isPV && !inCheck && !givesCheck && !isCap && !isPromo && depth <= 3 && legalCount > 6 + depth * 4 && Math.abs(alpha) < MATE_BOUND) {
        pos.unmake(); continue;
      }

      if (legalCount === 1) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        let R = 0;
        if (depth >= 3 && legalCount > 3 && !isCap && !isPromo && !inCheck && !givesCheck) {
          R = 1 + (legalCount > 8 ? 1 : 0) + (depth > 7 ? 1 : 0);
          if (isPV) R = Math.max(0, R - 1);
          if (m === this.killers[ply * 2] || m === this.killers[ply * 2 + 1]) R = Math.max(0, R - 1);
        }
        score = -this.negamax(depth - 1 - R, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && R > 0) score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (!isCap && !isPromo) quiets.push(m);

      if (score > best) {
        best = score; bestMove = m;
        if (score > alpha) {
          alpha = score;
          // update PV
          this.pvTable[ply][0] = m;
          const childLen = this.pvLen[ply + 1];
          for (let k = 0; k < childLen; k++) this.pvTable[ply][k + 1] = this.pvTable[ply + 1][k];
          this.pvLen[ply] = childLen + 1;
          if (alpha >= beta) {
            if (!isCap && !isPromo) {
              if (this.killers[ply * 2] !== m) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = m; }
              const bonus = depth * depth;
              this.history[us * 4096 + mfrom(m) * 64 + mto(m)] += bonus;
              for (const q of quiets) if (q !== m) this.history[us * 4096 + mfrom(q) * 64 + mto(q)] -= bonus;
              if (this.history[us * 4096 + mfrom(m) * 64 + mto(m)] > 1_000_000) this.history.forEach((_, i2, arr) => { arr[i2] >>= 1; });
            }
            break;
          }
        }
      }
    }

    if (legalCount === 0) return inCheck ? -MATE + ply : 0;

    // store
    if (!this.stopped) {
      const flag = best >= beta ? TT_LOWER : (best > origAlpha ? TT_EXACT : TT_UPPER);
      let s = best;
      if (s > MATE_BOUND) s += ply; else if (s < -MATE_BOUND) s -= ply;
      if (tt.hi[idx] !== pos.hashHi || tt.depth[idx] <= depth) {
        tt.hi[idx] = pos.hashHi; tt.move[idx] = bestMove || ttMove; tt.score[idx] = s; tt.depth[idx] = depth; tt.flag[idx] = flag;
      }
    }
    return best;
  }

  private quiesce(alpha: number, beta: number, ply: number, qd: number): number {
    const pos = this.pos;
    this.checkStop();
    if (this.stopped) return 0;
    this.nodes++;
    this.pvLen[ply] = 0;
    if (ply >= MAX_PLY - 1) return evaluate(pos, this.weights);
    const inCheck = pos.inCheck();
    let standPat = -INF;
    if (!inCheck) {
      standPat = evaluate(pos, this.weights);
      if (standPat >= beta) return standPat;
      if (standPat > alpha) alpha = standPat;
      // delta pruning
      if (standPat + 1000 < alpha) return alpha;
    }
    const moves: number[] = [];
    const evasions = inCheck && qd < 3;
    pos.genPseudo(moves, !evasions);
    const scores = this.scoreMoves(moves, 0, ply);
    let best = inCheck ? -INF : standPat;
    const us = pos.turn;
    let legal = 0;
    for (let i = 0; i < moves.length; i++) {
      this.pickBest(moves, scores, i);
      const m = moves[i];
      if (!inCheck) {
        const flags = mflags(m);
        if ((flags & FLAG_CAPTURE) && !mpromo(m)) {
          const victim = (flags & FLAG_EP) ? PAWN : typeOf(pos.board[mto(m)]);
          if (standPat + SEE_VALUE[victim] + 200 < alpha) continue;
          if (see(pos, m) < 0) continue;
        }
      }
      pos.make(m);
      if (pos.isAttacked(pos.king[us], 1 - us)) { pos.unmake(); continue; }
      legal++;
      const s = -this.quiesce(-beta, -alpha, ply + 1, qd + 1);
      pos.unmake();
      if (this.stopped) return 0;
      if (s > best) {
        best = s;
        if (s > alpha) { alpha = s; if (alpha >= beta) break; }
      }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    if (inCheck && !evasions) return evaluate(pos, this.weights);
    return best;
  }

  /** Quiescence value of the current position from side-to-move view (used by the human layer). */
  quiescenceScore(pos: Position): number {
    this.pos = pos;
    this.stopped = false;
    this.startTime = Date.now();
    this.hardMs = 1e9;
    this.nodes = 1;
    return this.quiesce(-INF, INF, 0, 0);
  }
}

export function formatScore(cp: number): string {
  if (Math.abs(cp) > MATE_BOUND) {
    const n = Math.ceil((MATE - Math.abs(cp)) / 2);
    return (cp > 0 ? '+' : '-') + 'M' + n;
  }
  const v = (cp / 100).toFixed(2);
  return (cp > 0 ? '+' : '') + v;
}
