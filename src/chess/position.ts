// Original chess rules core: board representation, legal move generation,
// make/unmake, FEN, SAN. No external dependencies; usable in a Web Worker or Node.

export const WHITE = 0;
export const BLACK = 1;
export type Color = 0 | 1;

export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;

// piece = type | (color << 3)
export const mk = (type: number, color: number) => type | (color << 3);
export const typeOf = (p: number) => p & 7;
export const colorOf = (p: number) => p >> 3;

export const FLAG_CAPTURE = 1, FLAG_EP = 2, FLAG_CASTLE = 4, FLAG_DOUBLE = 8;

// Move encoding: from | to<<6 | promo<<12 | flags<<15
export const mfrom = (m: number) => m & 63;
export const mto = (m: number) => (m >> 6) & 63;
export const mpromo = (m: number) => (m >> 12) & 7;
export const mflags = (m: number) => (m >> 15) & 15;
export const makeMove = (from: number, to: number, promo = 0, flags = 0) =>
  from | (to << 6) | (promo << 12) | (flags << 15);

export const file = (sq: number) => sq & 7;
export const rank = (sq: number) => sq >> 3;
export const sqName = (sq: number) => 'abcdefgh'[sq & 7] + (1 + (sq >> 3));
export const sqFromName = (s: string) => (s.charCodeAt(0) - 97) + (s.charCodeAt(1) - 49) * 8;

export const CASTLE_WK = 1, CASTLE_WQ = 2, CASTLE_BK = 4, CASTLE_BQ = 8;

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECE_CHARS = ' pnbrqk';

export function pieceChar(p: number): string {
  const c = PIECE_CHARS[typeOf(p)];
  return colorOf(p) === WHITE ? c.toUpperCase() : c;
}

// ---------- Precomputed tables ----------
const KNIGHT_DELTAS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_DELTAS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIAG_DIRS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const ORTHO_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export const KNIGHT_MOVES: number[][] = [];
export const KING_MOVES: number[][] = [];
export const PAWN_ATTACKS: number[][][] = [[], []]; // [color][sq] -> squares attacked by pawn of color at sq
export const DIAG_RAYS: number[][][] = []; // [sq][dir] -> list of squares
export const ORTHO_RAYS: number[][][] = [];

(function init() {
  for (let sq = 0; sq < 64; sq++) {
    const f = sq & 7, r = sq >> 3;
    const knights: number[] = [], kings: number[] = [];
    for (const [df, dr] of KNIGHT_DELTAS) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) knights.push(nr * 8 + nf);
    }
    for (const [df, dr] of KING_DELTAS) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) kings.push(nr * 8 + nf);
    }
    KNIGHT_MOVES[sq] = knights;
    KING_MOVES[sq] = kings;
    for (const c of [0, 1]) {
      const dr = c === WHITE ? 1 : -1;
      const t: number[] = [];
      for (const df of [-1, 1]) {
        const nf = f + df, nr = r + dr;
        if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) t.push(nr * 8 + nf);
      }
      PAWN_ATTACKS[c][sq] = t;
    }
    const mkRays = (dirs: number[][]) => dirs.map(([df, dr]) => {
      const out: number[] = [];
      let nf = f + df, nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) { out.push(nr * 8 + nf); nf += df; nr += dr; }
      return out;
    });
    DIAG_RAYS[sq] = mkRays(DIAG_DIRS);
    ORTHO_RAYS[sq] = mkRays(ORTHO_DIRS);
  }
})();

// Castling rights lost when a piece moves from/to these squares.
const CASTLE_MASK = new Int8Array(64).fill(15);
CASTLE_MASK[0] = 15 & ~CASTLE_WQ;
CASTLE_MASK[7] = 15 & ~CASTLE_WK;
CASTLE_MASK[4] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[56] = 15 & ~CASTLE_BQ;
CASTLE_MASK[63] = 15 & ~CASTLE_BK;
CASTLE_MASK[60] = 15 & ~(CASTLE_BK | CASTLE_BQ);

