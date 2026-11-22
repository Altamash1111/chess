import { Position, START_FEN, mfrom, mto } from '../chess/position';
import { GameController } from './controller';
import { LESSONS, START_POSITIONS, BOOK_LINES, Lesson, StartPosition, BookLine } from '../engine/openings-data';
import { bookMoves, openingName } from '../engine/book';
import { EngineClient } from '../engine/client';
import { winPercent } from '../engine/explain';
import { getSettings } from './settings';

export interface Feedback {
  ply: number;
  san: string;
  verdict: 'book' | 'deviation' | 'good' | 'inaccurate' | 'mistake' | 'info';
  text: string;
}

export interface ExplorerMove { san: string; uci: string; pct: number; lines: string[]; }

const ucisOf = (setup: string, startPos = START_FEN): string[] => {
  const p = Position.fromFen(startPos);
  const out: string[] = [];
  for (const s of setup.split(/\s+/).filter(Boolean)) {
    const m = p.parseSAN(s);
    if (m === null) break;
    out.push(p.moveToUci(m)); p.make(m);
  }
  return out;
};
const lineCache = new Map<BookLine, string[]>();
const lineUcis = (l: BookLine) => { let u = lineCache.get(l); if (!u) { u = ucisOf(l.san); lineCache.set(l, u); } return u; };

export class Trainer {
  lesson: Lesson | null = null;
  position: StartPosition | null = null;
  mode: 'learn' | 'practice' = 'practice';
  stepIdx = 0;
  coach = '';
  coachKind: 'info' | 'good' | 'warn' = 'info';
  expected: string | null = null;
  feedback: Feedback[] = [];
  attempts = 0;
  focusLine: BookLine | null = null;
  chooser = false;
  awaitingChoice = false;
  pendingForced: string | null = null;
  streak = 0;
  showHint = false;
  userBookMoves = 0;
  userMoves = 0;
  setupSan = '';
  private script: string[] = [];
  private analysis = new EngineClient();
  private preBook: ReturnType<typeof bookMoves> = [];
  private preFen = '';
  private scriptTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(public ctl: GameController) {
    ctl.beforeHumanMove = (c, m, san) => this.beforeHuman(c, m, san);
    ctl.onMove = (c, m, san, by) => this.afterMove(c, m, san, by);
    ctl.aiRequestExtras = (c) => this.extras(c);
    ctl.aiGate = (c) => this.gate(c);
  }

  // ---------- starting ----------
  async startLesson(lesson: Lesson, mode: 'learn' | 'practice', opts: { sameSeed?: boolean } = {}) {
    this.lesson = lesson; this.position = null; this.mode = mode; this.setupSan = lesson.setup;
    this.chooser = !!lesson.chooserDefault && mode === 'practice';
    await this.begin(lesson.userColor, lesson.setup, opts.sameSeed);
    if (mode === 'learn') {
      this.script = lesson.learn.map(l => l.san);
      this.stepIdx = 0;
      this.coach = lesson.description;
      this.coachKind = 'info';
      this.ctl.aiEnabled = false;
      this.advanceScript();
    } else {
      this.coach = lesson.goals[0] ? 'Goal: ' + lesson.goals[0] : lesson.description;
      this.ctl.aiEnabled = true;
      this.ctl.maybeStartAI();
    }
    this.ctl.emit();
  }

  async startPosition(sp: StartPosition, opts: { sameSeed?: boolean } = {}) {
    this.lesson = null; this.position = sp; this.mode = 'practice'; this.setupSan = sp.setup;
    this.chooser = false;
    await this.begin(sp.userColor === 0 ? 'white' : 'black', sp.setup, opts.sameSeed);
    this.coach = `Starting position: ${sp.name}. Play your moves — the AI answers from its opening book and then from its engine.`;
    this.ctl.aiEnabled = true;
    this.ctl.maybeStartAI();
    this.ctl.emit();
  }

  private async begin(color: 0 | 1 | 'white' | 'black', setup: string, sameSeed?: boolean) {
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.feedback = []; this.stepIdx = 0; this.expected = null; this.pendingForced = null; this.awaitingChoice = false;
    this.userBookMoves = 0; this.userMoves = 0; this.streak = 0; this.focusLine = this.focusLine && this.setupCompatible(this.focusLine, setup) ? this.focusLine : null;
    this.attempts++;
    const s = getSettings();
    this.ctl.aiEnabled = false;
    const keepSeed = sameSeed ? this.ctl.seed : undefined;
    await this.ctl.newGame({ color: color === 0 ? 'white' : color === 1 ? 'black' : color, setup, level: s.level, personality: s.personality, seed: keepSeed, clock: 'off' });
  }

