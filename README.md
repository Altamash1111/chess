# Project Grandmaster

A playable chess app with an original, human-like engine (no Stockfish, no external engine).

## Quick start (no install needed)
Open `dist/index.html` in a browser. It is a single self-contained file; the engine runs in a Web Worker so the UI never freezes.

## Development
    npm install
    npm run dev      # Vite dev server
    node build.mjs   # rebuild standalone dist/index.html (esbuild)
    npm test         # rules + opening book + engine suites
    PLAYWRIGHT_BROWSERS_PATH=... node tests/ui.test.mjs   # headless-browser UI suite
    tests/run.sh tests/strength.test.ts beginner,easy,intermediate,advanced   # strength ladder (slow)

## Features
Levels: Beginner → Grandmaster. Personalities: Aggressive, Positional, Defensive, Tactical, All-Rounder.
Board themes and piece sets, drag/click moves, flip, undo, resign, draw offers, clocks, sounds, FEN/PGN import/export,
opening explorer, opening trainer (Italian, Giuoco Piano, Two Knights, Black alternatives), analysis with eval bar,
game review with blunder detection.

## Architecture
`src/chess` rules · `src/engine` search/eval/human layer/book (UI-independent) · `src/ui` React app.

## Honest notes
- chess.js could not be installed offline, so the rules library is my own (`src/chess`), validated by perft on 6 standard positions.
- The Vite dev/build path (`npm run dev`) is configured but was NOT run in the build environment (no network); the esbuild standalone build was tested.
- Results: rules/book/engine suites pass; 24/24 headless-Chromium UI tests pass; Grandmaster scored 8/8 vs Beginner–Advanced (checkmates, ~4–5 s/move).
- Strength is not rated against external engines; I make no Elo claim. Expect a strong club-level-or-better tactical player, not Stockfish.

## Deploying to Vercel (via GitHub)
1. Push this folder to a GitHub repo (the root of the repo must contain `package.json`).
2. In Vercel: Add New Project, import the repo. Framework preset: Vite (auto-detected; `vercel.json` also sets it).
3. Build command `npm run build` (runs `vite build`), output directory `dist`. No environment variables needed.
Type checking is a separate step (`npm run typecheck`) and does not block the deploy.