// ---------- Zobrist ----------
let seed = 0x9e3779b9;
function rnd32(): number {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return seed | 0;
}
const Z_PIECE_LO = new Int32Array(16 * 64), Z_PIECE_HI = new Int32Array(16 * 64);
const Z_CASTLE_LO = new Int32Array(16), Z_CASTLE_HI = new Int32Array(16);
const Z_EP_LO = new Int32Array(8), Z_EP_HI = new Int32Array(8);
const Z_SIDE_LO = rnd32(), Z_SIDE_HI = rnd32();
for (let i = 0; i < 16 * 64; i++) { Z_PIECE_LO[i] = rnd32(); Z_PIECE_HI[i] = rnd32(); }
for (let i = 0; i < 16; i++) { Z_CASTLE_LO[i] = rnd32(); Z_CASTLE_HI[i] = rnd32(); }
for (let i = 0; i < 8; i++) { Z_EP_LO[i] = rnd32(); Z_EP_HI[i] = rnd32(); }

export class Position {
  board = new Int8Array(64);
  turn: Color = WHITE;
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  king: [number, number] = [4, 60];
  hashLo = 0;
  hashHi = 0;

  // undo stacks
  private uMove: number[] = [];
  private uCap: number[] = [];
  private uCastle: number[] = [];
  private uEp: number[] = [];
  private uHalf: number[] = [];
  private uLo: number[] = [];
  private uHi: number[] = [];

  get ply() { return this.uMove.length; }
  get lastMove() { return this.uMove.length ? this.uMove[this.uMove.length - 1] : 0; }

  static fromFen(fen: string): Position {
    const p = new Position();
    p.setFen(fen);
    return p;
  }

  clone(): Position {
    const p = new Position();
    p.board.set(this.board);
    p.turn = this.turn; p.castling = this.castling; p.ep = this.ep;
    p.halfmove = this.halfmove; p.fullmove = this.fullmove;
    p.king = [this.king[0], this.king[1]];
    p.hashLo = this.hashLo; p.hashHi = this.hashHi;
    return p;
  }

  setFen(fen: string): void {
    const err = validateFen(fen);
    if (err) throw new Error(err);
    const parts = fen.trim().split(/\s+/);
    this.board.fill(0);
    const rows = parts[0].split('/');
    for (let i = 0; i < 8; i++) {
      const r = 7 - i;
      let f = 0;
      for (const ch of rows[i]) {
        if (ch >= '1' && ch <= '8') f += +ch;
        else {
          const lower = ch.toLowerCase();
          const t = PIECE_CHARS.indexOf(lower);
          const c = ch === lower ? BLACK : WHITE;
          this.board[r * 8 + f] = mk(t, c);
          if (t === KING) this.king[c] = r * 8 + f;
          f++;
        }
      }
    }
    this.turn = parts[1] === 'b' ? BLACK : WHITE;
    this.castling = 0;
    for (const ch of parts[2] ?? '-') {
      if (ch === 'K') this.castling |= CASTLE_WK;
      if (ch === 'Q') this.castling |= CASTLE_WQ;
      if (ch === 'k') this.castling |= CASTLE_BK;
      if (ch === 'q') this.castling |= CASTLE_BQ;
    }
    // Drop castling rights that are impossible given piece placement
    if (this.board[4] !== mk(KING, WHITE)) this.castling &= ~(CASTLE_WK | CASTLE_WQ);
    if (this.board[60] !== mk(KING, BLACK)) this.castling &= ~(CASTLE_BK | CASTLE_BQ);
    if (this.board[7] !== mk(ROOK, WHITE)) this.castling &= ~CASTLE_WK;
    if (this.board[0] !== mk(ROOK, WHITE)) this.castling &= ~CASTLE_WQ;
    if (this.board[63] !== mk(ROOK, BLACK)) this.castling &= ~CASTLE_BK;
    if (this.board[56] !== mk(ROOK, BLACK)) this.castling &= ~CASTLE_BQ;
    this.ep = parts[3] && parts[3] !== '-' ? sqFromName(parts[3]) : -1;
    this.halfmove = parts[4] ? parseInt(parts[4], 10) || 0 : 0;
    this.fullmove = parts[5] ? parseInt(parts[5], 10) || 1 : 1;
    // Only keep an en-passant square if a pawn can actually capture there.
    if (this.ep >= 0 && !this.epCapturePossible()) this.ep = -1;
    this.uMove = []; this.uCap = []; this.uCastle = []; this.uEp = []; this.uHalf = []; this.uLo = []; this.uHi = [];
    this.computeHash();
  }

