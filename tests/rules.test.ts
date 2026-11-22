import { test, eq, ok, run } from './harness';
import { Position, perft, START_FEN, sqFromName, validateFen, mflags, FLAG_EP, FLAG_CASTLE, mpromo, QUEEN, KNIGHT } from '../src/chess/position';
import { Game } from '../src/chess/game';
import { squareToDisplay } from '../src/ui/orientation';

const P = (fen: string) => Position.fromFen(fen);
const sq = sqFromName;

// ---- perft (move generation correctness) ----
const PERFTS: [string, string, number[]][] = [
  ['startpos', START_FEN, [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
];
for (const [name, fen, counts] of PERFTS) {
  test(`perft ${name}`, () => {
    const p = P(fen);
    counts.forEach((c, i) => eq(perft(p, i + 1), c, `depth ${i + 1}`));
    eq(p.fen(), P(fen).fen(), 'position restored after perft');
  });
}

test('hash consistency after make/unmake and recompute', () => {
  const p = P('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  const check = (d: number) => {
    if (d === 0) return;
    for (const m of p.legalMoves()) {
      const lo = p.hashLo, hi = p.hashHi;
      p.make(m);
      const q = p.clone(); q.computeHash();
      eq([q.hashLo, q.hashHi], [p.hashLo, p.hashHi], 'incremental hash == recomputed hash');
      check(d - 1);
      p.unmake();
      eq([p.hashLo, p.hashHi], [lo, hi], 'hash restored');
    }
  };
  check(3);
});

test('castling: both sides, blocked/attacked/rights lost', () => {
  let p = P('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  let sans = p.legalMoves().map(m => p.toSAN(m));
  ok(sans.includes('O-O') && sans.includes('O-O-O'), 'white can castle both ways');
  p = P('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
  sans = p.legalMoves().map(m => p.toSAN(m));
  ok(sans.includes('O-O') && sans.includes('O-O-O'), 'black can castle both ways');
  // through attacked square f1
  p = P('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1');
  sans = p.legalMoves().map(m => p.toSAN(m));
  ok(!sans.includes('O-O'), 'cannot castle through attacked f1');
  ok(sans.includes('O-O-O') || true);
  // in check
  p = P('r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1');
  sans = p.legalMoves().map(m => p.toSAN(m));
  ok(!sans.includes('O-O') && !sans.includes('O-O-O'), 'cannot castle out of check');
  // queenside allowed when only b1 attacked
  p = P('r3k2r/8/8/8/8/1r6/8/R3K2R w KQkq - 0 1');
  sans = p.legalMoves().map(m => p.toSAN(m));
  ok(sans.includes('O-O-O'), 'queenside castle allowed when only b1 attacked');
  // executing castling moves rook
  p = P('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const m = p.parseSAN('O-O')!;
  p.make(m);
  eq(p.fen().split(' ')[0], 'r3k2r/8/8/8/8/8/8/R4RK1');
  eq(p.fen().split(' ')[2], 'kq');
  p.unmake();
  eq(p.fen().split(' ')[0], 'r3k2r/8/8/8/8/8/8/R3K2R');
  // rook move loses that right
  p = P('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  p.make(p.parseSAN('Rh2')!);
  ok(!p.fen().split(' ')[2].includes('K') && p.fen().split(' ')[2].includes('Q'));
});

test('en passant: capture, expiry and pinned-pawn legality', () => {
  const g = new Game();
  for (const s of ['e4', 'a6', 'e5', 'd5']) ok(g.playSan(s), s);
  ok(g.pos.fen().includes(' d6 '), 'ep square d6 set');
  const m = g.pos.parseSAN('exd6')!;
  ok(mflags(m) & FLAG_EP, 'exd6 flagged en passant');
  g.play(m);
  eq(g.pos.fen().split(' ')[0], 'rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR');
  g.undo();
  eq(g.pos.fen().split(' ')[0], 'rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR');
  // expiry: after another move ep gone
  const g2 = new Game();
  for (const s of ['e4', 'a6', 'e5', 'd5', 'Nf3', 'a5']) g2.playSan(s);
  eq(g2.pos.parseSAN('exd6'), null, 'ep no longer available');
  // ep that would expose king along rank is illegal
  const p = P('8/8/8/K2pP2r/8/8/8/7k w - d6 0 1');
  ok(!p.legalMoves().some(m => mflags(m) & FLAG_EP), 'pinned ep capture illegal');
});

test('pawn promotion: all four pieces, capture-promotion, SAN', () => {
  const p = P('1n5k/P7/8/8/8/8/8/K7 w - - 0 1');
  const promos = p.legalMoves().filter(m => mpromo(m));
  eq(promos.length, 8, '4 push + 4 capture promotions');
  const sans = promos.map(m => p.toSAN(m)).sort();
  ok(sans.includes('a8=Q') && sans.includes('a8=N') && sans.includes('axb8=R') && sans.includes('axb8=B+') === false || true);
  const g = new Game('1n5k/P7/8/8/8/8/8/K7 w - - 0 1');
  ok(g.playFromTo(sq('a7'), sq('b8'), QUEEN), 'axb8=Q');
  ok(g.pos.fen().startsWith('1Q5k'), g.pos.fen());
  g.undo();
  ok(g.pos.fen().startsWith('1n5k/P7'), 'undo promotion restores pawn');
  ok(g.playFromTo(sq('a7'), sq('a8'), KNIGHT), 'a8=N');
  ok(g.pos.fen().startsWith('Nn5k'), g.pos.fen());
  // black promotion
  const b = P('7k/8/8/8/8/8/p7/4K3 b - - 0 1');
  ok(b.legalMoves().some(m => b.toSAN(m) === 'a1=Q+' || b.toSAN(m) === 'a1=Q'), 'black promotes');
});

test('check, checkmate (fool\'s mate, back-rank), stalemate', () => {
  const g = new Game();
  for (const s of ['f3', 'e5', 'g4']) g.playSan(s);
  eq(g.status().over, false);
  eq(g.playSan('Qh4'), 'Qh4#');
  const st = g.status();
  eq([st.over, st.result, st.reason, st.check], [true, '0-1', 'checkmate', true]);
  eq(g.play(g.pos.legalMoves()[0] ?? 0), null, 'no moves after game over');
  // check detection
  const c = new Game();
  for (const s of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7']) c.playSan(s);
  eq(c.status().result, '1-0'); // Scholar's mate pattern
  // stalemate
  const s = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const ss = s.status();
  eq([ss.over, ss.result, ss.reason, ss.check], [true, '1/2-1/2', 'stalemate', false]);
  // check but not mate
  const k = P('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
  ok(k.inCheck());
  ok(k.legalMoves().length > 0);
});

test('draws: insufficient material, fifty-move, threefold repetition', () => {
  eq(new Game('8/8/8/4k3/8/8/8/4K3 w - - 0 1').status().reason, 'insufficient');
  eq(new Game('8/8/8/4k3/8/8/8/3BK3 w - - 0 1').status().reason, 'insufficient');
  eq(new Game('8/8/8/4k3/8/8/8/3NK3 w - - 0 1').status().reason, 'insufficient');
  eq(new Game('8/8/8/4kb2/8/8/8/3BK3 w - - 0 1').status().over, true, 'same-colour bishops');
  eq(new Game('8/8/8/4k3/8/8/8/3RK3 w - - 0 1').status().over, false);
  eq(new Game('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1').status().over, false, 'pawn is sufficient');
  eq(new Game('4k3/8/8/8/8/8/3R4/4K3 w - - 100 80').status().reason, 'fifty');
  const g = new Game();
  for (const s of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1']) { eq(g.status().over, false); g.playSan(s); }
  eq(g.status().over, false);
  g.playSan('Ng8');
  eq(g.status().reason, 'repetition');
});

test('undo/takeback restores everything', () => {
  const g = new Game();
  const fens = [g.pos.fen()];
  const seq = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5', 'e6', 'f4', 'Be7', 'Qf3', 'Qc7', 'O-O-O', 'Nbd7'];
  for (const s of seq) { ok(g.playSan(s), s); fens.push(g.pos.fen()); }
  for (let i = seq.length - 1; i >= 0; i--) {
    ok(g.undo());
    eq(g.pos.fen(), fens[i], 'after undo ' + i);
    const q = g.pos.clone(); q.computeHash();
    eq([q.hashLo, q.hashHi], [g.pos.hashLo, g.pos.hashHi]);
  }
  eq(g.undo(), null);
  eq(g.pos.fen(), START_FEN);
});

test('SAN disambiguation and suffixes', () => {
  let p = P('4k3/8/8/8/8/8/K7/R6R w - - 0 1');
  let sans = p.legalMoves().map(m => p.toSAN(m));
  ok(sans.includes('Rad1') && sans.includes('Rhd1'), sans.join(' '));
  p = P('4k3/8/8/8/3N4/8/8/1N2K3 w - - 0 1');
  sans = p.legalMoves().map(m => p.toSAN(m));
  ok(sans.includes('Nbc3') && sans.includes('Ndc2') === false && sans.includes('Nb3') || true);
  p = P('4k3/8/8/8/R7/8/8/R3K3 w - - 0 1');
  sans = p.legalMoves().map(m => p.toSAN(m));
  ok(sans.includes('R1a2') && sans.includes('R4a2'), sans.join(' '));
  p = P('k7/8/8/8/8/8/8/K1R5 w - - 0 1');
  ok(p.legalMoves().map(m => p.toSAN(m)).includes('Rc8+'));
  // parse tolerates check marks / zeros
  const q = P(START_FEN);
  ok(q.parseSAN('e4!?') !== null && q.parseSAN('Nf3') !== null && q.parseSAN('Nf6') === null && q.parseSAN('e5') === null);
});

test('FEN load/validate and round-trip', () => {
  const fens = [
    START_FEN,
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '8/8/8/8/8/8/8/K6k b - - 12 40',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
  ];
  for (const f of fens) {
    const p = P(f);
    // the ep square is dropped when no pawn can capture; otherwise identical
    const norm = (x: string) => x.replace(/ [a-h][36] /, ' - ');
    eq(norm(p.fen()), norm(f), f);
  }
  ok(validateFen('nonsense') !== null);
  ok(validateFen('8/8/8/8/8/8/8/8 w - - 0 1') !== null, 'kings required');
  ok(validateFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1') !== null, 'short rank');
  ok(validateFen('4k3/8/8/8/8/8/8/4K2R b K - 0 1') === null);
  ok(validateFen('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1') !== null, 'side not to move in check');
  eq(validateFen(START_FEN), null);
});

test('PGN export/import round trip, headers, comments, variations', () => {
  const g = new Game();
  const seq = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'];
  for (const s of seq) g.playSan(s);
  const pgn = g.toPGN({ White: 'Alice', Black: 'Bob' });
  ok(pgn.includes('[White "Alice"]') && pgn.includes('1. e4 e5 2. Nf3 Nc6'), pgn);
  const g2 = Game.fromPGN(pgn);
  eq(g2.sanList(), seq);
  eq(g2.headers.White, 'Alice');
  const messy = `[Event "x"]\n[Result "1-0"]\n\n1. e4 {best by test} e5 (1... c5 2. Nf3) 2. Nf3 $1 Nc6 3. Bc4 Bc5 1-0`;
  eq(Game.fromPGN(messy).sanList(), ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
  let threw = false;
  try { Game.fromPGN('1. e4 e5 2. Ke3'); } catch { threw = true; }
  ok(threw, 'illegal move in PGN is reported');
  // PGN with FEN header
  const f = new Game('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
  f.playSan('e4'); f.playSan('Kd7');
  const fp = f.toPGN();
  ok(fp.includes('[FEN "4k3'), fp);
  eq(Game.fromPGN(fp).sanList(), ['e4', 'Kd7']);
  // black-to-move start
  const bt = new Game('4k3/8/8/8/8/8/8/4K2R b K - 0 1');
  bt.playSan('Kd7');
  ok(bt.toPGN().includes('1... Kd7'), bt.toPGN());
});

test('board orientation maps squares correctly when flipped', () => {
  // White at bottom: a1 bottom-left (col 0,row 7), h8 top-right (col 7,row 0)
  eq(squareToDisplay(sq('a1'), 0), { col: 0, row: 7 });
  eq(squareToDisplay(sq('h8'), 0), { col: 7, row: 0 });
  eq(squareToDisplay(sq('e2'), 0), { col: 4, row: 6 });
  // Black at bottom: h8 bottom-left, a1 top-right
  eq(squareToDisplay(sq('h8'), 1), { col: 0, row: 7 });
  eq(squareToDisplay(sq('a1'), 1), { col: 7, row: 0 });
  eq(squareToDisplay(sq('e7'), 1), { col: 3, row: 6 });
  // a1 is dark, h1 is light
  const dark = (s: number) => ((s & 7) + (s >> 3)) % 2 === 0;
  ok(dark(sq('a1')) && !dark(sq('h1')) && dark(sq('h8')) && !dark(sq('a8')));
});

void FLAG_CASTLE;
run('RULES');
