import React, { useEffect, useRef } from 'react';
import { GameController } from './controller';
import { PieceSvg } from './pieces';
import { typeOf, colorOf } from '../chess/position';
import { winPercent, CLASS_LABEL, MoveClass } from '../engine/explain';
import type { ReviewMove } from './analysis';
import { useSyncExternalStore } from 'react';

export function useCtl(ctl: GameController) {
  useSyncExternalStore(ctl.subscribe, ctl.getVersion);
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return s.toFixed(1);
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function Clock({ ctl, color }: { ctl: GameController; color: 0 | 1 }) {
  const c = ctl.clock;
  if (!c.enabled) return null;
  const ms = c.ms[color];
  const cls = ['clock', c.running === color ? 'running' : '', ms < 10000 ? 'low' : '', c.flagged === color ? 'flagged' : ''].filter(Boolean).join(' ');
  return <div className={cls} data-testid={`clock-${color === 0 ? 'white' : 'black'}`}>{fmtClock(ms)}</div>;
}

export function Captured({ ctl, color }: { ctl: GameController; color: 0 | 1 }) {
  const pieces = ctl.captured(color).sort((a, b) => typeOf(b) - typeOf(a));
  const diff = ctl.materialDiff() * (color === 0 ? 1 : -1);
  return (
    <div className="captured" data-testid={`captured-${color === 0 ? 'white' : 'black'}`}>
      {pieces.map((p, i) => <span key={i} className="cap-piece"><PieceSvg type={typeOf(p)} color={colorOf(p) as 0 | 1} setId="tournament" /></span>)}
      {diff > 0 && <span className="mat-diff">+{diff}</span>}
    </div>
  );
}

export function EvalBar({ whiteCp, orientation }: { whiteCp: number | null; orientation: 0 | 1 }) {
  const pct = whiteCp === null ? 50 : Math.abs(whiteCp) > 29000 ? (whiteCp > 0 ? 100 : 0) : winPercent(whiteCp);
  const label = whiteCp === null ? '…' : Math.abs(whiteCp) > 29000 ? (whiteCp > 0 ? 'M' : '-M') : (Math.abs(whiteCp) / 100).toFixed(1);
  const whiteOnBottom = orientation === 0;
  return (
    <div className="evalbar" data-testid="evalbar" title={whiteCp === null ? 'Evaluating…' : `Evaluation ${whiteCp > 0 ? '+' : ''}${(whiteCp / 100).toFixed(2)}`}>
      <div className="eval-fill" style={{ [whiteOnBottom ? 'bottom' : 'top']: 0, height: `${pct}%` }} />
      <span className={`eval-label ${pct >= 50 ? (whiteOnBottom ? 'bot' : 'top') : (whiteOnBottom ? 'top' : 'bot')}`}>{label}</span>
    </div>
  );
}

export const CLASS_ICON: Record<MoveClass, string> = {
  brilliant: '!!', best: '★', excellent: '!', good: '✓', book: '📖', inaccuracy: '?!', mistake: '?', blunder: '??', miss: '✗',
};

export function MoveList({ ctl, review, onSelect }: { ctl: GameController; review?: ReviewMove[]; onSelect?: (ply: number) => void }) {
  const plies = ctl.game.plies;
  const cur = ctl.viewIndex;
  const endRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cur === 0 && listRef.current) listRef.current.scrollTop = 0;
    else {
      // scroll only the move list itself, never the page (scrollIntoView jumps the whole page on phones)
      const box = listRef.current, el = curRef.current;
      if (box && el) {
        const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        if (top < box.scrollTop) box.scrollTop = top;
        else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight;
      }
    }
  }, [cur, plies.length]);
  const rows: React.ReactNode[] = [];
  const startBlack = ctl.game.startFenTurn() === 1;
  const first = ctl.game.moveNumberOf(0);
  const cell = (i: number) => {
    if (i >= plies.length) return <span className="mv empty" />;
    const r = review?.[i];
    return (
      <button key={i} ref={cur === i + 1 ? curRef : undefined} className={`mv${cur === i + 1 ? ' current' : ''}${r ? ' cls-' + r.cls : ''}`}
        onClick={() => { onSelect ? onSelect(i + 1) : ctl.goTo(i + 1); }} data-ply={i + 1} title={r ? CLASS_LABEL[r.cls] : undefined}>
        {plies[i].san}{r && ['inaccuracy', 'mistake', 'blunder', 'best', 'brilliant'].includes(r.cls) ? <i className={`badge b-${r.cls}`}>{CLASS_ICON[r.cls]}</i> : null}
      </button>
    );
  };
  let i = 0;
  if (startBlack) {
    rows.push(<div className="mv-row" key="first"><span className="mv-num">{first.number}.</span><span className="mv empty">…</span>{cell(0)}</div>);
    i = 1;
  }
  for (; i < plies.length; i += 2) {
    const num = ctl.game.moveNumberOf(i).number;
    rows.push(<div className="mv-row" key={i}><span className="mv-num">{num}.</span>{cell(i)}{cell(i + 1)}</div>);
  }
  return (
    <div className="movelist" data-testid="movelist" ref={listRef}>
      {rows.length === 0 && <div className="muted small">No moves yet.</div>}
      {rows}
      <div ref={endRef} />
    </div>
  );
}

export function NavButtons({ ctl, onNav }: { ctl: GameController; onNav?: () => void }) {
  const n = ctl.plyCount, cur = ctl.viewIndex;
  const go = (f: () => void) => () => { f(); onNav?.(); };
  return (
    <div className="navbtns">
      <button className="btn icon" disabled={cur === 0} onClick={go(() => ctl.goTo(0))} title="First move" aria-label="First move">⏮</button>
      <button className="btn icon" disabled={cur === 0} onClick={go(() => ctl.step(-1))} title="Previous move" aria-label="Previous move">◀</button>
      <button className="btn icon" disabled={cur >= n} onClick={go(() => ctl.step(1))} title="Next move" aria-label="Next move">▶</button>
      <button className="btn icon" disabled={cur >= n} onClick={go(() => ctl.goTo(null))} title="Latest move" aria-label="Latest move">⏭</button>
    </div>
  );
}

export function EvalGraph({ values, current, onPick }: { values: number[]; current: number; onPick: (ply: number) => void }) {
  if (values.length < 2) return null;
  const W = 300, H = 70;
  const pts = values.map((v, i) => {
    const w = Math.abs(v) > 29000 ? (v > 0 ? 100 : 0) : winPercent(v);
    return [i / (values.length - 1) * W, H - w / 100 * H] as const;
  });
  const area = `M0 ${H} ` + pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ` L${W} ${H} Z`;
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg className="evalgraph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={e => {
      const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      onPick(Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)));
    }} data-testid="evalgraph">
      <rect width={W} height={H} fill="#1d2027" />
      <path d={area} fill="#e9e4d4" opacity="0.9" />
      <path d={line} stroke="#b8923b" strokeWidth="1.4" fill="none" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#888" strokeDasharray="3 3" strokeWidth="0.6" />
      <line x1={current / (values.length - 1) * W} x2={current / (values.length - 1) * W} y1="0" y2={H} stroke="#e0584a" strokeWidth="1.5" />
    </svg>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="btn icon" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
