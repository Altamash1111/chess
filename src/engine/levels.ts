/** Difficulty controls real playing strength: search depth/time, candidate width, tactical vision and error model. */
export interface Level {
  id: string;
  name: string;
  blurb: string;
  maxDepth: number;
  softMs: number;
  hardMs: number;
  maxNodes: number;
  multiPV: number;
  /** 0..1: how much of deep search is "seen" vs. a shallow static look (tactical awareness) */
  vision: number;
  /** std-dev of perceived-score noise, cp */
  noise: number;
  /** softmax temperature among candidates, cp */
  temperature: number;
  /** candidates further than this from the best perceived are never chosen, cp */
  window: number;
  /** probability per move of a human lapse (picks a clearly inferior candidate) */
  blunder: number;
  /** maximum true-score loss a lapse may cost, cp */
  maxLoss: number;
  /** book depth in full moves, and probability of staying in book */
  bookMoves: number;
  bookStay: number;
  /** base simulated thinking time in ms */
  thinkMs: number;
}

export const LEVELS: Level[] = [
  { id: 'beginner', name: 'Beginner', blurb: 'Plays quickly, sees only the next move or two and often misses threats.', maxDepth: 2, softMs: 120, hardMs: 250, maxNodes: 20000, multiPV: 6, vision: 0.3, noise: 65, temperature: 95, window: 380, blunder: 0.2, maxLoss: 380, bookMoves: 3, bookStay: 0.6, thinkMs: 600 },
  { id: 'easy', name: 'Easy', blurb: 'Knows the basics but falls for two-move tactics.', maxDepth: 3, softMs: 200, hardMs: 450, maxNodes: 60000, multiPV: 5, vision: 0.5, noise: 45, temperature: 65, window: 280, blunder: 0.13, maxLoss: 280, bookMoves: 4, bookStay: 0.75, thinkMs: 800 },
  { id: 'intermediate', name: 'Intermediate', blurb: 'Solid club player: sees short tactics, sometimes misjudges quiet positions.', maxDepth: 4, softMs: 350, hardMs: 800, maxNodes: 150000, multiPV: 5, vision: 0.68, noise: 30, temperature: 45, window: 190, blunder: 0.075, maxLoss: 170, bookMoves: 6, bookStay: 0.85, thinkMs: 1000 },
  { id: 'advanced', name: 'Advanced', blurb: 'Strong amateur: calculates well, makes the occasional inaccuracy.', maxDepth: 5, softMs: 700, hardMs: 1500, maxNodes: 400000, multiPV: 4, vision: 0.82, noise: 20, temperature: 30, window: 120, blunder: 0.035, maxLoss: 110, bookMoves: 8, bookStay: 0.92, thinkMs: 1200 },
  { id: 'expert', name: 'Expert', blurb: 'Tournament-strength: precise tactics, rare slips.', maxDepth: 7, softMs: 1300, hardMs: 2600, maxNodes: 1200000, multiPV: 3, vision: 0.92, noise: 13, temperature: 20, window: 80, blunder: 0.015, maxLoss: 70, bookMoves: 10, bookStay: 0.96, thinkMs: 1500 },
  { id: 'master', name: 'Master', blurb: 'Deep calculation and sound judgement; very few inaccuracies.', maxDepth: 10, softMs: 2600, hardMs: 4500, maxNodes: 3000000, multiPV: 3, vision: 0.97, noise: 7, temperature: 11, window: 45, blunder: 0.005, maxLoss: 45, bookMoves: 12, bookStay: 0.98, thinkMs: 1800 },
  { id: 'grandmaster', name: 'Grandmaster', blurb: 'Full strength search with minimal variation. No deliberate mistakes.', maxDepth: 22, softMs: 4500, hardMs: 7500, maxNodes: 12000000, multiPV: 1, vision: 1, noise: 0, temperature: 5, window: 18, blunder: 0, maxLoss: 0, bookMoves: 16, bookStay: 1, thinkMs: 2000 },
];

export const getLevel = (id: string): Level => LEVELS.find(l => l.id === id) ?? LEVELS[2];
