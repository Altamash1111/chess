import React from 'react';
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from '../chess/position';

// Original Staunton-style silhouettes drawn on a 100x100 canvas.
const BASE = 'M24 80 h52 q4 0 4 4 v3 q0 4 -4 4 h-52 q-4 0 -4 -4 v-3 q0 -4 4 -4z';
const BASE2 = 'M28 74 h44 q3 0 3 3 v3 h-50 v-3 q0 -3 3 -3z';

interface Shape { body: string[]; detail: string[]; dots?: [number, number, number][] }

export const SHAPES: Record<number, Shape> = {
  [PAWN]: {
    body: ['M50 19 a11 11 0 1 0 0.01 0z', 'M35 46 q15 -7 30 0 q2 4 -1 6.5 h-28 q-3 -2.5 -1 -6.5z', 'M40 52 C40 62 36 69 30 74 h40 C64 69 60 62 60 52z', BASE2, BASE],
    detail: [],
  },
  [ROOK]: {
    body: ['M28 15 h10 v8 h7 v-8 h10 v8 h7 v-8 h10 v26 q0 2 -2 3 h-40 q-2 -1 -2 -3z', 'M31 44 h38 v6 h-38z', 'M35 50 h30 l4 24 h-38z', BASE2, BASE],
    detail: ['M28 38 h44', 'M36 58 h28'],
  },
  [BISHOP]: {
    body: ['M50 8 a5.5 5.5 0 1 0 0.01 0z', 'M50 18 C63 27 68 39 63 50 C61 54 58 56 58 56 h-16 s-3 -2 -5 -6 C32 39 37 27 50 18z', 'M35 56 h30 q3 0 3 3 q0 3 -3 3 h-30 q-3 0 -3 -3 q0 -3 3 -3z', 'M42 62 C42 68 38 71 32 74 h36 C62 71 58 68 58 62z', BASE2, BASE],
    detail: ['M44 31 L55 43'],
  },
  [QUEEN]: {
    body: ['M26 52 L21 24 L36 40 L40 18 L50 38 L60 18 L64 40 L79 24 L74 52 q-24 6 -48 0z', 'M30 54 h40 q3 0 3 3 q0 3 -3 3 h-40 q-3 0 -3 -3 q0 -3 3 -3z', 'M35 60 h30 l5 14 h-40z', BASE2, BASE],
    detail: ['M32 66 h36'],
    dots: [[21, 22, 4.2], [40, 15, 4.2], [60, 15, 4.2], [79, 22, 4.2], [50, 10, 4.6]],
  },
  [KING]: {
    body: ['M46 5 h8 v7 h7 v8 h-7 v7 h-8 v-7 h-7 v-8 h7z', 'M30 54 C28 40 36 29 50 29 C64 29 72 40 70 54z', 'M28 54 h44 q3 0 3 3 q0 3 -3 3 h-44 q-3 0 -3 -3 q0 -3 3 -3z', 'M35 60 h30 l6 14 h-42z', BASE2, BASE],
    detail: ['M36 44 q14 -6 28 0'],
  },
  [KNIGHT]: {
    body: [
      'M25 74 C25 63 30 57 37 52 C41 49 43 47 42 44 C38 46 33 50 29 51 C22 53 15 50 14 45 C16 39 24 33 31 27 C36 23 40 19 42 13 L48 6 L51 15 C62 18 72 28 74 43 C76 55 74 65 75 74z',
      BASE2, BASE,
    ],
    detail: ['M53 17 C63 24 68 36 67 52', 'M21 46 q2 -1 4 0'],
    dots: [[38, 29, 2.3]],
  },
};


