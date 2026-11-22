import {
  Position, START_FEN, WHITE, BLACK, mfrom, mto, mpromo, mflags, FLAG_CAPTURE, FLAG_CASTLE, typeOf, colorOf, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  sqName, validateFen,
} from '../chess/position';
import { Game, GameStatus } from '../chess/game';
import { EngineClient, Pending } from '../engine/client';
import type { HumanDecision } from '../engine/human';
import { getSettings, parseClock, ClockSpec } from './settings';
import { sounds, configureSound } from './sounds';
import { getLevel } from '../engine/levels';
import { getPersonality } from '../engine/personalities';

export type Kind = 'play' | 'analysis' | 'training';

export interface Notice { text: string; kind: 'info' | 'good' | 'bad' | 'warn'; id: number; }
export interface AiLogEntry { ply: number; san: string; text: string; plan: string; source: string; score: number; depth: number; book: string | null; mistake: boolean; }

export interface ClockState { enabled: boolean; spec: ClockSpec | null; ms: [number, number]; running: 0 | 1 | null; flagged: 0 | 1 | null; }

export interface NewGameOptions {
  color?: 'white' | 'black' | 'random';
  level?: string;
  personality?: string;
  clock?: string;
  startFen?: string;
  setup?: string;           // SAN moves played silently before the game starts
  seed?: number;
}

