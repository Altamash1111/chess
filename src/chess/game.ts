import {
  Position, START_FEN, WHITE, BLACK, mfrom, mto, mflags, FLAG_CAPTURE, FLAG_EP, typeOf, colorOf,
  PAWN, KNIGHT, BISHOP, ROOK, QUEEN, mpromo, validateFen,
} from './position';

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';
export type EndReason =
  | 'checkmate' | 'stalemate' | 'insufficient' | 'fifty' | 'repetition'
  | 'resignation' | 'timeout' | 'agreement' | 'none';

export interface GameStatus {
  over: boolean;
  result: GameResult;
  reason: EndReason;
  winner: 0 | 1 | null;
  check: boolean;
}

export interface PlyRecord {
  move: number;
  san: string;
  fenBefore: string;
  fenAfter: string;
  captured: number; // piece code or 0
}

/** Game wrapper: position + move list with undo/redo, results, PGN. UI independent. */
export class Game {
  pos: Position;
  startFen: string;
  plies: PlyRecord[] = [];
  forcedResult: { result: GameResult; reason: EndReason } | null = null;
  headers: Record<string, string> = {};

  constructor(fen: string = START_FEN) {
    this.startFen = fen;
    this.pos = Position.fromFen(fen);
  }

  get turn() { return this.pos.turn; }

  reset(fen: string = START_FEN) {
    this.startFen = fen;
    this.pos = Position.fromFen(fen);
    this.plies = [];
    this.forcedResult = null;
  }

  /** Play a move (encoded). Returns the SAN or null if illegal. */
  play(m: number): string | null {
    if (this.status().over) return null;
    const legal = this.pos.legalMoves();
    if (!legal.includes(m)) return null;
    const san = this.pos.toSAN(m, legal);
    const fenBefore = this.pos.fen();
    const captured = this.capturedPiece(m);
    this.pos.make(m);
    this.plies.push({ move: m, san, fenBefore, fenAfter: this.pos.fen(), captured });
    return san;
  }

  playFromTo(from: number, to: number, promo = 0): string | null {
    const m = this.pos.findMove(from, to, promo);
    return m === null ? null : this.play(m);
  }

  playSan(san: string): string | null {
    const m = this.pos.parseSAN(san);
    return m === null ? null : this.play(m);
  }

  private capturedPiece(m: number): number {
    if (!(mflags(m) & FLAG_CAPTURE)) return 0;
    if (mflags(m) & FLAG_EP) return (PAWN | ((1 - this.pos.turn) << 3));
    return this.pos.board[mto(m)];
  }

  undo(): PlyRecord | null {
    if (!this.plies.length) return null;
    this.pos.unmake();
    this.forcedResult = null;
    return this.plies.pop()!;
  }

  status(): GameStatus {
    const pos = this.pos;
    const check = pos.inCheck();
    if (this.forcedResult) {
      const r = this.forcedResult.result;
      return { over: true, result: r, reason: this.forcedResult.reason, winner: r === '1-0' ? WHITE : r === '0-1' ? BLACK : null, check };
    }
    if (!pos.hasLegalMove()) {
      if (check) {
        const winner = pos.turn === WHITE ? BLACK : WHITE;
        return { over: true, result: winner === WHITE ? '1-0' : '0-1', reason: 'checkmate', winner, check };
      }
      return { over: true, result: '1/2-1/2', reason: 'stalemate', winner: null, check };
    }
    if (pos.insufficientMaterial()) return { over: true, result: '1/2-1/2', reason: 'insufficient', winner: null, check };
    if (pos.halfmove >= 100) return { over: true, result: '1/2-1/2', reason: 'fifty', winner: null, check };
    if (pos.repetitionCount() >= 2) return { over: true, result: '1/2-1/2', reason: 'repetition', winner: null, check };
    return { over: false, result: '*', reason: 'none', winner: null, check };
  }

  resign(color: 0 | 1) {
    this.forcedResult = { result: color === WHITE ? '0-1' : '1-0', reason: 'resignation' };
  }
  agreeDraw() { this.forcedResult = { result: '1/2-1/2', reason: 'agreement' }; }
  timeout(loser: 0 | 1) {
    // FIDE: if the opponent cannot possibly mate, it is a draw. Keep it simple: insufficient material check.
    this.forcedResult = { result: loser === WHITE ? '0-1' : '1-0', reason: 'timeout' };
  }