// Flat, rounded "neo" silhouettes (original drawings): chunky, high-contrast, readable at small sizes.
const FBASE = 'M27 77 h46 a5 5 0 0 1 5 5 v3 a3 3 0 0 1 -3 3 h-50 a3 3 0 0 1 -3 -3 v-3 a5 5 0 0 1 5 -5z';
const collar = (x1: number, x2: number, y: number) => `M${x1} ${y} h${x2 - x1} a3.5 3.5 0 0 1 0 7 h-${x2 - x1} a3.5 3.5 0 0 1 0 -7z`;
export const FLAT_SHAPES: Record<number, Shape> = {
  [PAWN]: {
    body: ['M50 17 a12.5 12.5 0 1 1 -0.01 0z', collar(36, 64, 44), 'M41 51 C41 64 37 71 29 77 h42 C63 71 59 64 59 51z', FBASE],
    detail: [],
  },
  [ROOK]: {
    body: ['M25 16 h13 v9 h6 v-9 h12 v9 h6 v-9 h13 v26 q0 3 -3 3 h-44 q-3 0 -3 -3z', collar(31, 69, 45), 'M35 52 h30 l5 25 h-40z', FBASE],
    detail: ['M28 33 h44'],
  },
  [BISHOP]: {
    body: ['M50 15 C64 25 68 37 61 46 C59 49 57 50 57 50 h-14 s-2 -1 -4 -4 C32 37 36 25 50 15z', 'M50 5 a5 5 0 1 1 -0.01 0z', collar(35, 65, 51), 'M42 58 C42 67 37 72 30 77 h40 C63 72 58 67 58 58z', FBASE],
    detail: ['M45 29 L56 40'],
  },
  [QUEEN]: {
    body: ['M26 51 L20 25 L36 38 L41 19 L50 36 L59 19 L64 38 L80 25 L74 51z', collar(30, 70, 50), 'M35 57 h30 l5 20 h-40z', FBASE],
    detail: [],
    dots: [[20, 21, 4.4], [41, 14, 4.4], [59, 14, 4.4], [80, 21, 4.4], [50, 9, 4.6]],
  },
  [KING]: {
    body: ['M46 4 h8 v7 h7 v8 h-7 v8 h-8 v-8 h-7 v-8 h7z', 'M27 52 C25 38 35 27 50 27 C65 27 75 38 73 52z', collar(29, 71, 50), 'M35 57 h30 l6 20 h-42z', FBASE],
    detail: [],
  },
  [KNIGHT]: {
    body: [
      'M26 77 C26 64 31 57 38 52 C42 49 44 47 43 44 C38 46 33 50 29 51 C22 53 15 50 14 45 C16 39 24 33 31 27 C36 23 40 19 42 13 L48 5 L52 14 C63 17 73 28 75 43 C77 56 75 67 76 77z',
      FBASE,
    ],
    detail: [],
    dots: [[38, 29, 2.6]],
  },
};

// "Atelier": original shaded set - tall lathe-style silhouettes with soft gradient volume.
const ABASE = ['M23 90 v-5 q0 -4 4 -4 h46 q4 0 4 4 v5z', 'M30 81 q1 -5 6 -5 h28 q5 0 6 5z'];
const pill = (x1: number, x2: number, y: number, h = 7) => `M${x1} ${y} h${x2 - x1} a${h / 2} ${h / 2} 0 0 1 0 ${h} h-${x2 - x1} a${h / 2} ${h / 2} 0 0 1 0 -${h}z`;
export const ATELIER_SHAPES: Record<number, Shape> = {
  [PAWN]: { body: ['M42 46 C43 60 40 68 32 76 h36 C60 68 57 60 58 46z', pill(36, 64, 40), 'M50 15.5 a10.5 10.5 0 1 1 -0.01 0z', ...ABASE], detail: ['M44.5 22 a6.5 6.5 0 0 1 4.5 -4', 'M44 52 C44.5 60 42 66 37 72'] },
  [ROOK]: { body: ['M36 49 L33 76 h34 L64 49z', pill(31, 69, 43, 6.5), 'M27 17 h10 v7 h6 v-7 h14 v7 h6 v-7 h10 v22 a3 3 0 0 1 -3 3 h-40 a3 3 0 0 1 -3 -3z', ...ABASE], detail: ['M31 20 v16', 'M38 54 L36 70'] },
  [BISHOP]: { body: ['M42 55 C42 65 38 71 31 76 h38 C62 71 58 65 58 55z', pill(36, 64, 49), 'M50 12 C63 22 68 35 62 45 C60 48 58 49 58 49 h-16 s-2 -1 -4 -4 C32 35 37 22 50 12z', 'M50 6 a4.5 4.5 0 1 1 -0.01 0z', ...ABASE], detail: ['M47 24 L56 35', 'M42 24 C38 30 37 36 40 42', 'M44 58 C44 65 41 70 37 73'] },
  [QUEEN]: { body: ['M37 54 C38 64 35 70 30 76 h40 C65 70 62 64 63 54z', pill(30, 70, 48), 'M28 49 L21 24 L36 36 L42 17 L50 34 L58 17 L64 36 L79 24 L72 49z', ...ABASE], dots: [[21, 20, 4], [42, 13, 4], [58, 13, 4], [79, 20, 4], [50, 9, 4.2]], detail: ['M31 44 L27 30', 'M40 58 C40 65 37 70 33 73'] },
  [KING]: { body: ['M36 54 C37 64 34 70 29 76 h42 C66 70 63 64 64 54z', pill(28, 72, 48), 'M26 48 C23 36 33 26 50 26 C67 26 77 36 74 48z', 'M46.5 3 h7 v6 h6 v7 h-6 v6 h-7 v-6 h-6 v-7 h6z', ...ABASE], detail: ['M32 42 C32 36 36 32 41 30', 'M40 58 C40 65 37 70 33 73'] },
  [KNIGHT]: { body: ['M30 76 C31 62 34 54 41 47 C45 43 46 40 44 37 C40 38 36 41 33 43 C29 45 23 43 21 39 C20 35 25 30 29 25 C33 21 36 17 37 11 L43 16 C46 12 49 9 51 7 L53 17 C66 20 76 32 78 48 C79 60 77 69 78 76z', ...ABASE], dots: [[41, 28, 2.2]], detail: ['M56 23 C66 29 70 41 69 57', 'M24 37 l2 1', 'M34 56 C37 52 40 50 43 49'] },
};