  private setupCompatible(line: BookLine, setup: string) {
    const a = lineUcis(line), b = ucisOf(setup);
    return b.every((u, i) => a[i] === u);
  }

  async restart(sameSeed = false) {
    if (this.lesson) await this.startLesson(this.lesson, this.mode, { sameSeed });
    else if (this.position) await this.startPosition(this.position, { sameSeed });
  }

  stop() { if (this.scriptTimer) clearTimeout(this.scriptTimer); this.lesson = null; this.position = null; this.ctl.aiEnabled = true; }

  // ---------- hooks ----------
  private beforeHuman(c: GameController, m: number, san: string): boolean {
    this.preBook = bookMoves(c.game.pos);
    this.preFen = c.game.pos.fen();
    if (this.mode === 'learn' && this.expected) {
      const exp = c.game.pos.parseSAN(this.expected);
      if (exp !== m) {
        this.coach = `That's not the line we're learning (you played ${san}). Try ${this.hintText()} or press “Show move”. You can also switch to Practice mode to play freely.`;
        this.coachKind = 'warn';
        c.emit();
        return false;
      }
    }
    return true;
  }

  private afterMove(c: GameController, m: number, san: string, by: 'human' | 'ai') {
    this.showHint = false;
    const ply = c.game.plies.length;
    if (this.mode === 'learn') {
      const step = this.lesson?.learn[this.stepIdx];
      if (step) { this.coach = `${san}: ${step.text}`; this.coachKind = 'good'; }
      this.stepIdx++;
      this.expected = null;
      c.emit();
      this.scriptTimer = setTimeout(() => this.advanceScript(), by === 'human' ? 900 : 600);
      return;
    }
    if (by === 'human') {
      this.userMoves++;
      const uci = c.uciHistory()[ply - 1];
      const hit = this.preBook.find(b => b.uci === uci);
      const afterPos = c.game.pos;
      if (hit) {
        this.userBookMoves++; this.streak++;
        const total = this.preBook.reduce((a, b) => a + b.weight, 0) || 1;
        const name = openingName(afterPos);
        const text = `Book move${name ? ' — ' + name : ''} (${Math.round(hit.weight / total * 100)}% of main lines).${this.preBook.length > 1 ? ' Other book options: ' + this.preBook.filter(b => b.uci !== uci).slice(0, 3).map(b => b.san).join(', ') + '.' : ''}`;
        this.feedback.push({ ply, san, verdict: 'book', text });
        this.coach = text; this.coachKind = 'good';
      } else if (this.preBook.length) {
        this.streak = 0;
        const sugg = this.preBook.slice(0, 3).map(b => b.san).join(', ');
        const text = `Out of book. The main theory move was ${sugg}. Checking your move with the engine…`;
        this.feedback.push({ ply, san, verdict: 'deviation', text });
        this.coach = text; this.coachKind = 'warn';
        void this.judgeDeviation(ply, san, uci, sugg);
      } else {
        this.feedback.push({ ply, san, verdict: 'info', text: 'Beyond the opening book — the AI now plays from its engine.' });
      }
    }
    c.emit();
  }

  private async judgeDeviation(ply: number, san: string, uci: string, sugg: string) {
    try {
      const fen = this.preFen;
      const moves = this.ctl.uciHistory().slice(0, ply - 1);
      const r = await this.analysis.analyze({ startFen: this.ctl.game.startFen, moves, maxDepth: 8, timeMs: 500, multiPV: 10 }).promise;
      void fen;
      const best = r.lines[0];
      const mine = r.lines.find(l => l.uci === uci);
      const entry = this.feedback.find(f => f.ply === ply);
      if (!entry || !best) return;
      const loss = mine ? winPercent(best.score) - winPercent(mine.score) : 25;
      if (loss < 4) { entry.verdict = 'good'; entry.text = `${san} is not the main book move (${sugg}), but it is perfectly playable.`; }
      else if (loss < 12) { entry.verdict = 'inaccurate'; entry.text = `${san} is a small inaccuracy. The book move ${sugg}${best.san !== sugg.split(', ')[0] ? ` or ${best.san}` : ''} is better.`; }
      else { entry.verdict = 'mistake'; entry.text = `${san} is a mistake in this position. Theory plays ${sugg}; the engine also likes ${best.san}.`; }
      this.coach = entry.text; this.coachKind = loss < 4 ? 'good' : 'warn';
      this.ctl.emit();
    } catch { /* cancelled */ }
  }

