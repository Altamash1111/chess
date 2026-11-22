/** Map a board square (a1=0 … h8=63) to display column/row (row 0 = top). */
export function squareToDisplay(sq: number, orientation: 0 | 1): { col: number; row: number } {
  const f = sq & 7, r = sq >> 3;
  return orientation === 0 ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
}

/** Inverse mapping: display column/row to board square. */
export function displayToSquare(col: number, row: number, orientation: 0 | 1): number {
  return orientation === 0 ? (7 - row) * 8 + col : row * 8 + (7 - col);
}