  private epCapturePossible(): boolean {
    if (this.ep < 0) return false;
    const us = this.turn;
    const pawn = mk(PAWN, us);
    // squares from which a pawn of `us` attacks ep square
    for (const s of PAWN_ATTACKS[1 - us][this.ep]) if (this.board[s] === pawn) return true;
    return false;
  }

  fen(): string {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 8 + f];
        if (!p) empty++;
        else { if (empty) { s += empty; empty = 0; } s += pieceChar(p); }
      }
      if (empty) s += empty;
      if (r) s += '/';
    }
    let c = '';
    if (this.castling & CASTLE_WK) c += 'K';
    if (this.castling & CASTLE_WQ) c += 'Q';
    if (this.castling & CASTLE_BK) c += 'k';
    if (this.castling & CASTLE_BQ) c += 'q';
    return `${s} ${this.turn === WHITE ? 'w' : 'b'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.halfmove} ${this.fullmove}`;
  }

  /** Position key ignoring move counters (board, side, castling, ep). */
  key(): string {
    return this.fen().split(' ').slice(0, 4).join(' ');
  }
  /** Looser key: board + side + castling only. Used for opening-book transposition. */
  bookKey(): string {
    return this.fen().split(' ').slice(0, 3).join(' ');
  }

  computeHash(): void {
    let lo = 0, hi = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = this.board[sq];
      if (p) { lo ^= Z_PIECE_LO[p * 64 + sq]; hi ^= Z_PIECE_HI[p * 64 + sq]; }
    }
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    if (this.turn === BLACK) { lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI; }
    this.hashLo = lo; this.hashHi = hi;
  }

  // ---------- attacks ----------
  isAttacked(sq: number, by: number): boolean {
    const b = this.board;
    // pawns
    const pawn = mk(PAWN, by);
    for (const s of PAWN_ATTACKS[1 - by][sq]) if (b[s] === pawn) return true;
    const knight = mk(KNIGHT, by);
    for (const s of KNIGHT_MOVES[sq]) if (b[s] === knight) return true;
    const king = mk(KING, by);
    for (const s of KING_MOVES[sq]) if (b[s] === king) return true;
    const bishop = mk(BISHOP, by), rook = mk(ROOK, by), queen = mk(QUEEN, by);
    for (const ray of DIAG_RAYS[sq]) {
      for (let i = 0; i < ray.length; i++) {
        const p = b[ray[i]];
        if (p) { if (p === bishop || p === queen) return true; break; }
      }
    }
    for (const ray of ORTHO_RAYS[sq]) {
      for (let i = 0; i < ray.length; i++) {
        const p = b[ray[i]];
        if (p) { if (p === rook || p === queen) return true; break; }
      }
    }
    return false;
  }

  inCheck(color: number = this.turn): boolean {
    return this.isAttacked(this.king[color], 1 - color);
  }

  // ---------- move generation ----------
  /** Pseudo-legal moves. If capturesOnly, generates captures and queen promotions. */
  genPseudo(out: number[], capturesOnly = false): void {
    const b = this.board, us = this.turn, them = 1 - us;
    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (!p || colorOf(p) !== us) continue;
      const t = typeOf(p);
      switch (t) {
        case PAWN: {
          const dir = us === WHITE ? 8 : -8;
          const startRank = us === WHITE ? 1 : 6;
          const promoRank = us === WHITE ? 6 : 1;
          const r = from >> 3;
          const one = from + dir;
          if (!b[one]) {
            if (r === promoRank) {
              out.push(makeMove(from, one, QUEEN));
              if (!capturesOnly) {
                out.push(makeMove(from, one, ROOK), makeMove(from, one, BISHOP), makeMove(from, one, KNIGHT));
              }
            } else if (!capturesOnly) {
              out.push(makeMove(from, one));
              if (r === startRank && !b[one + dir]) out.push(makeMove(from, one + dir, 0, FLAG_DOUBLE));
            }
          }
          for (const to of PAWN_ATTACKS[us][from]) {
            const tp = b[to];
            if (tp && colorOf(tp) === them) {
              if (r === promoRank) {
                out.push(makeMove(from, to, QUEEN, FLAG_CAPTURE));
                if (!capturesOnly) {
                  out.push(makeMove(from, to, ROOK, FLAG_CAPTURE), makeMove(from, to, BISHOP, FLAG_CAPTURE), makeMove(from, to, KNIGHT, FLAG_CAPTURE));
                }
              } else out.push(makeMove(from, to, 0, FLAG_CAPTURE));
            } else if (to === this.ep && !tp) {
              out.push(makeMove(from, to, 0, FLAG_CAPTURE | FLAG_EP));
            }
          }
          break;
        }
        case KNIGHT:
          for (const to of KNIGHT_MOVES[from]) {
            const tp = b[to];
            if (!tp) { if (!capturesOnly) out.push(makeMove(from, to)); }
            else if (colorOf(tp) === them) out.push(makeMove(from, to, 0, FLAG_CAPTURE));
          }
          break;
        case KING:
          for (const to of KING_MOVES[from]) {
            const tp = b[to];
            if (!tp) { if (!capturesOnly) out.push(makeMove(from, to)); }
            else if (colorOf(tp) === them) out.push(makeMove(from, to, 0, FLAG_CAPTURE));
          }
          if (!capturesOnly) this.genCastles(out, from, us);
          break;
        default: {
          const diag = t === BISHOP || t === QUEEN;
          const ortho = t === ROOK || t === QUEEN;
          if (diag) this.genSlides(out, from, DIAG_RAYS[from], them, capturesOnly);
          if (ortho) this.genSlides(out, from, ORTHO_RAYS[from], them, capturesOnly);
        }
      }
    }
  }

  private genSlides(out: number[], from: number, rays: number[][], them: number, capturesOnly: boolean) {
    const b = this.board;
    for (const ray of rays) {
      for (let i = 0; i < ray.length; i++) {
        const to = ray[i];
        const tp = b[to];
        if (!tp) { if (!capturesOnly) out.push(makeMove(from, to)); }
        else {
          if (colorOf(tp) === them) out.push(makeMove(from, to, 0, FLAG_CAPTURE));
          break;
        }
      }
    }
  }

  private genCastles(out: number[], from: number, us: number) {
    const b = this.board, them = 1 - us;
    if (us === WHITE) {
      if (from !== 4) return;
      if ((this.castling & CASTLE_WK) && !b[5] && !b[6] && b[7] === mk(ROOK, WHITE) &&
        !this.isAttacked(4, them) && !this.isAttacked(5, them) && !this.isAttacked(6, them))
        out.push(makeMove(4, 6, 0, FLAG_CASTLE));
      if ((this.castling & CASTLE_WQ) && !b[3] && !b[2] && !b[1] && b[0] === mk(ROOK, WHITE) &&
        !this.isAttacked(4, them) && !this.isAttacked(3, them) && !this.isAttacked(2, them))
        out.push(makeMove(4, 2, 0, FLAG_CASTLE));
    } else {
      if (from !== 60) return;
      if ((this.castling & CASTLE_BK) && !b[61] && !b[62] && b[63] === mk(ROOK, BLACK) &&
        !this.isAttacked(60, them) && !this.isAttacked(61, them) && !this.isAttacked(62, them))
        out.push(makeMove(60, 62, 0, FLAG_CASTLE));
      if ((this.castling & CASTLE_BQ) && !b[59] && !b[58] && !b[57] && b[56] === mk(ROOK, BLACK) &&
        !this.isAttacked(60, them) && !this.isAttacked(59, them) && !this.isAttacked(58, them))
        out.push(makeMove(60, 58, 0, FLAG_CASTLE));
    }
  }

  /** Fully legal moves. */
  legalMoves(capturesOnly = false): number[] {
    const pseudo: number[] = [];
    this.genPseudo(pseudo, capturesOnly);
    const out: number[] = [];
    const us = this.turn;
    for (const m of pseudo) {
      this.make(m);
      if (!this.isAttacked(this.king[us], 1 - us)) out.push(m);
      this.unmake();
    }
    return out;
  }

  // ---------- make / unmake ----------
  make(m: number): void {
    const b = this.board;
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flags = (m >> 15) & 15;
    const us = this.turn;
    const piece = b[from];
    let captured = b[to];
    this.uMove.push(m);
    this.uCastle.push(this.castling);
    this.uEp.push(this.ep);
    this.uHalf.push(this.halfmove);
    this.uLo.push(this.hashLo);
    this.uHi.push(this.hashHi);

    let lo = this.hashLo, hi = this.hashHi;
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }

    b[from] = 0;
    lo ^= Z_PIECE_LO[piece * 64 + from]; hi ^= Z_PIECE_HI[piece * 64 + from];

    if (flags & FLAG_EP) {
      const capSq = us === WHITE ? to - 8 : to + 8;
      captured = b[capSq];
      b[capSq] = 0;
      lo ^= Z_PIECE_LO[captured * 64 + capSq]; hi ^= Z_PIECE_HI[captured * 64 + capSq];
    } else if (captured) {
      lo ^= Z_PIECE_LO[captured * 64 + to]; hi ^= Z_PIECE_HI[captured * 64 + to];
    }
    this.uCap.push(captured);

    const placed = promo ? mk(promo, us) : piece;
    b[to] = placed;
    lo ^= Z_PIECE_LO[placed * 64 + to]; hi ^= Z_PIECE_HI[placed * 64 + to];

    if (typeOf(piece) === KING) this.king[us] = to;

    if (flags & FLAG_CASTLE) {
      let rf: number, rt: number;
      if (to > from) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      const rook = b[rf];
      b[rf] = 0; b[rt] = rook;
      lo ^= Z_PIECE_LO[rook * 64 + rf] ^ Z_PIECE_LO[rook * 64 + rt];
      hi ^= Z_PIECE_HI[rook * 64 + rf] ^ Z_PIECE_HI[rook * 64 + rt];
    }

    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];

    this.ep = -1;
    if (flags & FLAG_DOUBLE) {
      const epSq = us === WHITE ? from + 8 : from - 8;
      // only set if enemy pawn can capture
      const enemyPawn = mk(PAWN, 1 - us);
      for (const s of PAWN_ATTACKS[us][epSq]) {
        if (b[s] === enemyPawn) { this.ep = epSq; break; }
      }
      if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    }

    this.halfmove = (typeOf(piece) === PAWN || captured) ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.turn = (1 - us) as Color;
    lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI;
    this.hashLo = lo; this.hashHi = hi;
  }

  unmake(): void {
    const m = this.uMove.pop()!;
    const captured = this.uCap.pop()!;
    this.castling = this.uCastle.pop()!;
    this.ep = this.uEp.pop()!;
    this.halfmove = this.uHalf.pop()!;
    this.hashLo = this.uLo.pop()!;
    this.hashHi = this.uHi.pop()!;
    const b = this.board;
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flags = (m >> 15) & 15;
    const us = (1 - this.turn) as Color;
    this.turn = us;
    if (us === BLACK) this.fullmove--;
    const placed = b[to];
    const piece = promo ? mk(PAWN, us) : placed;
    b[from] = piece;
    if (typeOf(piece) === KING) this.king[us] = from;
    if (flags & FLAG_EP) {
      b[to] = 0;
      b[us === WHITE ? to - 8 : to + 8] = captured;
    } else b[to] = captured;
    if (flags & FLAG_CASTLE) {
      let rf: number, rt: number;
      if (to > from) { rf = from + 3; rt = from + 1; } else { rf = from - 4; rt = from - 1; }
      b[rf] = b[rt]; b[rt] = 0;
    }
  }

  /** Null move (for search). */
  makeNull(): void {
    this.uMove.push(0); this.uCap.push(0); this.uCastle.push(this.castling); this.uEp.push(this.ep);
    this.uHalf.push(this.halfmove); this.uLo.push(this.hashLo); this.uHi.push(this.hashHi);
    if (this.ep >= 0) { this.hashLo ^= Z_EP_LO[this.ep & 7]; this.hashHi ^= Z_EP_HI[this.ep & 7]; }
    this.ep = -1;
    this.hashLo ^= Z_SIDE_LO; this.hashHi ^= Z_SIDE_HI;
    this.turn = (1 - this.turn) as Color;
    this.halfmove++;
  }
  unmakeNull(): void {
    this.uMove.pop(); this.uCap.pop(); this.castling = this.uCastle.pop()!; this.ep = this.uEp.pop()!;
    this.halfmove = this.uHalf.pop()!; this.hashLo = this.uLo.pop()!; this.hashHi = this.uHi.pop()!;
    this.turn = (1 - this.turn) as Color;
  }

  // ---------- game state ----------
  /** Number of earlier occurrences of the current position (same side to move). */
  repetitionCount(): number {
    let count = 0;
    const n = this.uLo.length;
    const limit = Math.min(this.halfmove, n);
    for (let i = 2; i <= limit; i += 2) {
      const idx = n - i;
      if (this.uLo[idx] === this.hashLo && this.uHi[idx] === this.hashHi) count++;
    }
    return count;
  }

  insufficientMaterial(): boolean {
    let minors = 0, bishopsW = 0, bishopsB = 0, knights = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = this.board[sq];
      if (!p) continue;
      const t = typeOf(p);
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      if (t === KNIGHT) { knights++; minors++; }
      if (t === BISHOP) {
        minors++;
        if (((sq & 7) + (sq >> 3)) % 2 === 0) bishopsW++; else bishopsB++;
      }
    }
    if (minors <= 1) return true;
    if (knights === 0 && (bishopsW === 0 || bishopsB === 0)) return true; // all bishops same colour squares
    return false;
  }

  // ---------- SAN ----------
  toSAN(m: number, legal?: number[]): string {
    const from = mfrom(m), to = mto(m), flags = mflags(m);
    const piece = this.board[from];
    const t = typeOf(piece);
    let s: string;
    if (flags & FLAG_CASTLE) s = to > from ? 'O-O' : 'O-O-O';
    else {
      s = '';
      const capture = (flags & FLAG_CAPTURE) !== 0;
      if (t === PAWN) {
        if (capture) s += 'abcdefgh'[file(from)] + 'x';
        s += sqName(to);
        if (mpromo(m)) s += '=' + ' pnbrqk'[mpromo(m)].toUpperCase();
      } else {
        s += PIECE_CHARS[t].toUpperCase();
        const moves = legal ?? this.legalMoves();
        let ambiguous = false, sameFile = false, sameRank = false;
        for (const o of moves) {
          if (o === m) continue;
          if (mto(o) === to && this.board[mfrom(o)] === piece) {
            ambiguous = true;
            if (file(mfrom(o)) === file(from)) sameFile = true;
            if (rank(mfrom(o)) === rank(from)) sameRank = true;
          }
        }
        if (ambiguous) {
          if (!sameFile) s += 'abcdefgh'[file(from)];
          else if (!sameRank) s += String(rank(from) + 1);
          else s += sqName(from);
        }
        if (capture) s += 'x';
        s += sqName(to);
      }
    }
    this.make(m);
    if (this.inCheck()) {
      const hasMove = this.hasLegalMove();
      s += hasMove ? '+' : '#';
    }
    this.unmake();
    return s;
  }

  hasLegalMove(): boolean {
    const pseudo: number[] = [];
    this.genPseudo(pseudo);
    const us = this.turn;
    for (const m of pseudo) {
      this.make(m);
      const ok = !this.isAttacked(this.king[us], 1 - us);
      this.unmake();
      if (ok) return true;
    }
    return false;
  }

  parseSAN(raw: string): number | null {
    let san = raw.trim().replace(/[+#!?]+$/g, '').replace(/0/g, 'O').replace(/e\.p\./, '');
    if (!san) return null;
    const legal = this.legalMoves();
    if (/^O-O(-O)?$/.test(san)) {
      const long = san === 'O-O-O';
      for (const m of legal) {
        if (mflags(m) & FLAG_CASTLE) {
          if ((mto(m) < mfrom(m)) === long) return m;
        }
      }
      return null;
    }
    const mt = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([NBRQ]))?$/.exec(san);
    if (!mt) return null;
    const [, pc, ff, fr, dest, pr] = mt;
    const type = pc ? PIECE_CHARS.indexOf(pc.toLowerCase()) : PAWN;
    const to = sqFromName(dest);
    const promo = pr ? PIECE_CHARS.indexOf(pr.toLowerCase()) : 0;
    const cands: number[] = [];
    for (const m of legal) {
      if (mto(m) !== to) continue;
      if (typeOf(this.board[mfrom(m)]) !== type) continue;
      if (mpromo(m) !== promo) continue;
      if (type === PAWN) {
        // pawn pushes (no file given) must stay on same file; captures need file
        if (ff && file(mfrom(m)) !== ff.charCodeAt(0) - 97) continue;
        if (!ff && (mflags(m) & FLAG_CAPTURE)) continue;
        if (fr && !ff && rank(mfrom(m)) !== +fr - 1) continue;
      } else {
        if (ff && file(mfrom(m)) !== ff.charCodeAt(0) - 97) continue;
        if (fr && rank(mfrom(m)) !== +fr - 1) continue;
      }
      cands.push(m);
    }
    return cands.length >= 1 ? cands[0] : null;
  }

  /** Find a legal move matching from/to(/promotion). */
  findMove(from: number, to: number, promo = 0): number | null {
    for (const m of this.legalMoves()) {
      if (mfrom(m) === from && mto(m) === to && mpromo(m) === promo) return m;
    }
    return null;
  }

  moveToUci(m: number): string {
    return sqName(mfrom(m)) + sqName(mto(m)) + (mpromo(m) ? ' pnbrqk'[mpromo(m)] : '');
  }

  parseUci(u: string): number | null {
    if (u.length < 4) return null;
    const from = sqFromName(u.slice(0, 2)), to = sqFromName(u.slice(2, 4));
    const promo = u[4] ? PIECE_CHARS.indexOf(u[4].toLowerCase()) : 0;
    return this.findMove(from, to, promo);
  }
}