  private advanceScript() {
    const c = this.ctl;
    if (this.mode !== 'learn' || !this.lesson) return;
    // replay through to the first step still pending relative to the game position
    const step = this.lesson.learn[this.stepIdx];
    if (!step) {
      this.coach = 'Line complete! Press “Practice vs AI” to play this opening against the engine and see how it deviates.';
      this.coachKind = 'good'; this.expected = null; c.emit(); return;
    }
    const pos = c.game.pos;
    const m = pos.parseSAN(step.san);
    if (m === null) { this.coach = 'The lesson line has ended here.'; this.expected = null; c.emit(); return; }
    if (pos.turn === c.playerColor) {
      this.expected = step.san;
      this.coach = `Your move. ${this.stepIdx === 0 && this.lesson.learn.length ? '' : ''}Find the next move of the line, or press “Show move” for a hint.`;
      this.coachKind = 'info';
      c.emit();
    } else {
      this.expected = null;
      c.playEncoded(m, 'ai');
    }
  }

  hintText(): string { return this.expected ?? (this.preBook[0]?.san ?? ''); }

  /** Squares for the hint arrow, or null. */
  hintArrow(): { from: number; to: number } | null {
    const c = this.ctl;
    if (this.mode === 'learn' && this.expected) {
      const m = c.game.pos.parseSAN(this.expected);
      if (m !== null) return { from: mfrom(m), to: mto(m) };
    }
    return null;
  }

  practiceHint(): ExplorerMove | null {
    const list = this.explorer();
    return list.length ? list[0] : null;
  }

  // ---------- AI behaviour ----------
  private focusPrefixTokens(): string[] {
    const f = this.lesson?.focusPrefix;
    return f ? f.split(/\s+/) : [];
  }

  private extras(c: GameController) {
    const played = c.uciHistory();
    let forced: string | null = null;
    if (this.pendingForced) { forced = this.pendingForced; this.pendingForced = null; this.awaitingChoice = false; }
    else if (this.focusLine) {
      const u = lineUcis(this.focusLine);
      if (played.length < u.length && played.every((x, i) => u[i] === x)) forced = u[played.length];
    }
    // prefer the lesson's opening family in the book
    const prefer: string[] = [];
    const tokens = this.focusPrefixTokens();
    if (tokens.length) {
      const pre = ucisOf(tokens.join(' '));
      for (const l of BOOK_LINES) {
        const u = lineUcis(l);
        const k = Math.min(u.length, pre.length);
        let ok = true;
        for (let i = 0; i < k; i++) if (u[i] !== pre[i]) { ok = false; break; }
        if (!ok) continue;
        if (played.length < u.length && played.every((x, i) => u[i] === x)) prefer.push(u[played.length]);
      }
    }
    return { forcedUci: forced, bookPreferUcis: prefer, useBook: true, bookUnlimited: true };
  }

  private gate(c: GameController): boolean {
    if (!this.chooser || this.mode === 'learn') return true;
    if (this.pendingForced) return true;
    const opts = this.explorer();
    if (opts.length > 1) {
      if (!this.awaitingChoice) { this.awaitingChoice = true; c.emit(); }
      return false;
    }
    return true;
  }

  chooseReply(uci: string | null) {
    this.awaitingChoice = false;
    if (uci) this.pendingForced = uci;
    else this.pendingForced = null;
    // let the engine proceed even if the chooser is on
    const was = this.chooser;
    this.chooser = false;
    this.ctl.maybeStartAI();
    this.chooser = was;
    this.ctl.emit();
  }

  setChooser(on: boolean) {
    this.chooser = on;
    if (!on && this.awaitingChoice) { this.awaitingChoice = false; this.ctl.maybeStartAI(); }
    else if (on) this.ctl.maybeStartAI();
    this.ctl.emit();
  }

  /** Book options at the current (viewed) position with popularity. */
  explorer(): ExplorerMove[] {
    const pos = this.ctl.viewPos;
    const list = bookMoves(pos);
    const total = list.reduce((a, b) => a + b.weight, 0) || 1;
    return list.map(b => ({ san: b.san, uci: b.uci, pct: Math.round(b.weight / total * 100), lines: b.lines }));
  }

  /** Lines passing through the current start position that the player can ask the AI to follow. */
  availableLines(): BookLine[] {
    const setup = ucisOf(this.setupSan);
    return BOOK_LINES.filter(l => {
      const u = lineUcis(l);
      return u.length > setup.length && setup.every((x, i) => u[i] === x);
    });
  }

  setFocusLine(name: string | null) {
    this.focusLine = name ? BOOK_LINES.find(l => l.name === name) ?? null : null;
    this.ctl.emit();
  }

  accuracyText(): string {
    return this.userMoves ? `${this.userBookMoves}/${this.userMoves} book moves` : 'No moves yet';
  }

  dispose() { if (this.scriptTimer) clearTimeout(this.scriptTimer); this.analysis.dispose(); }
}

export { LESSONS, START_POSITIONS };