export type MoveHook = (ctl: GameController, move: number, san: string, by: 'human' | 'ai') => void;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class GameController {
  game = new Game();
  version = 0;
  private listeners = new Set<() => void>();
  playerColor: 0 | 1 = WHITE;
  orientation: 0 | 1 = WHITE;
  viewPly: number | null = null;
  level = 'intermediate';
  personality = 'allround';
  seed = (Math.random() * 2 ** 31) | 0;
  thinking = false;
  thinkingSince = 0;
  aiLog: AiLogEntry[] = [];
  lastDecision: HumanDecision | null = null;
  notice: Notice | null = null;
  promotion: { from: number; to: number } | null = null;
  animate = true;
  clock: ClockState = { enabled: false, spec: null, ms: [0, 0], running: null, flagged: null };
  engine = new EngineClient();
  engineBusyError: string | null = null;
  freeMode: boolean;       // both colours movable (analysis)
  aiEnabled: boolean;
  private aiToken = 0;
  private pending: Pending<HumanDecision> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private noticeSeq = 0;
  private drawOfferPly = -100;
  onMove: MoveHook | null = null;
  /** trainer hooks */
  beforeHumanMove: ((ctl: GameController, move: number, san: string) => boolean) | null = null;
  aiRequestExtras: ((ctl: GameController) => { forcedUci?: string | null; bookPreferUcis?: string[]; useBook?: boolean; bookUnlimited?: boolean }) | null = null;
  /** trainer: return false to pause the engine (e.g. while the player chooses its reply) */
  aiGate: ((ctl: GameController) => boolean) | null = null;
  private viewCache: { ply: number; pos: Position } | null = null;

  constructor(public kind: Kind) {
    this.freeMode = kind === 'analysis';
    this.aiEnabled = kind !== 'analysis';
    if (kind !== 'analysis') this.startTicker();
  }

  // ---------- subscription ----------
  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  getVersion = () => this.version;
  emit() { this.version++; this.listeners.forEach(l => l()); }

  dispose() {
    this.cancelAI();
    this.engine.dispose();
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  say(text: string, kind: Notice['kind'] = 'info') {
    this.notice = { text, kind, id: ++this.noticeSeq };
    this.emit();
  }

  // ---------- derived state ----------
  get status(): GameStatus { return this.game.status(); }
  get over() { return this.status.over; }
  get aiColor(): 0 | 1 { return (1 - this.playerColor) as 0 | 1; }
  get isLive() { return this.viewPly === null; }
  get plyCount() { return this.game.plies.length; }
  get viewIndex() { return this.viewPly ?? this.game.plies.length; }

  get viewPos(): Position {
    if (this.viewPly === null) return this.game.pos;
    if (this.viewCache && this.viewCache.ply === this.viewPly && this.viewCache.ply <= this.game.plies.length) return this.viewCache.pos;
    const pos = this.game.positionAt(this.viewPly);
    this.viewCache = { ply: this.viewPly, pos };
    return pos;
  }
  get lastMoveView(): { from: number; to: number } | null {
    const idx = this.viewIndex;
    if (idx === 0) return null;
    const m = this.game.plies[idx - 1].move;
    return { from: mfrom(m), to: mto(m) };
  }
  get checkSquare(): number {
    const p = this.viewPos;
    if (this.viewPly === null && this.over && this.status.reason !== 'checkmate') return p.inCheck() ? p.king[p.turn] : -1;
    return p.inCheck() ? p.king[p.turn] : -1;
  }
  uciHistory(): string[] { return this.game.plies.map(p => sqName(mfrom(p.move)) + sqName(mto(p.move)) + (mpromo(p.move) ? ' pnbrqk'[mpromo(p.move)] : '')); }

  canMovePiece(sq: number): boolean {
    if (!this.isLive || this.over || this.promotion) return false;
    const p = this.game.pos.board[sq];
    if (!p) return false;
    if (colorOf(p) !== this.game.pos.turn) return false;
    if (this.freeMode) return true;
    return colorOf(p) === this.playerColor && !this.thinking;
  }

  legalTargets(from: number): number[] {
    if (!this.canMovePiece(from)) return [];
    const out = new Set<number>();
    for (const m of this.game.pos.legalMoves()) if (mfrom(m) === from) out.add(mto(m));
    return [...out];
  }

  isCapture(from: number, to: number): boolean {
    for (const m of this.game.pos.legalMoves()) if (mfrom(m) === from && mto(m) === to) return (mflags(m) & FLAG_CAPTURE) !== 0;
    return false;
  }

  needsPromotion(from: number, to: number): boolean {
    for (const m of this.game.pos.legalMoves()) if (mfrom(m) === from && mto(m) === to && mpromo(m)) return true;
    return false;
  }

  captured(color: 0 | 1): number[] {
    // pieces (of the opponent) captured BY `color`, derived from board vs. full set
    const counts = new Array(7).fill(0);
    const b = this.viewPos.board;
    let promoWhite = 0, promoBlack = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (!p) continue;
      if (colorOf(p) !== color) counts[typeOf(p)] += 1; // opponent pieces still on board
    }
    const opp = 1 - color;
    const full = [0, 8, 2, 2, 2, 1, 1];
    // promotions inflate counts of non-pawns beyond the starting number
    const out: number[] = [];
    let extraPieces = 0;
    for (const t of [QUEEN, ROOK, BISHOP, KNIGHT]) if (counts[t] > full[t]) extraPieces += counts[t] - full[t];
    for (const t of [QUEEN, ROOK, BISHOP, KNIGHT, PAWN]) {
      let missing = full[t] - counts[t];
      if (t === PAWN) missing -= extraPieces;
      for (let i = 0; i < Math.max(0, missing); i++) out.push(t | (opp << 3));
    }
    void promoWhite; void promoBlack;
    return out;
  }

  materialDiff(): number {
    const v = [0, 1, 3, 3, 5, 9, 0];
    const sum = (arr: number[]) => arr.reduce((a, p) => a + v[typeOf(p)], 0);
    return sum(this.captured(WHITE)) - sum(this.captured(BLACK));
  }

  // ---------- game flow ----------
  async newGame(opts: NewGameOptions = {}) {
    const s = getSettings();
    this.cancelAI();
    this.engine.restart();
    this.engine.newGame().promise.catch(() => {});
    this.level = opts.level ?? s.level;
    this.personality = opts.personality ?? s.personality;
    this.seed = opts.seed ?? ((Math.random() * 2 ** 31) | 0);
    let col = opts.color ?? s.playerColor;
    if (col === 'random') col = Math.random() < 0.5 ? 'white' : 'black';
    this.playerColor = col === 'white' ? WHITE : BLACK;
    this.orientation = this.playerColor;
    const fen = opts.startFen ?? START_FEN;
    this.game.reset(fen);
    this.viewPly = null; this.viewCache = null; this.promotion = null; this.aiLog = []; this.lastDecision = null; this.notice = null;
    this.thinking = false; this.drawOfferPly = -100; this.animate = false;
    if (opts.setup) {
      for (const san of opts.setup.split(/\s+/).filter(Boolean)) {
        if (this.game.playSan(san) === null) throw new Error('Bad setup move ' + san);
      }
    }
    this.setupClock(opts.clock ?? s.clock);
    this.emit();
    this.maybeStartAI();
  }

  private setupClock(spec: string) {
    const c = parseClock(spec);
    this.clock = { enabled: !!c && this.kind !== 'analysis', spec: c, ms: c ? [c.minutes * 60000, c.minutes * 60000] : [0, 0], running: null, flagged: null };
    this.lastTick = performance.now();
    this.updateClockRunning();
  }

  private updateClockRunning() {
    if (!this.clock.enabled || this.over) { this.clock.running = null; return; }
    // clocks start once both sides have moved (first move of each is free)
    this.clock.running = this.game.plies.length >= 2 ? this.game.pos.turn : null;
  }

  private startTicker() {
    this.tickTimer = setInterval(() => {
      const now = performance.now();
      const dt = now - this.lastTick;
      this.lastTick = now;
      const c = this.clock;
      if (!c.enabled || c.running === null || this.over) return;
      c.ms[c.running] = Math.max(0, c.ms[c.running] - dt);
      if (c.ms[c.running] <= 0) { this.flag(c.running); return; }
      this.emit();
    }, 100);
  }

  private flag(color: 0 | 1) {
    this.clock.flagged = color;
    this.clock.running = null;
    const b = this.game.pos.board;
    // if the opponent has no mating potential the game is drawn
    const winner = 1 - color;
    let mat = 0, hasPR = false;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (!p || colorOf(p) !== winner) continue;
      const t = typeOf(p);
      if (t === PAWN || t === ROOK || t === QUEEN) hasPR = true;
      if (t === KNIGHT || t === BISHOP) mat++;
    }
    if (!hasPR && mat < 2) { this.game.forcedResult = { result: '1/2-1/2', reason: 'timeout' }; }
    else this.game.timeout(color as 0 | 1);
    this.finish();
  }

  private finish() {
    this.cancelAI();
    this.updateClockRunning();
    if (getSettings().sound) sounds.gameEnd();
    this.emit();
  }

  /** Attempt a move from the UI. Returns 'ok' | 'promotion' | 'illegal' | 'blocked'. */
  attemptMove(from: number, to: number, promo = 0, viaDrag = false): 'ok' | 'promotion' | 'illegal' | 'blocked' {
    if (!this.canMovePiece(from)) return 'illegal';
    if (this.needsPromotion(from, to) && !promo) {
      if (getSettings().autoQueen) promo = QUEEN;
      else { this.promotion = { from, to }; this.emit(); return 'promotion'; }
    }
    const m = this.game.pos.findMove(from, to, promo);
    if (m === null) { if (getSettings().sound) sounds.illegal(); return 'illegal'; }
    const san = this.game.pos.toSAN(m);
    if (this.beforeHumanMove && !this.beforeHumanMove(this, m, san)) return 'blocked';
    this.promotion = null;
    this.animate = !viaDrag;
    this.commit(m, 'human');
    return 'ok';
  }

  choosePromotion(piece: number) {
    if (!this.promotion) return;
    const { from, to } = this.promotion;
    this.promotion = null;
    this.attemptMove(from, to, piece, false);
  }
  cancelPromotion() { this.promotion = null; this.emit(); }

  private commit(m: number, by: 'human' | 'ai' | 'free') {
    const pos = this.game.pos;
    const flags = mflags(m);
    const isCap = (flags & FLAG_CAPTURE) !== 0, isCastle = (flags & FLAG_CASTLE) !== 0, isPromo = mpromo(m) !== 0;
    const mover = pos.turn;
    const san = this.game.play(m);
    if (san === null) return;
    this.viewPly = null;
    // increment
    if (this.clock.enabled && this.clock.spec && this.game.plies.length > 2) this.clock.ms[mover] += this.clock.spec.inc * 1000;
    this.lastTick = performance.now();
    this.updateClockRunning();
    this.playMoveSound(san, isCap, isCastle, isPromo);
    const st = this.status;
    if (this.onMove) this.onMove(this, m, san, by === 'ai' ? 'ai' : 'human');
    if (st.over) { this.finish(); return; }
    this.emit();
    this.maybeStartAI();
  }

  private playMoveSound(san: string, cap: boolean, castle: boolean, promo: boolean) {
    const s = getSettings();
    configureSound(s.sound, s.volume);
    if (!s.sound) return;
    if (san.endsWith('#')) return; // game-end sound handles it
    if (san.endsWith('+')) sounds.check();
    else if (promo) sounds.promote();
    else if (castle) sounds.castle();
    else if (cap) sounds.capture();
    else sounds.move();
  }

  /** Play an already-legal encoded move (used by scripted lessons). */
  playEncoded(m: number, by: 'human' | 'ai' = 'ai') { this.animate = true; this.commit(m, by); }

  // ---------- engine turn ----------
  cancelAI() {
    this.aiToken++;
    if (this.pending) { this.pending.cancel(); this.pending = null; }
    this.thinking = false;
  }

  maybeStartAI() {
    if (!this.aiEnabled || this.over || this.thinking) return;
    if (this.game.pos.turn !== this.aiColor) return;
    if (this.aiGate && !this.aiGate(this)) return;
    void this.runAI();
  }

  private async runAI() {
    const token = ++this.aiToken;
    this.thinking = true;
    this.thinkingSince = performance.now();
    this.emit();
    const s = getSettings();
    const extras = this.aiRequestExtras ? this.aiRequestExtras(this) : {};
    const ai = this.aiColor;
    const req = {
      startFen: this.game.startFen,
      moves: this.uciHistory(),
      level: this.level,
      personality: this.personality,
      seed: this.seed,
      timeLeftMs: this.clock.enabled ? this.clock.ms[ai] : null,
      incMs: this.clock.spec ? this.clock.spec.inc * 1000 : 0,
      fastDelay: !s.humanDelay,
      forcedUci: extras.forcedUci ?? null,
      bookPreferUcis: extras.bookPreferUcis,
      useBook: extras.useBook ?? true,
      bookUnlimited: extras.bookUnlimited ?? false,
    };
    try {
      const pend = this.engine.chooseMove(req);
      this.pending = pend;
      const d = await pend.promise;
      if (token !== this.aiToken) return;
      const elapsed = performance.now() - this.thinkingSince;
      const wait = Math.max(0, d.delayMs - elapsed);
      if (wait > 0) await sleep(wait);
      if (token !== this.aiToken) return;
      const m = this.game.pos.parseUci(d.uci);
      if (m === null) throw new Error('Engine produced an illegal move: ' + d.uci);
      this.pending = null;
      this.thinking = false;
      this.lastDecision = d;
      this.aiLog.push({ ply: this.game.plies.length + 1, san: d.san, text: d.explanation, plan: d.plan, source: d.source, score: d.score, depth: d.depth, book: d.bookName, mistake: d.mistake });
      this.animate = true;
      this.commit(m, 'ai');
    } catch (e: any) {
      if (token !== this.aiToken) return;
      this.thinking = false;
      this.pending = null;
      if (String(e?.message) !== 'cancelled') {
        this.engineBusyError = String(e?.message ?? e);
        this.say('Engine error: ' + this.engineBusyError, 'bad');
      }
      this.emit();
    }
  }

  // ---------- user actions ----------
  /** Move in free (analysis) mode for either colour. */
  freeMove(from: number, to: number, promo = 0): 'ok' | 'promotion' | 'illegal' { return this.attemptMove(from, to, promo) as any; }

  undo(): boolean {
    if (this.game.plies.length === 0) return false;
    if (this.freeMode) {
      this.game.undo(); this.viewPly = null; this.viewCache = null; this.promotion = null; this.animate = false; this.emit(); return true;
    }
    const wasThinking = this.thinking;
    this.cancelAI();
    this.engine.restart();
    const minPlies = this.playerColor === BLACK && this.game.startFenTurn() === WHITE ? 1 : 0;
    let popped = 0;
    // take back until it is the player's turn
    do {
      if (this.game.plies.length <= minPlies) break;
      this.game.undo();
      popped++;
    } while (this.game.pos.turn !== this.playerColor && this.game.plies.length > minPlies);
    if (popped === 0) { this.maybeStartAI(); return false; }
    this.viewPly = null; this.viewCache = null; this.promotion = null; this.animate = false;
    this.clock.flagged = null;
    this.updateClockRunning();
    this.seed = (this.seed + 1337) | 0;   // new variation after a takeback
    void wasThinking;
    this.say('Move taken back.', 'info');
    this.maybeStartAI();
    return true;
  }

  canUndo(): boolean {
    if (this.game.plies.length === 0) return false;
    if (this.freeMode) return true;
    const minPlies = this.playerColor === BLACK && this.game.startFenTurn() === WHITE ? 1 : 0;
    return this.game.plies.length > minPlies;
  }

  resign() {
    if (this.over) return;
    this.cancelAI();
    this.game.resign(this.playerColor);
    this.finish();
  }

  async offerDraw() {
    if (this.over || this.thinking) return;
    if (this.game.plies.length - this.drawOfferPly < 10) { this.say('The engine has already declined a draw recently. Try again in a few moves.', 'warn'); return; }
    this.drawOfferPly = this.game.plies.length;
    this.say('Draw offered…', 'info');
    try {
      const pend = this.engine.respondToDraw({
        startFen: this.game.startFen, moves: this.uciHistory(), level: this.level, personality: this.personality, seed: this.seed, engineColor: this.aiColor,
      });
      const r = await pend.promise;
      if (r.accept) { this.game.agreeDraw(); this.say('Draw agreed.', 'good'); this.finish(); }
      else this.say(r.reason, 'warn');
    } catch { /* cancelled */ }
  }

  flip() { this.orientation = (1 - this.orientation) as 0 | 1; this.emit(); }

  goTo(ply: number | null) {
    const n = this.game.plies.length;
    if (ply === null || ply >= n) this.viewPly = null;
    else this.viewPly = Math.max(0, ply);
    this.viewCache = null;
    this.animate = false;
    this.emit();
  }
  step(delta: number) {
    const cur = this.viewIndex;
    this.goTo(Math.max(0, Math.min(this.game.plies.length, cur + delta)));
  }

  // ---------- import / export ----------
  loadFen(fen: string) {
    const err = validateFen(fen);
    if (err) throw new Error(err);
    void this.newGame({ startFen: fen.trim(), color: getSettings().playerColor === 'random' ? undefined : getSettings().playerColor, level: this.level, personality: this.personality });
  }

  loadFenFree(fen: string) {
    const err = validateFen(fen);
    if (err) throw new Error(err);
    this.cancelAI();
    this.game.reset(fen.trim());
    this.viewPly = null; this.viewCache = null; this.animate = false;
    this.emit();
  }

  loadPgn(text: string, opts: { color?: 'white' | 'black' } = {}) {
    const g = Game.fromPGN(text);
    this.cancelAI();
    this.engine.restart();
    this.game = g;
    this.viewPly = null; this.viewCache = null; this.promotion = null; this.aiLog = []; this.animate = false;
    if (opts.color) { this.playerColor = opts.color === 'white' ? WHITE : BLACK; }
    else if (!this.freeMode) this.playerColor = this.game.pos.turn;
    this.orientation = this.playerColor;
    this.setupClock('off');
    this.emit();
    this.maybeStartAI();
  }

  pgn(): string {
    const lv = getLevel(this.level), pe = getPersonality(this.personality);
    const ai = `Project Grandmaster (${lv.name}, ${pe.name})`;
    return this.game.toPGN({
      White: this.playerColor === WHITE ? 'You' : ai,
      Black: this.playerColor === BLACK ? 'You' : ai,
    });
  }

  fen(): string { return this.viewPos.fen(); }
}

declare module '../chess/game' {
  interface Game { startFenTurn(): 0 | 1; }
}
Game.prototype.startFenTurn = function (this: Game) { return this.startFen.split(' ')[1] === 'b' ? BLACK : WHITE; };
export { KING };
