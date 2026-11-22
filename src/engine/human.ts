import {
  Position, typeOf, colorOf, mfrom, mto, mflags, mpromo, FLAG_CAPTURE, FLAG_CASTLE, FLAG_DOUBLE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, mk,
} from '../chess/position';
import { Searcher, SearchResult, RootLine, see, MATE_BOUND } from './search';
import { pstValue, gamePhase, SEE_VALUE, materialBalance } from './eval';
import { Level } from './levels';
import { Personality, StyleBonus } from './personalities';
import { bookMoves, openingName, BookMove } from './book';
import { describeMove, relRank, cheb } from './explain';

export interface RNG { next(): number; }
export function makeRng(seed: number): RNG {
  let a = seed >>> 0 || 0x1234567;
  return { next() { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
}
const gauss = (rng: RNG) => { let u = 0, v = 0; while (!u) u = rng.next(); while (!v) v = rng.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export interface Candidate {
  uci: string;
  san: string;
  move: number;
  score: number;      // deep search score cp (mover's view)
  perceived: number;  // what the "human" thinks after vision/noise/style
  style: number;
  pv: string[];
}

export interface HumanDecision {
  move: number;
  uci: string;
  san: string;
  score: number;
  depth: number;
  nodes: number;
  source: 'book' | 'search' | 'forced' | 'trainer';
  bookName: string | null;
  plan: string;
  explanation: string;
  candidates: Candidate[];
  complexity: number;
  delayMs: number;
  mistake: boolean;
  searchMs: number;
}

export interface DecisionRequest {
  pos: Position;
  level: Level;
  personality: Personality;
  rng: RNG;
  timeLeftMs?: number | null;
  incMs?: number;
  forcedUci?: string | null;       // trainer: play this move if legal
  bookPreferUcis?: string[];       // trainer: preferred book replies (weighted up)
  useBook?: boolean;
  /** trainer: follow the book as deep as it goes regardless of level */
  bookUnlimited?: boolean;
  fastDelay?: boolean;
}

// ---------------- plans ----------------
export type PlanId = 'develop' | 'safety' | 'attack' | 'centre' | 'convert' | 'counter' | 'passed' | 'endgame' | 'files' | 'improve';
export interface Plan { id: PlanId; text: string; }

function undevelopedMinors(pos: Position, c: number): number {
  let n = 0;
  const back = c === 0 ? 0 : 7;
  for (let f = 0; f < 8; f++) {
    const p = pos.board[back * 8 + f];
    if (p && colorOf(p) === c && (typeOf(p) === KNIGHT || typeOf(p) === BISHOP)) n++;
  }
  return n;
}
function hasCastled(pos: Position, c: number): boolean {
  const k = pos.king[c];
  const f = k & 7;
  return relRank(k, c) === 0 && (f >= 6 || f <= 2) ? true : false;
}

export function detectPlan(pos: Position, c: number): Plan {
  const them = 1 - c;
  const phase = gamePhase(pos);
  const mat = (c === 0 ? 1 : -1) * materialBalance(pos);
  const rights = c === 0 ? (pos.castling & 3) : (pos.castling & 12);
  if (pos.fullmove <= 12 && undevelopedMinors(pos, c) >= 2) return { id: 'develop', text: 'Finish development and fight for the centre' };
  if (!hasCastled(pos, c) && rights && pos.fullmove <= 18 && phase > 12) return { id: 'safety', text: 'Get the king safe by castling' };
  if (phase <= 8) {
    // passed pawn?
    const b = pos.board;
    for (let sq = 0; sq < 64; sq++) {
      if (b[sq] !== mk(PAWN, c)) continue;
      let passed = true;
      for (let df = -1; df <= 1 && passed; df++) {
        const ff = (sq & 7) + df; if (ff < 0 || ff > 7) continue;
        for (let rr = (sq >> 3) + (c === 0 ? 1 : -1); rr >= 0 && rr < 8; rr += (c === 0 ? 1 : -1)) if (b[rr * 8 + ff] === mk(PAWN, them)) { passed = false; break; }
      }
      if (passed && relRank(sq, c) >= 3) return { id: 'passed', text: 'Push the passed pawn with the king\'s support' };
    }
    return { id: 'endgame', text: 'Activate the king and improve the pieces for the endgame' };
  }
  if (mat >= 2) return { id: 'convert', text: 'Convert the material edge: trade pieces and stay safe' };
  if (mat <= -2) return { id: 'counter', text: 'Create counterplay and avoid simplifying' };
  if (hasCastled(pos, them) && phase > 10) {
    // count own pieces near their king
    let near = 0;
    for (let sq = 0; sq < 64; sq++) { const p = pos.board[sq]; if (p && colorOf(p) === c && typeOf(p) >= KNIGHT && typeOf(p) <= QUEEN && cheb(sq, pos.king[them]) <= 3) near++; }
    if (near >= 2) return { id: 'attack', text: 'Attack the enemy king' };
  }
  // open files
  const b = pos.board;
  for (let f = 0; f < 8; f++) {
    let own = false, enemy = false;
    for (let r = 0; r < 8; r++) { if (b[r * 8 + f] === mk(PAWN, c)) own = true; if (b[r * 8 + f] === mk(PAWN, them)) enemy = true; }
    if (!own && !enemy) return { id: 'files', text: `Take control of the open ${'abcdefgh'[f]}-file` };
  }
  return { id: 'improve', text: 'Improve the worst-placed piece and keep a flexible structure' };
}

const PLAN_STYLE: Record<PlanId, Partial<StyleBonus>> = {
  develop: { development: 6, centre: 4, castle: 5, queenEarly: -4 },
  safety: { castle: 12, kingSafety: 4 },
  attack: { kingAttack: 8, check: 4, pawnStorm: 4 },
  centre: { centre: 6 },
  convert: { trade: 8, sacrifice: -10, passedPush: 3 },
  counter: { trade: -6, sacrifice: 6, check: 3 },
  passed: { passedPush: 12 },
  endgame: { quietPositional: 4, passedPush: 5 },
  files: { openFile: 10 },
  improve: { quietPositional: 6 },
};

// ---------------- move features ----------------
interface Feat {
  check: number; capture: number; sacrifice: number; kingAttack: number; pawnStorm: number; trade: number; centre: number;
  development: number; castle: number; retreat: number; quietPositional: number; kingSafety: number; passedPush: number;
  openFile: number; queenEarly: number; pawnGrab: number;
}

function moveFeatures(pos: Position, m: number, phase: number): Feat {
  const b = pos.board;
  const from = mfrom(m), to = mto(m), flags = mflags(m);
  const piece = b[from], t = typeOf(piece), us = colorOf(piece), them = 1 - us;
  const f: Feat = { check: 0, capture: 0, sacrifice: 0, kingAttack: 0, pawnStorm: 0, trade: 0, centre: 0, development: 0, castle: 0, retreat: 0, quietPositional: 0, kingSafety: 0, passedPush: 0, openFile: 0, queenEarly: 0, pawnGrab: 0 };
  const cap = (flags & FLAG_CAPTURE) !== 0;
  if (cap) f.capture = 1;
  let s = 0;
  if (cap || t !== KING) s = see(pos, m);
  const victim = cap ? SEE_VALUE[typeOf(b[to]) || PAWN] : 0;
  if (cap && SEE_VALUE[t] >= 300 && victim >= 300 && Math.abs(s) <= 60) f.trade = 1;
  if (s < -150) f.sacrifice = 1;
  else if (!cap && t !== PAWN && t !== KING) {
    // quiet move to an attacked square that is defended = mild sacrifice-like activity
  }
  if (cap && t === PAWN && victim === 100 && s >= 0) f.pawnGrab = 1;
  if (flags & FLAG_CASTLE) { f.castle = 1; f.kingSafety = 1; }
  // checks
  pos.make(m);
  if (pos.inCheck()) f.check = 1;
  pos.unmake();
  const ek = pos.king[them], ok = pos.king[us];
  if (t !== PAWN && t !== KING) {
    if (cheb(to, ek) < cheb(from, ek) && cheb(to, ek) <= 3) f.kingAttack = 1;
    if (relRank(to, us) < relRank(from, us) && !cap) f.retreat = 1;
  }
  if (t === PAWN) {
    const kf = ek & 7, myKf = ok & 7;
    // pawn storm: pawn on a file within 1 of enemy king when kings on opposite wings
    if (Math.abs((to & 7) - kf) <= 1 && Math.abs(kf - myKf) >= 3 && relRank(to, us) >= 3) f.pawnStorm = 1;
    // weakening own castled king
    if (hasCastled(pos, us) && Math.abs((from & 7) - myKf) <= 1 && relRank(from, us) <= 2 && !cap) f.kingSafety -= 0.6;
    // passed pawn push
    let passed = true;
    for (let df = -1; df <= 1 && passed; df++) {
      const ff = (to & 7) + df; if (ff < 0 || ff > 7) continue;
      for (let rr = (to >> 3) + (us === 0 ? 1 : -1); rr >= 0 && rr < 8; rr += (us === 0 ? 1 : -1)) if (b[rr * 8 + ff] === mk(PAWN, them)) { passed = false; break; }
    }
    if (passed && relRank(to, us) >= 3) f.passedPush = 1;
    if ((flags & FLAG_DOUBLE) && ((to & 7) === 3 || (to & 7) === 4)) f.centre = 1;
    else if ((to & 7) >= 2 && (to & 7) <= 5 && relRank(to, us) >= 3 && relRank(to, us) <= 4) f.centre = 0.5;
  } else if (t === KNIGHT || t === BISHOP) {
    if (relRank(from, us) === 0 && pos.fullmove <= 14) f.development = 1;
    const tf = to & 7, tr = relRank(to, us);
    if (tf >= 2 && tf <= 5 && tr >= 3 && tr <= 4) f.centre = 1;
    else if (t === BISHOP && (to === 9 || to === 14 || to === 49 || to === 54)) f.centre = 0.4;
  } else if (t === ROOK || t === QUEEN) {
    const tf = to & 7;
    let own = false;
    for (let r = 0; r < 8; r++) if (b[r * 8 + tf] === mk(PAWN, us)) own = true;
    if (!own) f.openFile = 1;
    if (t === QUEEN && pos.fullmove <= 8 && relRank(to, us) >= 2 && !cap) f.queenEarly = 1;
  } else if (t === KING && !(flags & FLAG_CASTLE)) {
    if (phase > 10) f.kingSafety -= 0.8;
  }
  // positional gain from piece-square tables (normalised)
  const gain = pstValue(us, t, to, phase) - pstValue(us, t, from, phase);
  f.quietPositional = Math.max(-2, Math.min(2, gain / 12));
  return f;
}

function styleBonus(f: Feat, st: StyleBonus, planStyle: Partial<StyleBonus>, scale: number): number {
  let sum = 0;
  (Object.keys(f) as (keyof Feat)[]).forEach(k => { sum += f[k] * ((st[k] ?? 0) + (planStyle[k] ?? 0) * 0.6); });
  return sum * scale;
}

// ---------------- the human decision layer ----------------
export class HumanPlayer {
  searcher: Searcher;
  constructor(searcher?: Searcher) { this.searcher = searcher ?? new Searcher(); }

  decide(req: DecisionRequest): HumanDecision {
    const { pos, level, personality, rng } = req;
    const t0 = Date.now();
    const legal = pos.legalMoves();
    const us = pos.turn;
    const plan = detectPlan(pos, us);
    const phase = gamePhase(pos);
    const base = (m: number, source: HumanDecision['source'], extra: Partial<HumanDecision> = {}): HumanDecision => {
      const san = pos.toSAN(m, legal);
      return {
        move: m, uci: pos.moveToUci(m), san, score: 0, depth: 0, nodes: 0, source, bookName: null, plan: plan.text,
        explanation: describeMove(pos, m), candidates: [], complexity: 0, delayMs: 600, mistake: false, searchMs: Date.now() - t0, ...extra,
      };
    };

    if (legal.length === 0) throw new Error('No legal moves');
    const timeScale = this.timeScale(req);

    // forced single reply
    if (legal.length === 1) return base(legal[0], 'forced', { delayMs: req.fastDelay ? 80 : 250 + rng.next() * 250, explanation: 'Only one legal move.' });

    // trainer-forced reply
    if (req.forcedUci) {
      const m = legal.find(x => pos.moveToUci(x) === req.forcedUci);
      if (m !== undefined) return base(m, 'trainer', { bookName: openingName((() => { const q = pos.clone(); q.make(m); return q; })()), delayMs: req.fastDelay ? 80 : 500 + rng.next() * 500 });
    }

    // ---- opening book ----
    if ((req.useBook ?? true) && (req.bookUnlimited || (pos.fullmove <= level.bookMoves && rng.next() < level.bookStay))) {
      const entries = bookMoves(pos).filter(e => legal.some(m => pos.moveToUci(m) === e.uci));
      if (entries.length) {
        const pick = this.pickBook(entries, personality, req.bookPreferUcis ?? [], rng);
        const m = legal.find(x => pos.moveToUci(x) === pick.uci)!;
        const after = pos.clone(); after.make(m);
        const nm = openingName(after);
        const alts = entries.filter(e => e.uci !== pick.uci).slice(0, 3).map(e => e.san);
        return base(m, 'book', {
          bookName: nm,
          explanation: `${nm ? `Book move — ${nm}. ` : 'Book move. '}${describeMove(pos, m)}${alts.length ? ` (Other options here: ${alts.join(', ')}.)` : ''}`,
          delayMs: req.fastDelay ? 80 : (350 + rng.next() * 900) * (level.thinkMs / 1200 + 0.5) * timeScale,
        });
      }
    }

    // ---- search ----
    const multiPV = level.id === 'grandmaster' ? (pos.fullmove <= 12 ? 3 : 1) : level.multiPV;
    this.searcher.weights = personality.weights;
    const soft = level.softMs * timeScale, hard = Math.max(100, level.hardMs * timeScale);
    const res: SearchResult = this.searcher.search(pos, {
      maxDepth: level.maxDepth, softMs: soft, hardMs: hard, maxNodes: level.maxNodes, multiPV,
    });
    const lines = res.lines;
    const bestScore = lines[0].score;

    // candidate evaluation
    const ctxScale = level.id === 'grandmaster' ? 0.5 : 1;
    const planStyle = PLAN_STYLE[plan.id];
    const vision = Math.min(1, level.vision + personality.vision);
    const cands: Candidate[] = lines.map(line => this.makeCandidate(pos, line, personality, planStyle, phase, vision, level, rng, bestScore, ctxScale));

    // risk attitude: when clearly ahead conservative personalities simplify; when behind risky ones complicate
    const ahead = bestScore > 150, behind = bestScore < -150;
    if (ahead || behind) {
      for (const c of cands) {
        const f = moveFeatures(pos, c.move, phase);
        if (ahead) c.perceived += (f.trade * (1 - personality.risk) * 8) - (f.sacrifice * (1 - personality.risk) * 12);
        if (behind) c.perceived += ((1 - f.trade) * personality.risk * 3) + f.check * personality.risk * 3 - f.trade * (1 - personality.risk) * 3;
      }
    }

    // complexity of the position (how many reasonable moves, tactical content)
    const near = cands.filter(c => c.score >= bestScore - 50).length;
    let captures = 0; for (const m of legal) if (mflags(m) & FLAG_CAPTURE) captures++;
    const complexity = Math.min(1, (near - 1) / Math.max(1, cands.length - 1) * 0.45 + Math.min(captures, 6) / 6 * 0.25 + (pos.inCheck() ? 0.3 : 0) + (legal.length > 35 ? 0.1 : 0));

    const choice = this.choose(cands, level, rng, bestScore, complexity, req);
    const chosen = choice.cand;
    const loss = bestScore - chosen.score;
    const mistake = loss >= 60;
    const after = pos.clone(); after.make(chosen.move);

    // explanation
    let explanation = describeMove(pos, chosen.move);
    const pvText = chosen.pv.slice(1, 4).join(' ');
    if (!mistake && pvText) explanation += ` Expected continuation: ${pvText}.`;
    explanation += ` Plan: ${plan.text}.`;
    const styleNote = this.styleNote(pos, chosen.move, personality, phase);
    if (styleNote) explanation += ` ${styleNote}`;

    const delay = this.thinkDelay(req, complexity, legal, chosen.move, pos);
    return {
      move: chosen.move, uci: chosen.uci, san: chosen.san, score: chosen.score, depth: res.depth, nodes: res.nodes,
      source: 'search', bookName: openingName(after), plan: plan.text, explanation, candidates: cands, complexity, delayMs: delay,
      mistake, searchMs: Date.now() - t0,
    };
  }

  private timeScale(req: DecisionRequest): number {
    if (req.timeLeftMs == null) return 1;
    const inc = req.incMs ?? 0;
    const budget = Math.max(150, req.timeLeftMs / 30 + inc * 0.7);
    const nominal = req.level.softMs;
    return Math.max(0.05, Math.min(1, budget / nominal));
  }

  private pickBook(entries: BookMove[], p: Personality, prefer: string[], rng: RNG): BookMove {
    const ws = entries.map(e => {
      let w = e.weight;
      let mult = 1;
      for (const t of e.tags) mult *= (p.bookTags[t] ?? 1);
      if (e.tags.size === 0 && entries.length > 1) mult = 1;
      w *= mult;
      if (prefer.includes(e.uci)) w *= 8;
      return Math.max(0.01, w);
    });
    const total = ws.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (let i = 0; i < entries.length; i++) { r -= ws[i]; if (r <= 0) return entries[i]; }
    return entries[0];
  }

  private makeCandidate(pos: Position, line: RootLine, p: Personality, planStyle: Partial<StyleBonus>, phase: number, vision: number, level: Level, rng: RNG, best: number, ctxScale: number): Candidate {
    const m = line.move;
    const san = pos.toSAN(m);
    const f = moveFeatures(pos, m, phase);
    const style = styleBonus(f, p.style, planStyle, ctxScale);
    // shallow tactical view (what a quick glance sees): quiescence after the move
    let shallow = line.score;
    if (vision < 0.999) {
      pos.make(m);
      shallow = -this.searcher.quiescenceScore(pos);
      pos.unmake();
      // restore searcher.pos pointer
    }
    let perceived = line.score * vision + shallow * (1 - vision);
    if (Math.abs(line.score) > MATE_BOUND) perceived = line.score; // forced mates are obvious once found by the search
    perceived += style;
    if (level.noise > 0) perceived += gauss(rng) * level.noise;
    // PV in SAN
    const pv: string[] = [];
    const q = pos.clone();
    for (const pm of line.pv.slice(0, 6)) {
      const lg = q.legalMoves();
      if (!lg.includes(pm)) break;
      pv.push(q.toSAN(pm, lg)); q.make(pm);
    }
    return { uci: pos.moveToUci(m), san, move: m, score: line.score, perceived, style, pv };
  }

  private choose(cands: Candidate[], level: Level, rng: RNG, bestScore: number, complexity: number, req: DecisionRequest): { cand: Candidate; lapse: boolean } {
    if (cands.length === 1) return { cand: cands[0], lapse: false };
    // forced mate: take it
    if (bestScore > MATE_BOUND && level.id !== 'beginner') return { cand: cands[0], lapse: false };
    const pressure = req.timeLeftMs != null && req.timeLeftMs < 15000 ? 1.5 : 1;
    // human lapse (more likely in complex positions or under time pressure)
    if (level.blunder > 0 && rng.next() < level.blunder * (0.6 + complexity * 0.9) * pressure) {
      const pool = cands.filter(c => c !== cands[0] && bestScore - c.score <= level.maxLoss && Math.abs(c.score) < MATE_BOUND && c.score > -MATE_BOUND);
      // a lapse still looks plausible: weight by perceived value
      if (pool.length) {
        const top = Math.max(...pool.map(c => c.perceived));
        const ws = pool.map(c => Math.exp((c.perceived - top) / (level.temperature * 2 + 1)));
        const total = ws.reduce((a, b) => a + b, 0);
        let r = rng.next() * total;
        for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return { cand: pool[i], lapse: true }; }
      }
    }
    const topP = Math.max(...cands.map(c => c.perceived));
    const pool = cands.filter(c => c.perceived >= topP - level.window && (c.score > -MATE_BOUND || bestScore <= -MATE_BOUND));
    const T = Math.max(1, level.temperature);
    const ws = pool.map(c => Math.exp((c.perceived - topP) / T));
    const total = ws.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return { cand: pool[i], lapse: false }; }
    return { cand: pool[0], lapse: false };
  }

  private styleNote(pos: Position, m: number, p: Personality, phase: number): string {
    const f = moveFeatures(pos, m, phase);
    switch (p.id) {
      case 'aggressive': if (f.check) return 'The attacker in me loves forcing moves.'; if (f.kingAttack || f.pawnStorm) return 'Bringing more force toward your king.'; break;
      case 'positional': if (f.quietPositional > 0.8) return 'A quiet improvement of the piece placement.'; if (f.openFile) return 'Taking the open file.'; break;
      case 'defensive': if (f.castle || f.kingSafety > 0) return 'Safety first.'; if (f.trade) return 'Trading off attackers.'; break;
      case 'tactical': if (f.sacrifice) return 'There may be a tactic behind this.'; if (f.check || f.capture) return 'Keeping the position forcing.'; break;
      default: break;
    }
    return '';
  }

  private thinkDelay(req: DecisionRequest, complexity: number, legal: number[], m: number, pos: Position): number {
    if (req.fastDelay) return 60;
    const { level, rng } = req;
    let d = level.thinkMs * (0.45 + complexity * 1.2) * (0.7 + rng.next() * 0.6);
    // quick recaptures and obvious moves are played faster
    const last = pos.lastMove;
    if (last && (mflags(last) & FLAG_CAPTURE) && (mflags(m) & FLAG_CAPTURE) && mto(last) === mto(m)) d *= 0.45;
    if (pos.inCheck() && legal.length <= 3) d *= 0.5;
    if (pos.fullmove <= 8) d *= 0.6;
    d = Math.min(d, 5500);
    if (req.timeLeftMs != null) d = Math.min(d, Math.max(80, req.timeLeftMs / 12));
    return Math.round(d);
  }
}
