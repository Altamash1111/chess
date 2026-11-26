import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PieceSvg } from './pieces';
import { squareToDisplay, displayToSquare } from './orientation';
import { typeOf, colorOf, QUEEN, ROOK, BISHOP, KNIGHT, sqName } from '../chess/position';

export interface Arrow { from: number; to: number; color?: string; }
export interface Mark { sq: number; color: string; label?: string; badge?: string; }

export interface BoardProps {
  board: Int8Array;
  orientation: 0 | 1;
  lastMove: { from: number; to: number } | null;
  checkSq: number;
  pieceSet: string;
  showCoords: boolean;
  showLegal: boolean;
  animate: boolean;
  /** whether this piece may be picked up */
  canMovePiece: (sq: number) => boolean;
  legalTargets: (sq: number) => number[];
  isCapture: (from: number, to: number) => boolean;
  onMove: (from: number, to: number, viaDrag: boolean) => void;
  promotion: { from: number; to: number } | null;
  promotionColor: 0 | 1;
  onPromote: (piece: number) => void;
  onCancelPromotion: () => void;
  arrows?: Arrow[];
  marks?: Mark[];
  /** changes whenever the position changes (used to clear selection) */
  positionKey: string;
}

const PROMO_PIECES = [QUEEN, ROOK, BISHOP, KNIGHT];