// "Classic 2D": flat, solid-colour silhouettes (no shading). King is the tallest piece.
const CB = (y = 82) => `M22 ${y} h56 a4 4 0 0 1 0 8 h-56 a4 4 0 0 1 0 -8z`;
const cp = (x1: number, x2: number, y: number, h = 6) => `M${x1} ${y} h${x2 - x1} a${h / 2} ${h / 2} 0 0 1 0 ${h} h-${x2 - x1} a${h / 2} ${h / 2} 0 0 1 0 -${h}z`;
export const CLASSIC_SHAPES: Record<number, Shape> = {
  [PAWN]: { body: ['M42 48 C43 62 40 72 33 82 H67 C60 72 57 62 58 48z', cp(36, 64, 42), 'M50 19 a11 11 0 1 1 -0.01 0z', CB()], detail: [] },
  [ROOK]: { body: ['M35 49 L32 82 h36 L65 49z', cp(30, 70, 43), 'M28 16 h10 v8 h6 v-8 h12 v8 h6 v-8 h10 v24 q0 3 -3 3 h-38 q-3 0 -3 -3z', CB()], detail: [] },
  [BISHOP]: { body: ['M42 54 C42 64 38 72 32 82 H68 C62 72 58 64 58 54z', cp(36, 64, 48), 'M50 12 C63 22 67 34 62 44 C60 47 58 48 58 48 H42 C42 48 40 47 38 44 C33 34 37 22 50 12z', 'M50 4.5 a4.5 4.5 0 1 1 -0.01 0z', CB()], detail: ['M47 24 L56 35'] },
  [QUEEN]: { body: ['M37 55 C38 65 36 72 30 82 H70 C64 72 62 65 63 55z', cp(29, 71, 49), 'M27 50 L20 26 L31 38 L35 20 L42 38 L50 16 L58 38 L65 20 L69 38 L80 26 L73 50z', CB()], dots: [[20, 23, 3.8], [35, 16.5, 3.8], [50, 12.5, 4.2], [65, 16.5, 3.8], [80, 23, 3.8]], detail: [] },
  [KING]: { body: ['M38 53 C40 64 38 72 30 82 H70 C62 72 60 64 62 53z', cp(30, 70, 47), 'M50 21 C59 21 64.5 27 64.5 35 C64.5 42 62 47 62 47 H38 C38 47 35.5 42 35.5 35 C35.5 27 41 21 50 21z', 'M47.2 1.5 h5.6 v6 h6 v6 h-6 v8 h-5.6 v-8 h-6 v-6 h6z', CB()], detail: ['M37 38 H63'] },
  [KNIGHT]: { body: ['M30 82 C31 66 34 56 41 47 C45 43 46 40 44 37 C40 38 36 41 33 43 C29 45 23 43 21 39 C20 35 25 30 29 25 C33 21 36 17 37 11 L43 16 C46 12 49 9 51 7 L53 17 C66 20 76 32 78 48 C79 62 77 72 78 82z', CB()], dots: [[41, 28, 2.4]], detail: ['M56 23 C66 29 70 41 69 57'] },
};

export interface PieceStyle {
  id: string; name: string; kind: 'svg' | 'glyph'; flat?: boolean; atelier?: boolean; classic?: boolean;
  white: { fill: string; stroke: string; detail: string; sw: number };
  black: { fill: string; stroke: string; detail: string; sw: number };
}

