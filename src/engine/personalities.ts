import { EvalWeights, DEFAULT_WEIGHTS } from './eval';
import { StyleTag } from './openings-data';

/** Per-feature bonus in centipawns applied to candidate moves (small, so strength is preserved). */
export interface StyleBonus {
  check: number;
  capture: number;
  sacrifice: number;
  kingAttack: number;
  pawnStorm: number;
  trade: number;
  centre: number;
  development: number;
  castle: number;
  retreat: number;
  quietPositional: number;
  kingSafety: number;
  passedPush: number;
  openFile: number;
  queenEarly: number;
  pawnGrab: number;
}

export interface Personality {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  weights: EvalWeights;
  style: StyleBonus;
  /** 0 = conservative, 1 = loves complications. Governs behaviour when ahead/behind. */
  risk: number;
  /** Added to tactical vision (0..1). */
  vision: number;
  bookTags: Partial<Record<StyleTag, number>>;
}

const zero: StyleBonus = {
  check: 0, capture: 0, sacrifice: 0, kingAttack: 0, pawnStorm: 0, trade: 0, centre: 0, development: 0,
  castle: 0, retreat: 0, quietPositional: 0, kingSafety: 0, passedPush: 0, openFile: 0, queenEarly: 0, pawnGrab: 0,
};
const W = (o: Partial<EvalWeights>): EvalWeights => ({ ...DEFAULT_WEIGHTS, ...o });
const S = (o: Partial<StyleBonus>): StyleBonus => ({ ...zero, ...o });

export const PERSONALITIES: Personality[] = [
  {
    id: 'aggressive', name: 'Aggressive Attacker', icon: '♞',
    tagline: 'Goes for your king and loves a sacrifice.',
    description: 'Prefers open positions, kingside pawn storms, checks and initiative over safety. Happy to trade a pawn for activity, and will avoid simplifying when behind.',
    weights: W({ kingAttack: 1.5, threats: 1.2, mobility: 1.15, kingSafety: 0.8, pawns: 0.9, space: 1.1, pieceActivity: 1.1 }),
    style: S({ check: 14, capture: 4, sacrifice: 16, kingAttack: 12, pawnStorm: 9, trade: -6, centre: 5, development: 6, castle: 3, retreat: -7, quietPositional: 0, kingSafety: 0, passedPush: 3, openFile: 6, queenEarly: 2, pawnGrab: 0 }),
    risk: 0.9, vision: 0.02,
    bookTags: { sharp: 2.2, gambit: 3, tactical: 2, solid: 0.5, positional: 0.7 },
  },
  {
    id: 'positional', name: 'Positional Player', icon: '♝',
    tagline: 'Squeezes you slowly with structure and outposts.',
    description: 'Values pawn structure, outposts, open files and the bishop pair. Avoids unnecessary risks and wins long strategic battles.',
    weights: W({ pawns: 1.35, pieceActivity: 1.35, space: 1.5, passed: 1.2, kingAttack: 0.85, threats: 0.9, mobility: 1.15 }),
    style: S({ check: -4, capture: 0, sacrifice: -18, kingAttack: 0, pawnStorm: -3, trade: 3, centre: 8, development: 8, castle: 5, retreat: 0, quietPositional: 10, kingSafety: 3, passedPush: 6, openFile: 9, queenEarly: -8, pawnGrab: -3 }),
    risk: 0.3, vision: 0.02,
    bookTags: { positional: 2.2, solid: 1.5, sharp: 0.5, gambit: 0.2, tactical: 0.7 },
  },
  {
    id: 'defensive', name: 'Defensive Player', icon: '♜',
    tagline: 'Rock-solid; punishes overreach with counterplay.',
    description: 'Prioritises king safety, solid structure and exchanges when pressed. Hard to crack and patient — it waits for you to overextend.',
    weights: W({ kingSafety: 1.6, kingAttack: 1.25, pawns: 1.15, mobility: 0.9, threats: 1.05, space: 0.8 }),
    style: S({ check: -2, capture: 0, sacrifice: -25, kingAttack: -2, pawnStorm: -12, trade: 7, centre: 3, development: 6, castle: 9, retreat: 6, quietPositional: 4, kingSafety: 10, passedPush: 3, openFile: 3, queenEarly: -8, pawnGrab: -6 }),
    risk: 0.1, vision: 0.03,
    bookTags: { solid: 2.4, positional: 1.3, sharp: 0.3, gambit: 0.1, tactical: 0.5 },
  },
  {
    id: 'tactical', name: 'Tactical Player', icon: '♛',
    tagline: 'Hunts for combinations and forcing lines.',
    description: 'Sees tactics sharper than most: pins, forks, discovered attacks. Prefers forcing moves and keeps the position full of tension.',
    weights: W({ threats: 1.45, mobility: 1.2, kingAttack: 1.15, pieceActivity: 1.1, pawns: 0.95, space: 0.9 }),
    style: S({ check: 10, capture: 6, sacrifice: 10, kingAttack: 7, pawnStorm: 2, trade: -2, centre: 4, development: 5, castle: 3, retreat: -4, quietPositional: 1, kingSafety: 0, passedPush: 3, openFile: 5, queenEarly: 1, pawnGrab: 4 }),
    risk: 0.7, vision: 0.08,
    bookTags: { tactical: 2.5, sharp: 1.6, gambit: 1.3, solid: 0.6 },
  },
  {
    id: 'allround', name: 'All-Rounder', icon: '♚',
    tagline: 'Balanced and adaptive — plays what the position needs.',
    description: 'No strong bias. Switches plans depending on the position: attacks when the opponent\'s king is weak, plays positionally when it is not, trades when ahead.',
    weights: W({}),
    style: S({ check: 3, capture: 1, sacrifice: 0, kingAttack: 3, pawnStorm: 0, trade: 1, centre: 5, development: 6, castle: 5, retreat: 0, quietPositional: 4, kingSafety: 3, passedPush: 4, openFile: 5, queenEarly: -4, pawnGrab: 0 }),
    risk: 0.5, vision: 0.04,
    bookTags: {},
  },
];

export const getPersonality = (id: string): Personality => PERSONALITIES.find(p => p.id === id) ?? PERSONALITIES[4];
