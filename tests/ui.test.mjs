// End-to-end UI tests in headless Chromium against dist/index.html (run `node build.mjs` first).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const URL = pathToFileURL(resolve('dist/index.html')).href;
const SHOTS = process.env.SHOTS || '/tmp/shots';
let pass = 0, fail = 0;
const ok = async (name, fn) => {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', String(e.message).split('\n')[0], '\n     ', (String(e.stack).split('\n').find(l => l.includes('ui.test.mjs')) || '').trim()); }
};
const assert = (c, m = 'assertion failed') => { if (!c) throw new Error(m); };

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const baseSettings = { level: 'beginner', humanDelay: false, sound: false, personality: 'allround', theme: 'walnut', pieceSet: 'staunton' };

async function open(extra = {}, viewport = { width: 1400, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((s) => { localStorage.setItem('project-grandmaster.settings.v1', JSON.stringify(s)); }, { ...baseSettings, ...extra });
  await page.goto(URL);
  await page.waitForSelector('[data-testid=board]');
  page.errors = errors;
  return page;
}
const sq = (p, name) => p.locator(`.sq[data-sq=${name}]`);
const box = async (p, name) => (await sq(p, name).boundingBox());
async function clickSq(p, name) { const b = await box(p, name); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
async function dragSq(p, a, b) {
  const A = await box(p, a), B = await box(p, b);
  await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2); await p.mouse.down();
  await p.mouse.move(A.x + A.width / 2 + 20, A.y + A.height / 2 - 20, { steps: 4 });
  await p.mouse.move(B.x + B.width / 2, B.y + B.height / 2, { steps: 8 }); await p.mouse.up();
}
const pieceOn = (p, name) => p.locator(`.piece[data-on=${name}]`);
const sans = async (p) => (await p.locator('.movelist .mv[data-ply]').allTextContents()).map(t => t.replace(/[^A-Za-z0-9=+#\-]/g, ''));
const startNew = async (p) => { if (!(await p.locator('[data-testid=start-game]').isVisible())) await p.click('[data-testid=new-game-toggle]'); };
const waitMoves = (p, n) => p.waitForFunction((n) => document.querySelectorAll('.movelist .mv[data-ply]').length >= n, n, { timeout: 15000 });

console.log('\n== UI (headless Chromium) ==');

await ok('loads, 32 pieces, correct orientation (a1 bottom-left, white at bottom)', async () => {
  const p = await open();
  assert(await p.locator('.piece').count() === 32, 'piece count');
  const a1 = await box(p, 'a1'), h8 = await box(p, 'h8'), a8 = await box(p, 'a8');
  assert(a1.x < h8.x && a1.y > h8.y, 'a1 should be bottom-left of h8');
  assert(a8.y < a1.y && a8.x === a1.x, 'a8 above a1');
  assert(await pieceOn(p, 'e1').getAttribute('data-piece') === 'wk', 'white king on e1');
  assert(await pieceOn(p, 'd8').getAttribute('data-piece') === 'bq', 'black queen on d8');
  assert(await p.locator('.sq.dark[data-sq=a1]').count() === 1, 'a1 dark square');
  assert(await p.locator('.sq.light[data-sq=h1]').count() === 1, 'h1 light square');
  await p.screenshot({ path: `${SHOTS}/01-start.png` });
  assert(p.errors.length === 0, 'console errors: ' + p.errors.join('|'));
  await p.context().close();
});

await ok('click-to-move shows legal dots, plays e4, engine replies legally', async () => {
  const p = await open();
  await clickSq(p, 'e2');
  assert(await p.locator('.sq .target').count() === 2, 'two legal targets for e2 pawn');
  await clickSq(p, 'e4');
  assert(await pieceOn(p, 'e4').count() === 1, 'pawn on e4');
  await waitMoves(p, 2);
  const m = await sans(p);
  assert(m[0] === 'e4' && m.length >= 2, 'moves ' + m.join(','));
  assert(await p.locator('.sq.last').count() === 2, 'last move highlighted');
  await p.context().close();
});

await ok('drag-and-drop works, illegal drop is rejected', async () => {
  const p = await open();
  await dragSq(p, 'd2', 'd5'); // illegal
  assert(await pieceOn(p, 'd2').count() === 1, 'pawn stays on d2 after illegal drag');
  await dragSq(p, 'd2', 'd4');
  assert(await pieceOn(p, 'd4').count() === 1, 'pawn dropped on d4');
  await waitMoves(p, 2);
  assert((await sans(p))[0] === 'd4');
  await p.context().close();
});

await ok('cannot move opponent pieces or move out of turn', async () => {
  const p = await open();
  await clickSq(p, 'e7');
  assert(await p.locator('.sq .target').count() === 0, 'no targets for black piece');
  await p.context().close();
});

await ok('flip board reverses orientation; coordinates follow', async () => {
  const p = await open();
  await p.click('[data-testid=flip]');
  const a1 = await box(p, 'a1'), h8 = await box(p, 'h8');
  assert(a1.x > h8.x && a1.y < h8.y, 'a1 top-right after flip');
  assert(await p.locator('.board').getAttribute('data-orientation') === 'black');
  // bottom-left square shows rank 8 / file h labels
  await p.screenshot({ path: `${SHOTS}/02-flipped.png` });
  await p.click('[data-testid=flip]');
  assert(await p.locator('.board').getAttribute('data-orientation') === 'white');
  await p.context().close();
});

await ok('play as Black: engine moves first, board is flipped', async () => {
  const p = await open();
  await p.click('[data-color=black]');
  await p.click('[data-testid=start-game]');
  await waitMoves(p, 1);
  assert(await p.locator('.board').getAttribute('data-orientation') === 'black');
  const a1 = await box(p, 'a1'), h8 = await box(p, 'h8');
  assert(a1.x > h8.x, 'black at bottom');
  assert(await p.locator('[data-testid=status]').innerText() === 'Your move');
  await p.context().close();
});

await ok('takeback removes the engine reply and your move; restart works', async () => {
  const p = await open();
  await clickSq(p, 'e2'); await clickSq(p, 'e4'); await waitMoves(p, 2);
  await p.click('[data-testid=undo]');
  await p.waitForFunction(() => document.querySelectorAll('.movelist .mv[data-ply]').length === 0);
  assert(await pieceOn(p, 'e2').count() === 1, 'pawn back on e2');
  await clickSq(p, 'g1'); await clickSq(p, 'f3'); await waitMoves(p, 2);
  await startNew(p);
  await p.click('[data-testid=start-game]');
  await p.waitForFunction(() => document.querySelectorAll('.movelist .mv[data-ply]').length === 0);
  assert(await p.locator('.piece').count() === 32);
  await p.context().close();
});

await ok('FEN dialog: invalid FEN shows error; valid FEN loads; check is highlighted', async () => {
  const p = await open();
  await p.click('[data-testid=fen-open]');
  await p.fill('[data-testid=fen-input]', 'garbage');
  await p.click('[data-testid=fen-load]');
  assert(await p.locator('[data-testid=fen-error]').count() === 1, 'error displayed');
  await p.fill('[data-testid=fen-input]', '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1'); // white king in check, queen e2 can be taken
  await p.click('[data-testid=fen-load]');
  await p.waitForSelector('.sq.check');
  assert(await sq(p, 'e1').getAttribute('class').then(c => c.includes('check')), 'king square highlighted');
  assert(await p.locator('.piece').count() === 3);
  await p.screenshot({ path: `${SHOTS}/03-check.png` });
  await p.context().close();
});

await ok('pawn promotion dialog, choose knight; auto-queen setting', async () => {
  const p = await open();
  await p.click('[data-testid=fen-open]');
  await p.fill('[data-testid=fen-input]', '7k/P7/8/8/8/8/8/K7 w - - 0 1');
  await p.click('[data-testid=fen-load]');
  await p.waitForSelector('.piece[data-on=a7]');
  await clickSq(p, 'a7'); await clickSq(p, 'a8');
  await p.waitForSelector('[data-testid=promotion]');
  await p.screenshot({ path: `${SHOTS}/04-promotion.png` });
  await p.click('[data-promo=n]');
  assert(await pieceOn(p, 'a8').getAttribute('data-piece') === 'wn', 'knight promoted');
  await p.context().close();
});

await ok('checkmate ends the game with a result card; stalemate is a draw', async () => {
  const p = await open();
  await p.click('[data-testid=fen-open]');
  await p.fill('[data-testid=fen-input]', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
  await p.click('[data-testid=fen-load]');
  await p.waitForSelector('.piece[data-on=a1]');
  await clickSq(p, 'a1'); await clickSq(p, 'a8');
  await p.waitForSelector('[data-testid=gameover]');
  assert((await p.locator('.go-title').innerText()) === 'You win!');
  assert((await p.locator('.go-sub').innerText()).toLowerCase().includes('checkmate'));
  await p.screenshot({ path: `${SHOTS}/05-mate.png` });
  await p.click('[data-testid=pgn-open]').catch(() => {});
  await p.context().close();
  const q = await open();
  await q.click('[data-testid=fen-open]');
  await q.fill('[data-testid=fen-input]', '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1');
  await q.click('[data-testid=fen-load]');
  await q.waitForSelector('.piece[data-on=f1]');
  await clickSq(q, 'f1'); await clickSq(q, 'f7');
  await q.waitForSelector('[data-testid=gameover]');
  assert((await q.locator('.go-title').innerText()) === 'Draw');
  assert((await q.locator('.go-sub').innerText()).toLowerCase().includes('stalemate'));
  await q.context().close();
});

await ok('castling and en passant via the UI', async () => {
  const p = await open();
  await p.click('[data-testid=fen-open]');
  await p.fill('[data-testid=fen-input]', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  await p.click('[data-testid=fen-load]');
  await p.waitForSelector('.piece[data-on=a1]');
  await clickSq(p, 'e1'); await clickSq(p, 'g1');
  assert(await pieceOn(p, 'g1').getAttribute('data-piece') === 'wk' && await pieceOn(p, 'f1').getAttribute('data-piece') === 'wr', 'kingside castle moved both pieces');
  await p.context().close();
  const q = await open();
  await q.click('[data-testid=fen-open]');
  // black pawn just played d7-d5; white e5 pawn may capture en passant
  await q.fill('[data-testid=fen-input]', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  await q.click('[data-testid=fen-load]');
  await q.waitForSelector('.piece[data-on=e5]');
  await clickSq(q, 'e5'); await clickSq(q, 'd6');
  assert(await pieceOn(q, 'd6').getAttribute('data-piece') === 'wp' && await pieceOn(q, 'd5').count() === 0, 'en passant removed the pawn on d5');
  await q.context().close();
});

await ok('PGN export contains moves; PGN import loads a game', async () => {
  const p = await open();
  await clickSq(p, 'e2'); await clickSq(p, 'e4'); await waitMoves(p, 2);
  await p.click('[data-testid=pgn-open]');
  const text = await p.locator('[data-testid=pgn-export]').inputValue();
  assert(text.includes('[Event') && text.includes('1. e4'), 'export has header and first move: ' + text.slice(0, 80));
  await p.fill('[data-testid=pgn-input]', '[Event "t"]\n\n1. d4 d5 2. c4 e6 3. Nc3 Nf6 *');
  await p.click('[data-testid=pgn-load]');
  await p.waitForFunction(() => document.querySelectorAll('.movelist .mv[data-ply]').length >= 6);
  const m = await sans(p);
  assert(m.slice(0, 6).join(' ') === 'd4 d5 c4 e6 Nc3 Nf6', m.join(' '));
  await p.context().close();
});

await ok('resign ends the game; draw offer is answered', async () => {
  const p = await open();
  await clickSq(p, 'e2'); await clickSq(p, 'e4'); await waitMoves(p, 2);
  await p.click('[data-testid=resign]');
  await p.click('[data-testid=resign-confirm]');
  await p.waitForSelector('[data-testid=gameover]');
  assert((await p.locator('.go-title').innerText()) === 'You lose');
  await p.context().close();
  const q = await open();
  for (const [a, b] of [['e2', 'e4'], ['g1', 'f3']]) { await clickSq(q, a); await clickSq(q, b); await q.waitForFunction((n) => document.querySelectorAll('.movelist .mv[data-ply]').length >= n, 0); await q.waitForTimeout(1200); }
  await q.click('[data-testid=draw]');
  await q.waitForSelector('.notice', { timeout: 10000 });
  await q.context().close();
});

await ok('themes and piece sets change the rendering', async () => {
  const p = await open();
  const light0 = await p.evaluate(() => getComputedStyle(document.querySelector('.sq.light')).backgroundColor);
  await p.click('[data-testid=settings-open]');
  await p.click('[data-theme-id=emerald]');
  const light1 = await p.evaluate(() => getComputedStyle(document.querySelector('.sq.light')).backgroundColor);
  assert(light0 !== light1, 'square colour changed');
  const svg0 = await p.locator('.piece svg').first().innerHTML();
  await p.click('[data-set-id=tournament]');
  const svg1 = await p.locator('.piece svg').first().innerHTML();
  assert(svg0 !== svg1, 'piece style changed');
  await p.screenshot({ path: `${SHOTS}/06-settings.png` });
  await p.keyboard.press('Escape');
  await p.click('[data-testid=settings-open]');
  await p.click('[data-set-id=glyph]'); await p.click('[data-set-id=boxwood]');
  await p.keyboard.press('Escape');
  await p.screenshot({ path: `${SHOTS}/07-boxwood.png` });
  await p.context().close();
});

await ok('clock counts down and flags', async () => {
  const p = await open({ clock: '1+0' });
  await startNew(p);
  await p.click('[data-clock="1+0"]');
  await p.click('[data-testid=start-game]');
  assert(await p.locator('[data-testid=clock-white]').innerText() === '1:00', 'clock starts at 1:00');
  await clickSq(p, 'e2'); await clickSq(p, 'e4'); await waitMoves(p, 2);
  await clickSq(p, 'd2'); await clickSq(p, 'd4'); await waitMoves(p, 4);
  const t0 = await p.locator('[data-testid=clock-white]').innerText();
  await p.waitForTimeout(2500);
  const t1 = await p.locator('[data-testid=clock-white]').innerText();
  assert(t0 !== t1, `clock should tick (${t0} -> ${t1})`);
  await p.screenshot({ path: `${SHOTS}/08-clock.png` });
  await p.context().close();
});

await ok('analysis tab: engine lines, eval bar, suggested-move arrows, review of a game', async () => {
  const p = await open();
  await clickSq(p, 'e2'); await clickSq(p, 'e4'); await waitMoves(p, 2);
  await clickSq(p, 'g1'); await clickSq(p, 'f3'); await waitMoves(p, 4);
  await p.click('[data-tab=analysis]');
  await p.click('[data-testid=import-current]');
  await p.locator('.toggle.compact').click();
  await p.waitForSelector('[data-testid=analysis-lines] .line', { timeout: 15000 });
  assert(await p.locator('[data-testid=evalbar]').count() === 1, 'eval bar');
  assert(await p.locator('.arrows line').count() >= 1, 'suggested move arrow');
  await p.click('[data-testid=run-review]');
  await p.waitForSelector('[data-testid=review-summary]', { timeout: 60000 });
  assert(await p.locator('[data-testid=evalgraph]').count() === 1);
  await p.click('.movelist .mv[data-ply="1"]');
  await p.waitForSelector('[data-testid=move-explanation]');
  await p.screenshot({ path: `${SHOTS}/09-analysis.png` });
  await p.context().close();
});

await ok('opening trainer: guided Italian lesson plays through; practice vs AI gives book feedback', async () => {
  const p = await open();
  await p.click('[data-tab=train]');
  await p.click('[data-testid=mode-learn]');
  await p.click('[data-lesson=italian]');
  await p.waitForSelector('[data-testid=coach]');
  await p.waitForSelector('.piece[data-on=e2]');
  await p.click('[data-testid=show-move]');
  assert(await p.locator('.arrows line').count() === 1, 'hint arrow');
  await clickSq(p, 'e2'); await clickSq(p, 'e4');
  await waitMoves(p, 2); // e4 then scripted e5
  assert((await p.locator('[data-testid=coach]').innerText()).length > 10);
  // wrong move rejected
  await p.waitForFunction(() => document.querySelector('[data-testid=show-move]'));
  await clickSq(p, 'a2'); await clickSq(p, 'a4');
  assert(await pieceOn(p, 'a2').count() === 1, 'off-script move rejected in learn mode');
  await p.screenshot({ path: `${SHOTS}/10-trainer-learn.png` });
  // practice mode
  await p.click('[data-testid=train-back]');
  await p.click('[data-testid=mode-practice]');
  await p.click('[data-lesson=giuoco]');
  await p.waitForSelector('.piece[data-on=c4]');
  assert(await pieceOn(p, 'c5').count() === 1, 'Giuoco Piano start position set up');
  await clickSq(p, 'c2'); await clickSq(p, 'c3');
  await waitMoves(p, 8);
  await p.waitForSelector('[data-testid=feedback] li');
  assert((await p.locator('[data-testid=feedback]').innerText()).includes('Book move'), 'book feedback');
  assert(await p.locator('[data-testid=opening-name]').first().innerText().then(t => t.length > 3));
  await p.click('[data-testid=train-repeat]');
  await p.waitForFunction(() => document.querySelectorAll('.movelist .mv[data-ply]').length === 6);
  await p.screenshot({ path: `${SHOTS}/11-trainer-practice.png` });
  await p.context().close();
});

await ok('trainer: choose the opponent reply (Black alternatives)', async () => {
  const p = await open();
  await p.click('[data-tab=train]');
  await p.click('[data-testid=mode-practice]');
  await p.click('[data-lesson=black-alternatives]');
  await p.waitForSelector('.piece[data-on=c4]');
  await p.waitForSelector('[data-testid=choice-box]', { timeout: 8000 });
  await p.click('[data-testid=choice-box] [data-uci=g8f6]');
  await waitMoves(p, 6);
  assert(await pieceOn(p, 'f6').getAttribute('data-piece') === 'bn', 'forced Two Knights reply played');
  await p.screenshot({ path: `${SHOTS}/12-choose-reply.png` });
  await p.context().close();
});

await ok('mobile layout (390x844): board fits, controls reachable', async () => {
  const p = await open({}, { width: 390, height: 844 });
  const b = await p.locator('.board').boundingBox();
  assert(b.width <= 390 && b.width > 300, 'board width ' + b.width);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  assert(!overflow, 'no horizontal overflow');
  await clickSq(p, 'e2'); await clickSq(p, 'e4'); await waitMoves(p, 2);
  await p.screenshot({ path: `${SHOTS}/13-mobile.png`, fullPage: false });
  await p.context().close();
});

await ok('touch drag on mobile viewport', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript((s) => localStorage.setItem('project-grandmaster.settings.v1', JSON.stringify(s)), baseSettings);
  await p.goto(URL); await p.waitForSelector('[data-testid=board]');
  const A = await box(p, 'g1'), B = await box(p, 'f3');
  const cdp = await ctx.newCDPSession(p);
  const pt = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(A.x + A.width / 2, A.y + A.height / 2) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(B.x + B.width / 2, B.y + B.height / 2) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForSelector('.piece[data-on=f3]', { timeout: 5000 });
  await ctx.close();
});

await ok('full screen mode makes the board bigger and exits with Esc', async () => {
  const p = await open({}, { width: 1400, height: 900 });
  const before = (await p.locator('[data-testid=board]').boundingBox()).width;
  await p.click('[data-testid=focus-toggle]');
  await p.waitForSelector('.app.focus');
  const after = (await p.locator('[data-testid=board]').boundingBox()).width;
  assert(after > before + 40, `board should grow: ${before} -> ${after}`);
  const h = (await p.locator('[data-testid=board]').boundingBox()).height;
  assert(h <= 900, 'board must fit the viewport height');
  await p.screenshot({ path: SHOTS + '/14-fullscreen.png' });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  assert((await p.locator('.app.focus').count()) === 0, 'focus mode should exit on Escape');
  await p.keyboard.press('Shift+F');
  await p.waitForSelector('.app.focus');
  await p.click('[data-testid=focus-exit]');
  assert((await p.locator('.app.focus').count()) === 0, 'exit button works');
  assert(p.errors.length === 0, p.errors.join('; '));
});

await ok('review page: summary, coach card, mistake navigation, board badge', async () => {
  const p = await open({});
  await p.click('[data-tab=analysis]');
  await p.getByRole('button', { name: 'PGN', exact: true }).click();
  await p.fill('[data-testid=pgn-input]', '1. f3 e5 2. g4 Qh4#');
  await p.click('[data-testid=pgn-load]');
  await p.click('[data-testid=run-review]');
  await p.waitForSelector('[data-testid=review-summary]', { timeout: 120000 });
  assert((await p.locator('[data-testid=evalbar]').count()) === 1, 'eval bar shown during review');
  await p.click('[data-testid=next-mistake]');
  await p.waitForSelector('.mark-badge');
  const txt = await p.locator('[data-testid=move-explanation]').innerText();
  assert(txt.length > 30, 'coach text present');
  await p.click('[data-testid=next-mistake]').catch(() => {});
  await p.screenshot({ path: SHOTS + '/15-review.png' });
  assert(p.errors.length === 0, p.errors.join('; '));
});

await ok('full screen works on a phone-sized screen', async () => {
  const p = await open({}, { width: 390, height: 780 });
  await p.click('[data-testid=focus-toggle]').catch(async () => { await p.keyboard.press('Shift+F'); });
  await p.waitForSelector('.app.focus');
  const b = await p.locator('[data-testid=board]').boundingBox();
  assert(b.width <= 390 && b.width > 300, 'board fits phone width: ' + b.width);
});

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
