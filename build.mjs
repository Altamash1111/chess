// Standalone build: bundles the app and the engine worker into ONE html file (dist/index.html)
// that works offline by double-clicking it. Needs only esbuild.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const common = { bundle: true, minify: true, target: 'es2022', logLevel: 'error', jsx: 'automatic', outdir: 'dist-tmp' };

const worker = await build({ ...common, entryPoints: ['src/engine/engine.worker.ts'], format: 'iife', write: false });
const workerSource = worker.outputFiles[0].text;

const app = await build({
  ...common, entryPoints: ['src/main.tsx'], format: 'iife', write: false,
  define: { __WORKER_SOURCE__: JSON.stringify(workerSource), 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
});
let js = '', css = '';
for (const f of app.outputFiles) { if (f.path.endsWith('.css')) css = f.text; else js = f.text; }

const html = readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="/src/main.tsx"></script>', '')
  .replace('</head>', `<style>${css}</style></head>`)
  .replace('</body>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB (worker ${(workerSource.length / 1024).toFixed(0)} KB inlined)`);
