import type { MoveRequest, AnalyzeRequest, AnalysisResult } from './core';
import type { HumanDecision } from './human';

declare const __WORKER_SOURCE__: string | undefined;

function createWorker(): Worker {
  // Standalone build: worker source is inlined. Vite dev/build: use the module worker URL.
  if (typeof __WORKER_SOURCE__ !== 'undefined') {
    const blob = new Blob([__WORKER_SOURCE__], { type: 'text/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }
  return new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
}

export interface Pending<T> { promise: Promise<T>; cancel: () => void; }

/** Thin promise wrapper over the engine Web Worker. Cancelling terminates the worker and restarts it. */
export class EngineClient {
  private worker: Worker | null = null;
  private seq = 0;
  private handlers = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void; progress?: (v: any) => void }>();

  private ensure(): Worker {
    if (!this.worker) {
      this.worker = createWorker();
      this.worker.onmessage = (ev) => {
        const m = ev.data;
        const h = this.handlers.get(m.id);
        if (!h) return;
        if (m.type === 'progress') h.progress?.(m.result);
        else if (m.type === 'done') { this.handlers.delete(m.id); h.resolve(m.result); }
        else if (m.type === 'error') { this.handlers.delete(m.id); h.reject(new Error(m.error)); }
      };
      this.worker.onerror = (e) => {
        for (const h of this.handlers.values()) h.reject(new Error(e.message || 'Engine worker error'));
        this.handlers.clear();
      };
    }
    return this.worker;
  }

  private send<T>(type: string, payload?: unknown, progress?: (v: any) => void): Pending<T> {
    const id = ++this.seq;
    const w = this.ensure();
    let rejectFn: (e: any) => void = () => {};
    const promise = new Promise<T>((resolve, reject) => {
      rejectFn = reject;
      this.handlers.set(id, { resolve, reject, progress });
      w.postMessage({ id, type, payload });
    });
    const cancel = () => {
      if (this.handlers.has(id)) {
        this.handlers.delete(id);
        rejectFn(new Error('cancelled'));
        this.restart();
      }
    };
    return { promise, cancel };
  }

  restart() {
    for (const h of this.handlers.values()) h.reject(new Error('cancelled'));
    this.handlers.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  chooseMove(req: MoveRequest) { return this.send<HumanDecision>('move', req); }
  respondToDraw(req: MoveRequest) { return this.send<{ accept: boolean; score: number; reason: string }>('draw', req); }
  analyze(req: AnalyzeRequest, onProgress?: (r: AnalysisResult) => void) { return this.send<AnalysisResult>('analyze', req, onProgress); }
  review(startFen: string, moves: string[], depth: number, timeMs: number, onProgress?: (p: { index: number; total: number; analysis: AnalysisResult }) => void) {
    return this.send<AnalysisResult[]>('review', { startFen, moves, depth, timeMs }, onProgress);
  }
  newGame() { return this.send<boolean>('newGame'); }
  dispose() { this.restart(); }
}
