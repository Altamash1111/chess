import {
  Position, typeOf, colorOf, mfrom, mto, mflags, mpromo, FLAG_CAPTURE, FLAG_CASTLE, FLAG_EP, sqName, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  KNIGHT_MOVES, KING_MOVES, PAWN_ATTACKS, DIAG_RAYS, ORTHO_RAYS, file, rank, mk,
} from '../chess/position';
import { see } from './search';
import { SEE_VALUE } from './eval';

export const PIECE_NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

export function relRank(sq: number, color: number) { return color === 0 ? sq >> 3 : 7 - (sq >> 3); }
export function cheb(a: number, b: number) { return Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3))); }

/** Squares attacked by the piece on `sq` given board occupancy. */
export function attacksFrom(pos: Position, sq: number): number[] {
  const p = pos.board[sq];
  if (!p) return [];
  const t = typeOf(p), c = colorOf(p), out: number[] = [];
  if (t === PAWN) return PAWN_ATTACKS[c][sq].slice();
  if (t === KNIGHT) return KNIGHT_MOVES[sq].slice();
  if (t === KING) return KING_MOVES[sq].slice();
  const rays = [...(t !== ROOK ? DIAG_RAYS[sq] : []), ...(t !== BISHOP ? ORTHO_RAYS[sq] : [])];
  for (const ray of rays) for (const s of ray) { out.push(s); if (pos.board[s]) break; }
  return out;
}

/** Pieces of the side that just moved that now attack valuable or undefended enemy pieces (after the move was made). */
export function threatsCreated(posAfter: Position, mover: number, movedSq: number): string[] {
  const res: string[] = [];
  const targets = attacksFrom(posAfter, movedSq);
  for (const s of targets) {
    const p = posAfter.board[s];
    if (!p || colorOf(p) === mover) continue;
    const t = typeOf(p);
    if (t === KING) continue;
    const mt = typeOf(posAfter.board[movedSq]);
    const defended = posAfter.isAttacked(s, 1 - mover);
    if (!defended || SEE_VALUE[t] > SEE_VALUE[mt] + 50) res.push(`${PIECE_NAME[t]} on ${sqName(s)}`);
  }
  return res;
}

/** Short human-readable description of the idea behind a move. */
export function describeMove(pos: Position, m: number): string {
  const b = pos.board;
  const from = mfrom(m), to = mto(m), flags = mflags(m);
  const piece = b[from], t = typeOf(piece), us = colorOf(piece);
  const parts: string[] = [];
  const full = pos.fullmove;
  if (flags & FLAG_CASTLE) {
    parts.push(to > from ? 'Castles kingside: the king goes to safety and the rook joins the game.' : 'Castles queenside: the king is tucked away and a rook lands on the d-file.');
  } else if (mpromo(m)) {
    parts.push(`Promotes the pawn to a ${PIECE_NAME[mpromo(m)]}${flags & FLAG_CAPTURE ? ' with capture' : ''}.`);
  } else if (flags & FLAG_CAPTURE) {
    const victim = (flags & FLAG_EP) ? PAWN : typeOf(b[to]);
    const s = see(pos, m);
    if (s >= SEE_VALUE[victim] - 30 && !pos.isAttacked(to, 1 - us)) parts.push(`Wins the ${PIECE_NAME[victim]} on ${sqName(to)} for free.`);
    else if (s > 60) parts.push(`Captures the ${PIECE_NAME[victim]} on ${sqName(to)}, winning material in the exchange.`);
    else if (Math.abs(s) <= 60) parts.push(`Trades the ${PIECE_NAME[t]} for the ${PIECE_NAME[victim]} on ${sqName(to)}.`);
    else parts.push(`Gives up material by capturing on ${sqName(to)} — a calculated sacrifice.`);
  } else if (t === PAWN) {
    const centre = [26, 27, 28, 35, 36, 37].includes(to) || [27, 28, 35, 36].includes(to);
    if (flags & 8 && (file(to) === 3 || file(to) === 4)) parts.push('Stakes a claim in the centre with a pawn.');
    else if (centre) parts.push('Pushes a pawn to gain central space.');
    else if (relRank(to, us) >= 5) parts.push('Advances a dangerous pawn deep into enemy territory.');
    else parts.push(`Pushes the ${'abcdefgh'[file(to)]}-pawn to ${sqName(to)}, gaining space.`);
  } else if (t === KNIGHT || t === BISHOP) {
    if (relRank(from, us) === 0 && full <= 14) parts.push(`Develops the ${PIECE_NAME[t]} to ${sqName(to)}.`);
    else if (t === KNIGHT && relRank(to, us) >= 3 && relRank(to, us) <= 5) parts.push(`Places the knight on the strong central square ${sqName(to)}.`);
    else parts.push(`Repositions the ${PIECE_NAME[t]} to ${sqName(to)}.`);
  } else if (t === ROOK) {
    let ownPawn = false;
    for (let r = 0; r < 8; r++) if (b[r * 8 + file(to)] === mk(PAWN, us)) ownPawn = true;
    parts.push(ownPawn ? `Activates the rook on ${sqName(to)}.` : `Places the rook on the open ${'abcdefgh'[file(to)]}-file.`);
  } else if (t === QUEEN) {
    parts.push(`Centralises the queen on ${sqName(to)}.`);
  } else if (t === KING) {
    parts.push(`Moves the king to ${sqName(to)}.`);
  }
  // consequences
  pos.make(m);
  const gives = pos.inCheck();
  let mate = false;
  if (gives) mate = !pos.hasLegalMove();
  const threats = mate ? [] : threatsCreated(pos, us, to);
  pos.unmake();
  if (mate) parts.push('It is checkmate!');
  else if (gives) parts.push('It comes with check.');
  if (threats.length && !mate) parts.push(`It also threatens the ${threats.slice(0, 2).join(' and the ')}.`);
  return parts.join(' ');
}

