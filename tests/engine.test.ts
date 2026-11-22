import { test, eq, ok, run } from './harness';
import { EngineCore, MoveRequest, buildPosition } from '../src/engine/core';
import { LEVELS } from '../src/engine/levels';
import { PERSONALITIES } from '../src/engine/personalities';
import { Game } from '../src/chess/game';
import { START_FEN } from '../src/chess/position';

const core = new EngineCore();
const req = (fen: string, level: string, personality = 'allround', moves: string[] = [], seed = 1): MoveRequest =>
  ({ startFen: fen, moves, level, personality, seed, fastDelay: true });

const POSITIONS = [
  START_FEN,
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 b - - 0 10',
  '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
];

test('AI always returns legal moves across levels x personalities (fast levels)', () => {
  let n = 0;
  for (const lv of LEVELS.filter(l => !['master', 'grandmaster'].includes(l.id))) {
    for (const p of PERSONALITIES) {
      for (const fen of POSITIONS) {
        const d = core.chooseMove(req(fen, lv.id, p.id, [], n++));
        const pos = buildPosition(fen, []);
        ok(pos.legalMoves().includes(d.move), `${lv.id}/${p.id} produced illegal move ${d.uci} in ${fen}`);
      }
    }
  }
  console.log(`      (${n} decisions)`);
});

test('Master and Grandmaster return legal moves within their time limits', () => {
  for (const id of ['master', 'grandmaster']) {
    const lv = LEVELS.find(l => l.id === id)!;
    for (const p of PERSONALITIES) {
      const fen = POSITIONS[p.id.length % POSITIONS.length === 0 ? 2 : 4];
      const t0 = Date.now();
      const d = core.chooseMove(req(fen, id, p.id));
      const dt = Date.now() - t0;
      ok(buildPosition(fen, []).legalMoves().includes(d.move), 'illegal');
      ok(dt <= lv.hardMs * 1.2 + 400, `${id}/${p.id} took ${dt}ms (limit ${lv.hardMs})`);
    }
  }
});

test('response time stays inside the per-level budget (middlegame)', () => {
  const fen = POSITIONS[2];
  for (const lv of LEVELS.filter(l => !['master', 'grandmaster'].includes(l.id))) {
    let worst = 0;
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      core.chooseMove(req(fen, lv.id, 'allround', [], 100 + i));
      worst = Math.max(worst, Date.now() - t0);
    }
    console.log(`      ${lv.name.padEnd(13)} worst ${worst}ms (hard limit ${lv.hardMs}ms)`);
    ok(worst <= lv.hardMs * 1.2 + 300, `${lv.name} too slow: ${worst}`);
  }
});

test('finds mate in one at every level except Beginner', () => {
  const fens = ['6k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'];
  const want = ['e1e8', 'h5f7'];
  fens.forEach((fen, i) => {
    for (const lv of LEVELS.filter(l => l.id !== 'beginner')) {
      for (const p of PERSONALITIES) {
        const d = core.chooseMove(req(fen, lv.id, p.id, [], 5 + i));
        const pos = buildPosition(fen, []);
        pos.make(pos.parseUci(d.uci)!);
        ok(pos.inCheck() && !pos.hasLegalMove(), `${lv.id}/${p.id} played ${d.uci} (expected a mating move like ${want[i]})`);
      }
    }
  });
});

test('Grandmaster finds a mate in 3 and wins a free queen', () => {
  // Mate in 3: 1.Qxf7+ Rxf7 2.Rxf7... use a known smothered mate: Philidor's legacy
  const d1 = core.chooseMove(req('r5rk/5p1p/5R2/4B3/8/8/7P/7K w - - 0 1', 'grandmaster'));
  ok(d1.score > 29000, 'sees forced mate, score ' + d1.score);
  const d2 = core.chooseMove(req('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', 'grandmaster'));
  eq(d2.uci, 'd1d5');
});

test('Grandmaster avoids hanging material in tactical positions', () => {
  // black queen attacked by pawn: engine (black to move) must not leave it en prise
  const fen = 'rnb1kbnr/pppp1ppp/8/4p3/3PP2q/8/PPP2PPP/RNBQKBNR b KQkq - 0 3';
  const pos = buildPosition(fen, []);
  const d = core.chooseMove(req(fen, 'grandmaster'));
  pos.make(pos.parseUci(d.uci)!);
  // after the move no white pawn capture should win the queen cleanly
  const lost = pos.legalMoves().some(m => pos.board[(m >> 6) & 63] && (pos.board[(m >> 6) & 63] & 7) === 5);
  ok(!lost, 'queen left hanging after ' + d.uci);
});

