import { Position, START_FEN } from '../src/chess/position';
import { Searcher } from '../src/engine/search';

const s = new Searcher();
const cases: [string, string, string][] = [
  ['start', START_FEN, ''],
  ['mate in 1 (back rank)', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8'],
  ['mate in 2', 'r5rk/5p1p/5R2/4B3/8/8/7P/7K w - - 0 1', ''],
  ['win queen (fork)', 'r3k3/8/8/8/3q4/8/5N2/4K3 w - - 0 1', ''],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', ''],
];
for (const [name, fen, want] of cases) {
  const pos = Position.fromFen(fen);
  const r = s.search(pos, { maxDepth: 30, softMs: 2000, hardMs: 2500 });
  console.log(name.padEnd(24), pos.moveToUci(r.bestMove), 'score', r.lines[0].score, 'depth', r.depth, 'nodes', r.nodes, 'nps', Math.round(r.nodes / Math.max(1, r.timeMs) * 1000), want ? (pos.moveToUci(r.bestMove) === want ? 'OK' : 'WANT ' + want) : '');
  if (pos.fen() !== fen.split(' ').slice(0,4).join(' ') + ' ' + pos.fen().split(' ').slice(4).join(' ')) console.log('  !! position changed', pos.fen());
}