export const PIECE_SETS: PieceStyle[] = [
  { id: 'classic2d', name: 'Classic 2D (flat)', kind: 'svg', classic: true,
    white: { fill: '#ffffff', stroke: '#2b2d33', detail: '#2b2d33', sw: 3 },
    black: { fill: '#3b3d44', stroke: '#15161a', detail: '#b9bcc6', sw: 3 } },
  { id: 'atelier', name: 'Atelier (shaded)', kind: 'svg', atelier: true,
    white: { fill: 'url(#gr-atl-w)', stroke: '#3d4350', detail: '#aeb4c0', sw: 2.2 },
    black: { fill: 'url(#gr-atl-b)', stroke: '#101216', detail: '#8b919c', sw: 2.2 } },
  { id: 'neo', name: 'Neo Flat (default)', kind: 'svg', flat: true,
    white: { fill: '#ffffff', stroke: '#3c3c3c', detail: '#9a9a9a', sw: 2.6 },
    black: { fill: '#505050', stroke: '#262626', detail: '#8e8e8e', sw: 2.6 } },
  { id: 'staunton', name: 'Staunton Ivory & Ebony', kind: 'svg',
    white: { fill: 'url(#gr-ivory)', stroke: '#4a3b22', detail: '#8a7650', sw: 2.2 },
    black: { fill: 'url(#gr-ebony)', stroke: '#050505', detail: '#8d8d99', sw: 2.2 } },
  { id: 'boxwood', name: 'Boxwood & Rosewood', kind: 'svg',
    white: { fill: 'url(#gr-boxwood)', stroke: '#5a3d12', detail: '#946b2a', sw: 2.2 },
    black: { fill: 'url(#gr-rosewood)', stroke: '#1c0b07', detail: '#b98a73', sw: 2.2 } },
  { id: 'tournament', name: 'Tournament (flat)', kind: 'svg',
    white: { fill: '#fafafa', stroke: '#1b1b1f', detail: '#55555e', sw: 2.8 },
    black: { fill: '#2b2b31', stroke: '#000000', detail: '#c9c9d1', sw: 2.8 } },
  { id: 'glyph', name: 'Classic Glyphs', kind: 'glyph',
    white: { fill: '#ffffff', stroke: '#111', detail: '#111', sw: 1.2 },
    black: { fill: '#111111', stroke: '#111', detail: '#111', sw: 1.2 } },
];
export const getPieceSet = (id: string) => PIECE_SETS.find(p => p.id === id) ?? PIECE_SETS[0];

const GLYPH: Record<number, string> = { [KING]: '♚', [QUEEN]: '♛', [ROOK]: '♜', [BISHOP]: '♝', [KNIGHT]: '♞', [PAWN]: '♟' };

/** Global SVG gradients; render once near the app root. */
export function PieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="gr-atl-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="0.55" stopColor="#f1f3f7" /><stop offset="1" stopColor="#c9ced8" /></linearGradient>
        <linearGradient id="gr-atl-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6e747e" /><stop offset="0.5" stopColor="#40444c" /><stop offset="1" stopColor="#24272d" /></linearGradient>
        <linearGradient id="gr-ivory" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="0.55" stopColor="#f0e4c8" /><stop offset="1" stopColor="#cdbb93" /></linearGradient>
        <linearGradient id="gr-ebony" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b5b66" /><stop offset="0.5" stopColor="#2a2a32" /><stop offset="1" stopColor="#0d0d11" /></linearGradient>
        <linearGradient id="gr-boxwood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbe7b3" /><stop offset="0.55" stopColor="#ecc779" /><stop offset="1" stopColor="#c28f3c" /></linearGradient>
        <linearGradient id="gr-rosewood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a4a3a" /><stop offset="0.5" stopColor="#5a2a20" /><stop offset="1" stopColor="#2b100b" /></linearGradient>
      </defs>
    </svg>
  );
}

export const PieceSvg = React.memo(function PieceSvg({ type, color, setId, className }: { type: number; color: 0 | 1; setId: string; className?: string }) {
  const set = getPieceSet(setId);
  const st = color === 0 ? set.white : set.black;
  if (set.kind === 'glyph') {
    return (
      <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
        <text x="50" y="80" textAnchor="middle" fontSize="88" fill={st.fill} stroke={color === 0 ? '#111' : '#000'} strokeWidth={color === 0 ? 3 : 0.5} style={{ fontFamily: '"Segoe UI Symbol","Noto Sans Symbols 2","Apple Symbols","DejaVu Sans",serif' }}>{GLYPH[type]}</text>
      </svg>
    );
  }
  const shape = (set.classic ? CLASSIC_SHAPES : set.atelier ? ATELIER_SHAPES : set.flat ? FLAT_SHAPES : SHAPES)[type];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g fill={st.fill} stroke={st.stroke} strokeWidth={st.sw} strokeLinejoin="round" strokeLinecap="round">
        {shape.body.map((d, i) => <path key={i} d={d} />)}
        {shape.dots?.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
      </g>
      <g fill="none" stroke={st.detail} strokeWidth={1.6} strokeLinecap="round" opacity="0.85">
        {shape.detail.map((d, i) => <path key={i} d={d} />)}
      </g>
      {/* soft highlight for volume */}
      {set.id !== 'tournament' && !set.flat && !set.atelier && !set.classic && <ellipse cx="42" cy="30" rx="7" ry="14" fill="#fff" opacity={color === 0 ? 0.18 : 0.09} transform="rotate(-18 42 30)" />}
    </svg>
  );
});
