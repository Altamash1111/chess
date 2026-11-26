import { EngineCore } from '../src/engine/core';
import { Game } from '../src/chess/game';
import { START_FEN } from '../src/chess/position';
const pgn = process.argv[2];
const g = Game.fromPGN(pgn);
const sans = g.sanList();
const core = new EngineCore();
const ev: number[] = []; const best: string[] = [];
const pp = new (g.pos.constructor as any)(); pp.setFen(START_FEN); const uciMoves: string[] = g.plies.map((r: any) => { const u = pp.moveToUci(r.move); pp.make(r.move); return u; });
for (let i = 0; i <= uciMoves.length; i++) {
  const r = core.analyze({ startFen: START_FEN, moves: uciMoves.slice(0, i), maxDepth: 12, timeMs: 1500, multiPV: 1 });
  const stm = i % 2 === 0 ? 1 : -1; // white to move at even i
  ev.push((r.lines[0]?.score ?? 0) * stm); best.push(r.lines[0]?.san ?? '');
}
for (let i = 1; i < ev.length; i++) {
  const mover = i % 2 === 1 ? 'W' : 'B'; const n = Math.ceil(i / 2);
  const delta = (mover === 'W' ? ev[i] - ev[i - 1] : ev[i - 1] - ev[i]);
  console.log(`${n}${mover === 'W' ? '.' : '...'} ${sans[i - 1].padEnd(7)} eval ${(ev[i] / 100).toFixed(2).padStart(6)}  loss ${(Math.max(0, -delta) / 100).toFixed(2)}  best was ${best[i - 1]}`);
}