export function Board(p: BoardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(-1);
  const [drag, setDrag] = useState<{ sq: number; x: number; y: number; active: boolean } | null>(null);
  const dragRef = useRef<{ sq: number; startX: number; startY: number; wasSelected: boolean; active: boolean } | null>(null);
  const selRef = useRef(-1);
  selRef.current = selected;

  useEffect(() => { setSelected(-1); setDrag(null); dragRef.current = null; }, [p.positionKey]);

  const squareAt = useCallback((clientX: number, clientY: number): number => {
    const el = ref.current; if (!el) return -1;
    const r = el.getBoundingClientRect();
    const col = Math.floor(((clientX - r.left) / r.width) * 8);
    const row = Math.floor(((clientY - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    return displayToSquare(col, row, p.orientation);
  }, [p.orientation]);

  const targets = selected >= 0 ? p.legalTargets(selected) : [];

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (p.promotion) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (sq < 0) return;
    const sel = selRef.current;
    // click-to-move on a highlighted target happens on pointer up
    if (p.canMovePiece(sq)) {
      dragRef.current = { sq, startX: e.clientX, startY: e.clientY, wasSelected: sel === sq, active: false };
      setSelected(sq);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else {
      dragRef.current = { sq, startX: e.clientX, startY: e.clientY, wasSelected: false, active: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.active && p.canMovePiece(d.sq) && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5) d.active = true;
    if (d.active) {
      const r = ref.current!.getBoundingClientRect();
      setDrag({ sq: d.sq, x: e.clientX - r.left, y: e.clientY - r.top, active: true });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const to = squareAt(e.clientX, e.clientY);
    if (d.active) {
      if (to >= 0 && to !== d.sq && p.legalTargets(d.sq).includes(to)) { setSelected(-1); p.onMove(d.sq, to, true); }
      else setSelected(to === d.sq ? d.sq : -1);
      return;
    }
    // click
    const sel = selRef.current;
    if (to < 0) return;
    if (sel >= 0 && sel !== to && p.legalTargets(sel).includes(to)) { setSelected(-1); p.onMove(sel, to, false); return; }
    if (p.canMovePiece(to)) { setSelected(d.wasSelected ? -1 : to); return; }
    setSelected(-1);
  };

  const cells: React.ReactNode[] = [];
  const lm = p.lastMove;
  const slide = (sq: number): React.CSSProperties | undefined => {
    if (!p.animate || !lm || sq !== lm.to) return undefined;
    const a = squareToDisplay(lm.from, p.orientation), b = squareToDisplay(lm.to, p.orientation);
    return { ['--dx' as any]: `${(a.col - b.col) * 100}%`, ['--dy' as any]: `${(a.row - b.row) * 100}%` };
  };

  for (let sq = 0; sq < 64; sq++) {
    const { col, row } = squareToDisplay(sq, p.orientation);
    const piece = p.board[sq];
    const dark = ((sq & 7) + (sq >> 3)) % 2 === 0;
    const isLast = lm && (lm.from === sq || lm.to === sq);
    const isTarget = targets.includes(sq);
    const cap = isTarget && (piece !== 0 || p.isCapture(selected, sq));
    const mark = p.marks?.find(m => m.sq === sq);
    const cls = ['sq', dark ? 'dark' : 'light', isLast ? 'last' : '', sq === selected ? 'selected' : '', sq === p.checkSq ? 'check' : ''].filter(Boolean).join(' ');
    cells.push(
      <div key={sq} className={cls} data-sq={sqName(sq)} style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` }}>
        {mark && <div className="mark" style={{ background: mark.color }} />}
        {mark?.label && <span className="mark-badge" style={{ background: mark.badge ?? '#555' }}>{mark.label}</span>}
        {p.showCoords && col === 0 && <span className="coord rank">{(sq >> 3) + 1}</span>}
        {p.showCoords && row === 7 && <span className="coord file">{'abcdefgh'[sq & 7]}</span>}
        {isTarget && p.showLegal && <div className={cap ? 'target capture' : 'target'} />}
      </div>
    );
  }

  const pieces: React.ReactNode[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const piece = p.board[sq];
    if (!piece) continue;
    const { col, row } = squareToDisplay(sq, p.orientation);
    const dragging = drag?.active && drag.sq === sq;
    const st = slide(sq);
    pieces.push(
      <div key={sq + ':' + piece} className={`piece${dragging ? ' dragging-src' : ''}${st ? ' slide' : ''}${p.canMovePiece(sq) ? ' movable' : ''}`}
        data-piece={`${colorOf(piece) === 0 ? 'w' : 'b'}${'_pnbrqk'[typeOf(piece)]}`} data-on={sqName(sq)}
        style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, ...st }}>
        <PieceSvg type={typeOf(piece)} color={colorOf(piece) as 0 | 1} setId={p.pieceSet} />
      </div>
    );
  }

  // arrows
  const center = (sq: number) => { const { col, row } = squareToDisplay(sq, p.orientation); return { x: col + 0.5, y: row + 0.5 }; };

  return (
    <div className="board-wrap">
      <div className="board" ref={ref} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; setDrag(null); }} data-orientation={p.orientation === 0 ? 'white' : 'black'} data-testid="board">
        {cells}
        {pieces}
        {p.arrows && p.arrows.length > 0 && (
          <svg className="arrows" viewBox="0 0 8 8">
            <defs>
              {Array.from(new Set(p.arrows.map(a => a.color ?? '#e9a23b'))).map(c => (
                <marker key={c} id={`ah-${c.slice(1)}`} markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0 0 L4 2 L0 4z" fill={c} /></marker>
              ))}
            </defs>
            {p.arrows.map((a, i) => {
              const f = center(a.from), t = center(a.to), c = a.color ?? '#e9a23b';
              const dx = t.x - f.x, dy = t.y - f.y, len = Math.hypot(dx, dy) || 1;
              const ex = t.x - (dx / len) * 0.28, ey = t.y - (dy / len) * 0.28;
              return <line key={i} x1={f.x} y1={f.y} x2={ex} y2={ey} stroke={c} strokeWidth="0.15" strokeLinecap="round" opacity="0.85" markerEnd={`url(#ah-${c.slice(1)})`} />;
            })}
          </svg>
        )}
        {drag?.active && (
          <div className="piece dragging" style={{ left: drag.x, top: drag.y }}>
            <PieceSvg type={typeOf(p.board[drag.sq])} color={colorOf(p.board[drag.sq]) as 0 | 1} setId={p.pieceSet} />
          </div>
        )}
        {p.promotion && (
          <div className="promo-overlay" onClick={p.onCancelPromotion}>
            <div className="promo-box" onClick={e => e.stopPropagation()} data-testid="promotion">
              {PROMO_PIECES.map(pc => (
                <button key={pc} className="promo-btn" data-promo={'_pnbrqk'[pc]} onClick={() => p.onPromote(pc)} aria-label={`Promote to ${['', '', 'knight', 'bishop', 'rook', 'queen'][pc]}`}>
                  <PieceSvg type={pc} color={p.promotionColor} setId={p.pieceSet} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
