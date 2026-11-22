// Strength ladder: Grandmaster (real settings) vs weaker levels. Slow (several minutes) — run on demand.
import { EngineCore } from '../src/engine/core';
import { Game } from '../src/chess/game';
import { START_FEN, typeOf, colorOf } from '../src/chess/position';

const core = new EngineCore();
const V = [0, 1, 3, 3, 5, 9, 0];
function material(g: Game) { let s = 0; for (let i = 0; i < 64; i++) { const p = g.pos.board[i]; if (p) s += (colorOf(p) === 0 ? 1 : -1) * V[typeOf(p)]; } return s; }

function play(white: string, black: string, seed: number, maxPlies = 120) {
  const g = new Game(); const moves: string[] = []; let t = 0, n = 0;
  while (!g.status().over && g.plies.length < maxPlies) {
    const lv = g.turn === 0 ? white : black;
    const t0 = Date.now();
    const d = core.chooseMove({ startFen: START_FEN, moves, level: lv, personality: 'allround', seed: seed + g.turn * 13, fastDelay: true });
    if (lv === 'grandmaster') { t += Date.now() - t0; n++; }
    if (g.play(d.move) === null) throw new Error('illegal move ' + d.uci);
    moves.push(d.uci);
  }
  const st = g.status();
  const mat = material(g);
  const res = st.over ? st.result : (mat >= 3 ? '1-0' : mat <= -3 ? '0-1' : '1/2-1/2');
  return { res, plies: g.plies.length, over: st.over, reason: st.reason, mat, avgGm: n ? Math.round(t / n) : 0, pgn: g.sanList().slice(0, 12).join(' ') };
}

const opponents = (process.argv[2] ?? 'beginner,easy,intermediate').split(',');
let gmPts = 0, games = 0;
for (const opp of opponents) {
  for (const gmWhite of [true, false]) {
    const r = play(gmWhite ? 'grandmaster' : opp, gmWhite ? opp : 'grandmaster', 500 + games);
    const score = r.res === '1/2-1/2' ? 0.5 : ((r.res === '1-0') === gmWhite ? 1 : 0);
    gmPts += score; games++;
    console.log(`GM(${gmWhite ? 'W' : 'B'}) vs ${opp.padEnd(12)} ${r.res.padEnd(8)} ${r.over ? r.reason : 'adjudicated (material ' + r.mat + ')'} plies=${r.plies} avgGMmove=${r.avgGm}ms  [${r.pgn}...]`);
  }
}
console.log(`\nGrandmaster score: ${gmPts}/${games}`);