export function validateFen(fen: string): string | null {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return 'FEN needs at least the piece placement and side to move.';
  const rows = parts[0].split('/');
  if (rows.length !== 8) return 'Piece placement must have 8 ranks separated by "/".';
  let wk = 0, bk = 0;
  for (let i = 0; i < 8; i++) {
    let count = 0;
    for (const ch of rows[i]) {
      if (ch >= '1' && ch <= '8') count += +ch;
      else if (/[pnbrqkPNBRQK]/.test(ch)) {
        count++;
        if (ch === 'K') wk++;
        if (ch === 'k') bk++;
        if ((ch === 'p' || ch === 'P') && (i === 0 || i === 7)) return 'Pawns cannot be on the first or last rank.';
      } else return `Invalid character "${ch}" in piece placement.`;
    }
    if (count !== 8) return `Rank ${8 - i} does not have 8 squares.`;
  }
  if (wk !== 1 || bk !== 1) return 'Each side must have exactly one king.';
  if (parts[1] !== 'w' && parts[1] !== 'b') return 'Side to move must be "w" or "b".';
  if (parts[2] && !/^(-|[KQkq]+)$/.test(parts[2])) return 'Invalid castling rights field.';
  if (parts[3] && !/^(-|[a-h][36])$/.test(parts[3])) return 'Invalid en-passant square.';
  // The side not to move must not be in check
  try {
    const p = new Position();
    // Build without validating again: temporary minimal parse
    const tmp = parts.join(' ');
    p.board.fill(0);
    const rws = parts[0].split('/');
    for (let i = 0; i < 8; i++) {
      let f = 0;
      for (const ch of rws[i]) {
        if (ch >= '1' && ch <= '8') f += +ch;
        else {
          const lower = ch.toLowerCase();
          const t = PIECE_CHARS.indexOf(lower);
          const c = ch === lower ? BLACK : WHITE;
          p.board[(7 - i) * 8 + f] = mk(t, c);
          if (t === KING) p.king[c] = (7 - i) * 8 + f;
          f++;
        }
      }
    }
    void tmp;
    const stm = parts[1] === 'w' ? WHITE : BLACK;
    if (p.isAttacked(p.king[1 - stm], stm)) return 'The side not to move is in check (illegal position).';
  } catch {
    return 'Could not parse FEN.';
  }
  return null;
}

export function newGamePosition(): Position {
  return Position.fromFen(START_FEN);
}

export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = pos.legalMoves();
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    pos.make(m);
    n += perft(pos, depth - 1);
    pos.unmake();
  }
  return n;
}
