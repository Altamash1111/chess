import { test, eq, ok, run } from './harness';
import { buildBook, bookErrors, bookMoves, openingName, bookSize } from '../src/engine/book';
import { Position, START_FEN } from '../src/chess/position';
import { LESSONS, START_POSITIONS } from '../src/engine/openings-data';

test('every book line is legal', () => {
  buildBook();
  eq(bookErrors, []);
  ok(bookSize() > 600, 'book size ' + bookSize());
});
test('lesson setups and learn lines are legal', () => {
  for (const l of LESSONS) {
    const p = Position.fromFen(START_FEN);
    for (const s of l.setup.split(/\s+/).filter(Boolean)) ok(p.parseSAN(s) !== null && (p.make(p.parseSAN(s)!), true), `${l.id} setup ${s}`);
    // learn lines are from the setup position only when setup empty; check legality in game order for those starting at root
    if (!l.setup) {
      const q = Position.fromFen(START_FEN);
      for (const st of l.learn) { const m = q.parseSAN(st.san); ok(m !== null, `${l.id} learn ${st.san}`); q.make(m!); }
    } else {
      const q = Position.fromFen(START_FEN);
      for (const s of l.setup.split(/\s+/)) q.make(q.parseSAN(s)!);
      for (const st of l.learn) { const m = q.parseSAN(st.san); ok(m !== null, `${l.id} learn ${st.san}`); q.make(m!); }
    }
  }
  for (const s of START_POSITIONS) {
    const p = Position.fromFen(START_FEN);
    for (const x of s.setup.split(/\s+/)) { const m = p.parseSAN(x); ok(m !== null, s.id + ' ' + x); p.make(m!); }
  }
});
test('Italian / Giuoco / Two Knights naming and replies', () => {
  const p = Position.fromFen(START_FEN);
  const go = (s: string) => { for (const x of s.split(' ')) p.make(p.parseSAN(x)!); };
  go('e4 e5 Nf3 Nc6 Bc4');
  eq(openingName(p), 'Italian Game');
  const replies = bookMoves(p).map(m => m.san);
  ok(['Bc5', 'Nf6', 'Be7'].every(x => replies.includes(x)), replies.join(','));
  go('Bc5');
  eq(openingName(p), 'Giuoco Piano');
  const q = Position.fromFen(START_FEN);
  for (const x of 'e4 e5 Nf3 Nc6 Bc4 Nf6'.split(' ')) q.make(q.parseSAN(x)!);
  eq(openingName(q), 'Two Knights Defence');
});
run('BOOK');
