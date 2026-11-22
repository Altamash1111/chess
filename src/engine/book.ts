import { Position, START_FEN } from '../chess/position';
import { BOOK_LINES, StyleTag } from './openings-data';

export interface BookMove {
  uci: string;
  san: string;
  weight: number;
  tags: Set<StyleTag>;
  /** names of lines this move belongs to */
  lines: string[];
}

export interface BookEntry { moves: Map<string, BookMove>; }

const book = new Map<string, BookEntry>();
const names = new Map<string, { name: string; n: number }>();
let built = false;
export const bookErrors: string[] = [];

export function buildBook() {
  if (built) return;
  built = true;
  for (const line of BOOK_LINES) {
    const pos = Position.fromFen(START_FEN);
    const sans = line.san.split(/\s+/).filter(Boolean);
    const w = line.w ?? 1;
    let ply = 0;
    let carry: string | null = null;
    for (const san of sans) {
      const m = pos.parseSAN(san);
      if (m === null) { bookErrors.push(`${line.name}: illegal "${san}" at ply ${ply + 1}`); break; }
      const key = pos.bookKey();
      const uci = pos.moveToUci(m);
      let e = book.get(key);
      if (!e) { e = { moves: new Map() }; book.set(key, e); }
      let bm = e.moves.get(uci);
      if (!bm) { bm = { uci, san: pos.toSAN(m), weight: 0, tags: new Set(), lines: [] }; e.moves.set(uci, bm); }
      // deeper plies in a line count a bit less, so main lines near the root dominate
      bm.weight += w;
      for (const t of line.tags ?? []) bm.tags.add(t);
      if (!bm.lines.includes(line.name)) bm.lines.push(line.name);
      pos.make(m);
      ply++;
      const nm = names.get(pos.bookKey());
      const named = line.n ?? sans.length;
      if (ply >= named && (!nm || ply > nm.n)) names.set(pos.bookKey(), { name: line.name, n: ply });
      // positions deeper in a line inherit the name of the opening reached so far
      const cur = names.get(pos.bookKey());
      if (cur) carry = cur.name; else if (carry) names.set(pos.bookKey(), { name: carry, n: 0 });
    }
  }
}

export function bookMoves(pos: Position): BookMove[] {
  buildBook();
  const e = book.get(pos.bookKey());
  if (!e) return [];
  // only moves that are legal here (defensive)
  return [...e.moves.values()].sort((a, b) => b.weight - a.weight);
}

export function openingName(pos: Position): string | null {
  buildBook();
  return names.get(pos.bookKey())?.name ?? null;
}

export function inBook(pos: Position): boolean {
  buildBook();
  return book.has(pos.bookKey());
}

export function bookSize() { buildBook(); return book.size; }