  /** Position after n plies (0 = start). Independent copy. */
  positionAt(ply: number): Position {
    const p = Position.fromFen(this.startFen);
    for (let i = 0; i < ply && i < this.plies.length; i++) p.make(this.plies[i].move);
    return p;
  }

  moveNumberOf(plyIndex: number): { number: number; color: 0 | 1 } {
    const startTurn = Position.fromFen(this.startFen).turn;
    const startFull = Position.fromFen(this.startFen).fullmove;
    const offset = startTurn === BLACK ? 1 : 0;
    const total = plyIndex + offset;
    return { number: startFull + Math.floor(total / 2), color: (total % 2) as 0 | 1 };
  }

  sanList(): string[] { return this.plies.map(p => p.san); }

  capturedBy(color: 0 | 1): number[] {
    // pieces captured by `color` (i.e. belonging to the opponent)
    return this.plies.filter(p => p.captured && colorOf(p.captured) !== color).map(p => p.captured);
  }

  // ---------- PGN ----------
  toPGN(extra: Record<string, string> = {}): string {
    const status = this.status();
    const now = new Date();
    const h: Record<string, string> = {
      Event: 'Project Grandmaster Game',
      Site: 'Local',
      Date: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`,
      Round: '-',
      White: 'White',
      Black: 'Black',
      Result: status.result,
      ...this.headers,
      ...extra,
    };
    h.Result = status.result;
    if (this.startFen !== START_FEN) { h.SetUp = '1'; h.FEN = this.startFen; }
    const order = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
    const keys = [...order, ...Object.keys(h).filter(k => !order.includes(k))];
    let out = keys.filter(k => k in h).map(k => `[${k} "${String(h[k]).replace(/"/g, "'")}"]`).join('\n') + '\n\n';
    const tokens: string[] = [];
    this.plies.forEach((p, i) => {
      const mn = this.moveNumberOf(i);
      if (mn.color === WHITE) tokens.push(`${mn.number}. ${p.san}`);
      else tokens.push(i === 0 ? `${mn.number}... ${p.san}` : p.san);
    });
    tokens.push(status.result);
    // wrap at ~80 chars
    let line = '';
    const lines: string[] = [];
    for (const t of tokens) {
      if ((line + ' ' + t).trim().length > 80) { lines.push(line); line = t; }
      else line = (line + ' ' + t).trim();
    }
    if (line) lines.push(line);
    return out + lines.join('\n') + '\n';
  }

  static fromPGN(pgn: string): Game {
    const { headers, movetext } = parsePGN(pgn);
    let fen = START_FEN;
    if (headers.FEN) {
      const err = validateFen(headers.FEN);
      if (err) throw new Error('PGN has an invalid FEN header: ' + err);
      fen = headers.FEN;
    }
    const g = new Game(fen);
    g.headers = { ...headers };
    delete g.headers.FEN; delete g.headers.SetUp; delete g.headers.Result;
    for (const tok of movetext) {
      const san = g.pos.parseSAN(tok);
      if (san === null) throw new Error(`Illegal or unreadable move "${tok}" at move ${Math.floor(g.plies.length / 2) + 1}.`);
      g.play(san);
    }
    const res = headers.Result as GameResult | undefined;
    if (res && res !== '*' && !g.status().over) {
      g.forcedResult = { result: res, reason: res === '1/2-1/2' ? 'agreement' : 'resignation' };
    }
    return g;
  }
}

export function parsePGN(text: string): { headers: Record<string, string>; movetext: string[] } {
  const headers: Record<string, string> = {};
  // Use only the first game in the text
  let body = text.replace(/\r/g, '');
  const headerRe = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(body))) headers[m[1]] = m[2].replace(/\\"/g, '"');
  body = body.replace(/^\s*\[.*\]\s*$/gm, ' ');
  // strip comments, variations, NAGs, results, move numbers
  body = body.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  let depth = 0, cleaned = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) cleaned += ch;
  }
  cleaned = cleaned.replace(/\$\d+/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const moves: string[] = [];
  for (let t of tokens) {
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)) break;
    t = t.replace(/^\d+\.(\.\.)?/, '').replace(/^\.+/, '');
    if (!t) continue;
    moves.push(t);
  }
  return { headers, movetext: moves };
}

export const PIECE_VALUE_BASIC: Record<number, number> = { [PAWN]: 1, [KNIGHT]: 3, [BISHOP]: 3, [ROOK]: 5, [QUEEN]: 9, 6: 0 };
export { mfrom, mto, mpromo, typeOf, colorOf };