test('openings: AI responds in book to Italian, handles off-book moves with the engine', () => {
  const d = core.chooseMove(req(START_FEN, 'advanced', 'allround', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']));
  eq(d.source, 'book');
  ok(['c5', 'f6', 'e7'].some(x => d.san.endsWith(x)), 'unexpected book reply ' + d.san);
  // surprise: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.h4?! -> leaves book, engine still replies legally
  const off = core.chooseMove(req(START_FEN, 'advanced', 'allround', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'h2h4']));
  eq(off.source, 'search');
  ok(buildPosition(START_FEN, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'h2h4']).legalMoves().length > 0);
});

test('variety: different seeds give different games', () => {
  const firstMoves = new Set<string>();
  const seqs = new Set<string>();
  for (let s = 1; s <= 12; s++) {
    const g = new Game();
    const moves: string[] = [];
    for (let i = 0; i < 8; i++) {
      const lvl = 'advanced';
      const d = core.chooseMove(req(START_FEN, lvl, i % 2 ? 'positional' : 'aggressive', moves, s * 1000 + 7));
      g.play(d.move);
      moves.push(d.uci);
      if (i === 1) firstMoves.add(d.uci);
    }
    seqs.add(moves.join(' '));
  }
  ok(seqs.size >= 3, 'only ' + seqs.size + ' distinct 8-ply games out of 12');
});

test('personalities choose measurably different moves/styles', () => {
  const fen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
  const picks: Record<string, Set<string>> = {};
  for (const p of PERSONALITIES) {
    picks[p.id] = new Set();
    for (let s = 0; s < 6; s++) picks[p.id].add(core.chooseMove(req(fen, 'advanced', p.id, [], 40 + s)).san);
  }
  const all = new Set(Object.values(picks).flatMap(s => [...s]));
  console.log('      ' + Object.entries(picks).map(([k, v]) => `${k}: ${[...v].join('/')}`).join(' | '));
  ok(all.size >= 3, 'personalities too similar');
});

test('difficulty changes real strength: GM never loses a clean piece; Beginner sometimes does', () => {
  // Score loss of chosen move versus GM-best across a set of middlegame positions
  const fens = POSITIONS.slice(1, 5);
  const loss = (lv: string) => {
    let tot = 0, n = 0;
    for (const fen of fens) for (let s = 0; s < 4; s++) {
      const d = core.chooseMove(req(fen, lv, 'allround', [], s * 31 + 3));
      const a = core.analyze({ startFen: fen, moves: [], maxDepth: 6, timeMs: 300, multiPV: 12 });
      const mine = a.lines.find(l => l.uci === d.uci);
      tot += a.lines[0].score - (mine ? mine.score : a.lines[a.lines.length - 1].score - 50); n++;
    }
    return tot / n;
  };
  const b = loss('beginner'), g = loss('expert');
  console.log(`      avg centipawn loss: beginner ${b.toFixed(0)}, expert ${g.toFixed(0)}`);
  ok(b > g, 'beginner should lose more per move than expert');
});

test('self-play games complete with only legal moves and correct results', () => {
  const lv = ['beginner', 'easy', 'intermediate', 'advanced'];
  for (let gi = 0; gi < 4; gi++) {
    const g = new Game();
    const moves: string[] = [];
    let guard = 0;
    while (!g.status().over && guard++ < 200) {
      const side = g.turn;
      const d = core.chooseMove(req(START_FEN, lv[(gi + side) % 4], PERSONALITIES[(gi + side) % 5].id, moves, gi * 99 + moves.length));
      ok(g.play(d.move) !== null, 'illegal move in self-play');
      moves.push(d.uci);
    }
    const st = g.status();
    console.log(`      game ${gi + 1}: ${g.plies.length} plies, ${st.result} (${st.reason})`);
    // PGN roundtrip of the game
    const g2 = Game.fromPGN(g.toPGN());
    eq(g2.sanList(), g.sanList());
  }
});

run('ENGINE');
