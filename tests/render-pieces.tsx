import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'fs';
import { PieceSvg, PieceDefs, PIECE_SETS } from '../src/ui/pieces';

const types = [1, 2, 3, 4, 5, 6];
const rows = PIECE_SETS.flatMap(s => [0, 1].map(c => ({ s, c })));
const html = renderToStaticMarkup(
  <div>
    <PieceDefs />
    <svg xmlns="http://www.w3.org/2000/svg" width={6 * 110 + 20} height={rows.length * 110 + 20}>
      <rect width="100%" height="100%" fill="#b58863" />
      {rows.map((r, ri) => types.map((t, ti) => (
        <g key={ri + '-' + ti} transform={`translate(${10 + ti * 110},${10 + ri * 110}) scale(1.05)`}>
          <rect width="100" height="100" fill={(ri + ti) % 2 ? '#f0d9b5' : '#b58863'} />
          <PieceSvg type={t} color={r.c as 0 | 1} setId={r.s.id} />
        </g>
      )))}
    </svg>
  </div>
);
// Extract defs + svg and inline gradients
const defs = html.match(/<svg width="0"[\s\S]*?<\/svg>/)![0].replace(/<svg[^>]*>/, '').replace('</svg>', '');
let body = html.match(/<svg xmlns[\s\S]*<\/svg>/)![0];
body = body.replace('<rect width="100%"', defs.replace(/^/, '') + '<rect width="100%"');
// nested svgs need explicit size
body = body.replace(/<svg viewBox="0 0 100 100"/g, '<svg width="100" height="100" viewBox="0 0 100 100"');
writeFileSync('/tmp/pieces.svg', body);
