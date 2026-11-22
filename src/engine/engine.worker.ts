/// <reference lib="webworker" />
import { EngineCore, MoveRequest, AnalyzeRequest } from './core';

const core = new EngineCore();
const ctx = self as unknown as DedicatedWorkerGlobalScope;

type Msg =
  | { id: number; type: 'move'; payload: MoveRequest }
  | { id: number; type: 'draw'; payload: MoveRequest }
  | { id: number; type: 'analyze'; payload: AnalyzeRequest }
  | { id: number; type: 'review'; payload: { startFen: string; moves: string[]; depth: number; timeMs: number } }
  | { id: number; type: 'newGame' };

ctx.onmessage = (ev: MessageEvent<Msg>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'newGame': core.newGame(); ctx.postMessage({ id: msg.id, type: 'done', result: true }); break;
      case 'move': ctx.postMessage({ id: msg.id, type: 'done', result: core.chooseMove(msg.payload) }); break;
      case 'draw': ctx.postMessage({ id: msg.id, type: 'done', result: core.respondToDraw(msg.payload) }); break;
      case 'analyze': {
        const res = core.analyze(msg.payload, (r) => ctx.postMessage({ id: msg.id, type: 'progress', result: r }));
        ctx.postMessage({ id: msg.id, type: 'done', result: res });
        break;
      }
      case 'review': {
        const { startFen, moves, depth, timeMs } = msg.payload;
        const out: unknown[] = [];
        for (let i = 0; i <= moves.length; i++) {
          const r = core.analyze({ startFen, moves: moves.slice(0, i), maxDepth: depth, timeMs, multiPV: 1 });
          out.push(r);
          ctx.postMessage({ id: msg.id, type: 'progress', result: { index: i, total: moves.length + 1, analysis: r } });
        }
        ctx.postMessage({ id: msg.id, type: 'done', result: out });
        break;
      }
    }
  } catch (e: any) {
    ctx.postMessage({ id: (msg as any).id, type: 'error', error: String(e?.message ?? e) });
  }
};