export type MoveClass = 'brilliant' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder' | 'miss';

export function winPercent(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

export function classifyLoss(winLoss: number): MoveClass {
  if (winLoss <= 0.5) return 'best';
  if (winLoss <= 2.5) return 'excellent';
  if (winLoss <= 6) return 'good';
  if (winLoss <= 12) return 'inaccuracy';
  if (winLoss <= 22) return 'mistake';
  return 'blunder';
}

export function accuracyFromLoss(avgWinLoss: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * avgWinLoss) - 3.1669));
}

export const CLASS_LABEL: Record<MoveClass, string> = {
  brilliant: 'Brilliant', best: 'Best', excellent: 'Excellent', good: 'Good', book: 'Book',
  inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder', miss: 'Missed win',
};

/** Explains why a played move was weaker than the engine's choice. */
export function explainReview(
  posBefore: Position, played: number, playedSan: string, bestMove: number | null, bestSan: string,
  cls: MoveClass, scoreBefore: number, scoreAfter: number, pvSan: string[],
): string {
  const us = posBefore.turn;
  const fmt = (cp: number) => Math.abs(cp) > 29000 ? 'a forced mate' : (cp / 100 > 0 ? '+' : '') + (cp / 100).toFixed(1);
  if (cls === 'best') return `${playedSan} is the engine's top choice. ${describeMove(posBefore, played)}`;
  if (cls === 'excellent' || cls === 'good') {
    return `${playedSan} is fine. ${describeMove(posBefore, played)}${bestMove !== null && bestMove !== played ? ` The engine slightly prefers ${bestSan}.` : ''}`;
  }
  if (cls === 'book') return `${playedSan} is a known opening move.`;
  // inaccuracy / mistake / blunder: find the reason
  const reasons: string[] = [];
  const after = posBefore.clone();
  after.make(played);
  // Did we hang something? Look for an enemy capture that wins material (SEE)
  const replies = after.legalMoves();
  let worst: { m: number; v: number } | null = null;
  for (const r of replies) {
    if (!(mflags(r) & FLAG_CAPTURE)) continue;
    const v = see(after, r);
    if (v >= 100 && (!worst || v > worst.v)) worst = { m: r, v };
  }
  if (worst) {
    const target = (mflags(worst.m) & FLAG_EP) ? PAWN : typeOf(after.board[mto(worst.m)]);
    reasons.push(`it allows ${after.toSAN(worst.m)}, winning a ${PIECE_NAME[target]}${after.board[mto(worst.m)] && typeOf(after.board[mto(worst.m)]) === target && target === typeOf(after.board[mto(worst.m)]) ? '' : ''}`);
  }
  // mate allowed?
  if (scoreAfter < -29000 && scoreBefore > -29000) reasons.push('it walks into a forced checkmate');
  // missed capture / mate
  if (bestMove !== null) {
    if (scoreBefore > 29000) reasons.push(`it misses a forced mate starting with ${bestSan}`);
    else if (mflags(bestMove) & FLAG_CAPTURE && see(posBefore, bestMove) >= 100 && !(mflags(played) & FLAG_CAPTURE)) {
      reasons.push(`it ignores the chance to win material with ${bestSan}`);
    } else if (posBefore.clone().inCheck()) { /* nothing */ }
  }
  void us;
  const head = cls === 'blunder' ? 'Blunder' : cls === 'mistake' ? 'Mistake' : 'Inaccuracy';
  let text = `${head}: ${playedSan} drops the evaluation from ${fmt(scoreBefore)} to ${fmt(scoreAfter)}`;
  text += reasons.length ? ` because ${reasons.join(' and ')}.` : '.';
  if (bestMove !== null) text += ` Better was ${bestSan}${pvSan.length > 1 ? ` (${pvSan.slice(0, 4).join(' ')})` : ''}.`;
  return text;
}

export function squareName(sq: number) { return sqName(sq); }
export { rank, KING, mk };
