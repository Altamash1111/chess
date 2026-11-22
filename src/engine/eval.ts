import {
  Position, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, typeOf, colorOf,
  KNIGHT_MOVES, KING_MOVES, PAWN_ATTACKS, DIAG_RAYS, ORTHO_RAYS, mk,
} from '../chess/position';

export interface EvalWeights {
  material: number;
  pst: number;
  pawns: number;
  passed: number;
  mobility: number;
  kingSafety: number;
  kingAttack: number;
  threats: number;
  pieceActivity: number; // bishop pair, rook files, outposts
  space: number;
}
export const DEFAULT_WEIGHTS: EvalWeights = {
  material: 1, pst: 1, pawns: 1, passed: 1, mobility: 1, kingSafety: 1, kingAttack: 1, threats: 1, pieceActivity: 1, space: 1,
};

export const MG_VALUE = [0, 82, 337, 365, 477, 1025, 0];
export const EG_VALUE = [0, 94, 281, 297, 512, 936, 0];
export const SEE_VALUE = [0, 100, 320, 330, 500, 900, 20000];

// PST: written from White's view with index 0 = a8 (rank 8 first)
const MG_PST: number[][] = [[],
  [0,0,0,0,0,0,0,0, 98,134,61,95,68,126,34,-11, -6,7,26,31,65,56,25,-20, -14,13,6,21,23,12,17,-23, -27,-2,-5,12,17,6,10,-25, -26,-4,-4,-10,3,3,33,-12, -35,-1,-20,-23,-15,24,38,-22, 0,0,0,0,0,0,0,0],
  [-167,-89,-34,-49,61,-97,-15,-107, -73,-41,72,36,23,62,7,-17, -47,60,37,65,84,129,73,44, -9,17,19,53,37,69,18,22, -13,4,16,13,28,19,21,-8, -23,-9,12,10,19,17,25,-16, -29,-53,-12,-3,-1,18,-14,-19, -105,-21,-58,-33,-17,-28,-19,-23],
  [-29,4,-82,-37,-25,-42,7,-8, -26,16,-18,-13,30,59,18,-47, -16,37,43,40,35,50,37,-2, -4,5,19,50,37,37,7,-2, -6,13,13,26,34,12,10,4, 0,15,15,15,14,27,18,10, 4,15,16,0,7,21,33,1, -33,-3,-14,-21,-13,-12,-39,-21],
  [32,42,32,51,63,9,31,43, 27,32,58,62,80,67,26,44, -5,19,26,36,17,45,61,16, -24,-11,7,26,24,35,-8,-20, -36,-26,-12,-1,9,-7,6,-23, -45,-25,-16,-17,3,0,-5,-33, -44,-16,-20,-9,-1,11,-6,-71, -19,-13,1,17,16,7,-37,-26],
  [-28,0,29,12,59,44,43,45, -24,-39,-5,1,-16,57,28,54, -13,-17,7,8,29,56,47,57, -27,-27,-16,-16,-1,17,-2,1, -9,-26,-9,-10,-2,-4,3,-3, -14,2,-11,-2,-5,2,14,5, -35,-8,11,2,8,15,-3,1, -1,-18,-9,10,-15,-25,-31,-50],
  [-65,23,16,-15,-56,-34,2,13, 29,-1,-20,-7,-8,-4,-38,-29, -9,24,2,-16,-20,6,22,-22, -17,-20,-12,-27,-30,-25,-14,-36, -49,-1,-27,-39,-46,-44,-33,-51, -14,-14,-22,-46,-44,-30,-15,-27, 1,7,-8,-64,-43,-16,9,8, -15,36,12,-54,8,-28,24,14],
];
const EG_PST: number[][] = [[],
  [0,0,0,0,0,0,0,0, 178,173,158,134,147,132,165,187, 94,100,85,67,56,53,82,84, 32,24,13,5,-2,4,17,17, 13,9,-3,-7,-7,-8,3,-1, 4,7,-6,1,0,-5,-1,-8, 13,8,8,10,13,0,2,-7, 0,0,0,0,0,0,0,0],
  [-58,-38,-13,-28,-31,-27,-63,-99, -25,-8,-25,-2,-9,-25,-24,-52, -24,-20,10,9,-1,-9,-19,-41, -17,3,22,22,22,11,8,-18, -18,-6,16,25,16,17,4,-18, -23,-3,-1,15,10,-3,-20,-22, -42,-20,-10,-5,-2,-20,-23,-44, -29,-51,-23,-15,-22,-18,-50,-64],
  [-14,-21,-11,-8,-7,-9,-17,-24, -8,-4,7,-12,-3,-13,-4,-14, 2,-8,0,-1,-2,6,0,4, -3,9,12,9,14,10,3,2, -6,3,13,19,7,10,-3,-9, -12,-3,8,10,13,3,-7,-15, -14,-18,-7,-1,4,-9,-15,-27, -23,-9,-23,-5,-9,-16,-5,-17],
  [13,10,18,15,12,12,8,5, 11,13,13,11,-3,3,8,3, 7,7,7,5,4,-3,-5,-3, 4,3,13,1,2,1,-1,2, 3,5,8,4,-5,-6,-8,-11, -4,0,-5,-1,-7,-12,-8,-16, -6,-6,0,2,-9,-9,-11,-3, -9,2,3,-1,-5,-13,4,-20],
  [-9,22,22,27,27,19,10,20, -17,20,32,41,58,25,30,0, -20,6,9,49,47,35,19,9, 3,22,24,45,57,40,57,36, -18,28,19,47,31,34,39,23, -16,-27,15,6,9,17,10,5, -22,-23,-30,-16,-16,-23,-36,-32, -33,-28,-22,-43,-5,-32,-20,-41],
  [-74,-35,-18,-18,-11,15,4,-17, -12,17,14,17,17,38,23,11, 10,17,23,15,20,45,44,13, -8,22,24,27,26,33,26,3, -18,-4,21,24,27,23,9,-11, -19,-3,11,21,23,16,7,-9, -27,-11,4,13,14,4,-5,-17, -53,-34,-21,-11,-28,-14,-24,-43],
];

// [color][piece][sq] with material folded in
const MG_TABLE: Int16Array[][] = [[], []];
const EG_TABLE: Int16Array[][] = [[], []];
for (let t = 1; t <= 6; t++) {
  for (const c of [WHITE, BLACK]) {
    MG_TABLE[c][t] = new Int16Array(64);
    EG_TABLE[c][t] = new Int16Array(64);
    for (let sq = 0; sq < 64; sq++) {
      const f = sq & 7, r = sq >> 3;
      const idx = c === WHITE ? (7 - r) * 8 + f : r * 8 + f;
      MG_TABLE[c][t][sq] = MG_PST[t][idx];
      EG_TABLE[c][t][sq] = EG_PST[t][idx];
    }
  }
}
export function pstValue(color: number, type: number, sq: number, phase: number): number {
  const mg = MG_TABLE[color][type][sq], eg = EG_TABLE[color][type][sq];
  return (mg * phase + eg * (24 - phase)) / 24;
}

const PASSED_MG = [0, 0, 3, 8, 18, 38, 70, 0];
const PASSED_EG = [0, 0, 8, 18, 38, 75, 125, 0];
const KING_ATTACK_TABLE = [0, 0, 5, 12, 22, 36, 52, 70, 90, 110, 130, 150, 165, 180, 190, 200, 200];
const ATTACK_WEIGHT = [0, 0, 2, 2, 3, 5, 0];

const PHASE_W = [0, 0, 1, 1, 2, 4, 0];

export function gamePhase(pos: Position): number {
  let ph = 0;
  for (let sq = 0; sq < 64; sq++) { const p = pos.board[sq]; if (p) ph += PHASE_W[typeOf(p)]; }
  return Math.min(24, ph);
}

const ABP = [new Uint8Array(64), new Uint8Array(64)];
const ACNT = [new Uint8Array(64), new Uint8Array(64)];
const AMIN = [new Uint8Array(64), new Uint8Array(64)];
const KZ = [new Uint8Array(64), new Uint8Array(64)];
const pawnFiles = [new Int8Array(10), new Int8Array(10)];
const pawnMinRank = [new Int8Array(10), new Int8Array(10)]; // most advanced pawn per file (relative rank), 0=none
const pawnBackRank = [new Int8Array(10), new Int8Array(10)];

/** Static evaluation from side-to-move's perspective (centipawns). */
export function evaluate(pos: Position, w: EvalWeights = DEFAULT_WEIGHTS): number {
  const b = pos.board;
  let phase = 0;
  const mg = [0, 0], eg = [0, 0];
  const bishops = [0, 0];
  pawnFiles[0].fill(0); pawnFiles[1].fill(0);
  pawnMinRank[0].fill(0); pawnMinRank[1].fill(0);
  pawnBackRank[0].fill(0); pawnBackRank[1].fill(0);
  const attackedByPawn = ABP, attackCount = ACNT, attackMin = AMIN;
  ABP[0].fill(0); ABP[1].fill(0); ACNT[0].fill(0); ACNT[1].fill(0); AMIN[0].fill(255); AMIN[1].fill(255);

  // first pass: material, pst, pawn arrays, pawn attacks
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const t = typeOf(p), c = colorOf(p);
    phase += PHASE_W[t];
    mg[c] += (MG_VALUE[t] * w.material) + MG_TABLE[c][t][sq] * w.pst;
    eg[c] += (EG_VALUE[t] * w.material) + EG_TABLE[c][t][sq] * w.pst;
    if (t === BISHOP) bishops[c]++;
    if (t === PAWN) {
      const f = (sq & 7) + 1, r = sq >> 3;
      const rel = c === WHITE ? r : 7 - r; // 1..6
      pawnFiles[c][f]++;
      if (rel > pawnMinRank[c][f]) pawnMinRank[c][f] = rel;
      if (pawnBackRank[c][f] === 0 || rel < pawnBackRank[c][f]) pawnBackRank[c][f] = rel;
      for (const s of PAWN_ATTACKS[c][sq]) { attackedByPawn[c][s] = 1; attackCount[c][s]++; if (attackMin[c][s] > PAWN) attackMin[c][s] = PAWN; }
    }
  }
  if (phase > 24) phase = 24;

  // pawn structure & passed pawns
  for (const c of [WHITE, BLACK]) {
    const them = 1 - c;
    for (let sq = 0; sq < 64; sq++) {
      if (b[sq] !== mk(PAWN, c)) continue;
      const f = (sq & 7) + 1, r = sq >> 3;
      const rel = c === WHITE ? r : 7 - r;
      // doubled
      if (pawnFiles[c][f] > 1 && pawnMinRank[c][f] !== rel) { mg[c] -= 10 * w.pawns; eg[c] -= 20 * w.pawns; }
      // isolated
      if (!pawnFiles[c][f - 1] && !pawnFiles[c][f + 1]) { mg[c] -= 12 * w.pawns; eg[c] -= 16 * w.pawns; }
      else {
        // phalanx / supported
        const supp = PAWN_ATTACKS[them][sq].some(s => b[s] === mk(PAWN, c));
        if (supp) { mg[c] += 7 * w.pawns; eg[c] += 5 * w.pawns; }
        else if (b[sq - 1] === mk(PAWN, c) && (sq & 7) > 0) { mg[c] += 4 * w.pawns; eg[c] += 3 * w.pawns; }
        // backward-ish: stop square attacked by enemy pawn and no friendly pawn behind-adjacent
        const behindL = pawnBackRank[c][f - 1], behindR = pawnBackRank[c][f + 1];
        if (!supp && ((behindL === 0 || behindL > rel) && (behindR === 0 || behindR > rel))) {
          const stop = sq + (c === WHITE ? 8 : -8);
          if (stop >= 0 && stop < 64 && attackedByPawn[them][stop]) { mg[c] -= 8 * w.pawns; eg[c] -= 10 * w.pawns; }
        }
      }
      // passed?
      let passed = true;
      for (let df = -1; df <= 1 && passed; df++) {
        const ff = (sq & 7) + df;
        if (ff < 0 || ff > 7) continue;
        for (let rr = r + (c === WHITE ? 1 : -1); rr >= 0 && rr < 8; rr += (c === WHITE ? 1 : -1)) {
          if (b[rr * 8 + ff] === mk(PAWN, them)) { passed = false; break; }
        }
      }
      if (passed) {
        let bonusMg = PASSED_MG[rel], bonusEg = PASSED_EG[rel];
        // protected passer
        if (PAWN_ATTACKS[them][sq].some(s => b[s] === mk(PAWN, c))) { bonusMg += 5; bonusEg += 12; }
        // king proximity in endgames
        const stop = sq + (c === WHITE ? 8 : -8);
        if (stop >= 0 && stop < 64) {
          const dEnemy = cheb(pos.king[them], stop), dOwn = cheb(pos.king[c], stop);
          bonusEg += (dEnemy * 5 - dOwn * 2) * (rel >= 3 ? 1 : 0.5);
          // blocked by a piece
          if (b[stop]) { bonusMg -= bonusMg * 0.3; bonusEg -= bonusEg * 0.2; }
        }
        mg[c] += bonusMg * w.passed; eg[c] += bonusEg * w.passed;
      }
    }
  }

  // piece activity / mobility / king safety attack
  const kingZoneAttackUnits = [0, 0]; // attackers (by color c) on enemy king zone
  const kingZoneAttackers = [0, 0];
  const kingZone = KZ;
  KZ[0].fill(0); KZ[1].fill(0);
  for (const c of [WHITE, BLACK]) {
    const k = pos.king[c];
    kingZone[c][k] = 1;
    for (const s of KING_MOVES[k]) kingZone[c][s] = 1;
    // extend forward by one rank
    const fwd = c === WHITE ? 8 : -8;
    for (const s of [k + fwd, k + fwd - 1, k + fwd + 1]) {
      if (s >= 0 && s < 64 && Math.abs((s & 7) - (k & 7)) <= 1) {
        const s2 = s + fwd;
        if (s2 >= 0 && s2 < 64) kingZone[c][s2] = 1;
      }
    }
  }

  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const t = typeOf(p), c = colorOf(p), them = 1 - c;
    if (t === PAWN || t === KING) continue;
    let mob = 0;
    let attacksKingZone = 0;
    const addAttack = (s: number) => {
      attackCount[c][s]++;
      if (attackMin[c][s] > t) attackMin[c][s] = t;
      if (kingZone[them][s]) attacksKingZone++;
    };
    if (t === KNIGHT) {
      for (const s of KNIGHT_MOVES[sq]) {
        addAttack(s);
        const tp = b[s];
        if (!attackedByPawn[them][s] && (!tp || colorOf(tp) !== c)) mob++;
      }
      mg[c] += (mob - 4) * 4 * w.mobility; eg[c] += (mob - 4) * 4 * w.mobility;
      // outpost
      const rel = c === WHITE ? sq >> 3 : 7 - (sq >> 3);
      if (rel >= 3 && rel <= 5 && PAWN_ATTACKS[them][sq].some(s => b[s] === mk(PAWN, c))) {
        const f = (sq & 7) + 1;
        let canBeAttacked = false;
        for (const ff of [f - 1, f + 1]) {
          if (pawnFiles[them][ff]) {
            // enemy pawn on adjacent file that is still behind (can advance to attack)
            const advRank = c === WHITE ? pawnMinRank[them][ff] : pawnMinRank[them][ff];
            void advRank;
            for (let rr = (sq >> 3) + (c === WHITE ? 1 : -1); rr >= 0 && rr < 8; rr += (c === WHITE ? 1 : -1)) {
              if (b[rr * 8 + ff - 1] === mk(PAWN, them)) { canBeAttacked = true; break; }
            }
          }
        }
        if (!canBeAttacked) { mg[c] += 22 * w.pieceActivity; eg[c] += 12 * w.pieceActivity; }
      }
    } else {
      const diag = t === BISHOP || t === QUEEN, ortho = t === ROOK || t === QUEEN;
      const scan = (rays: number[][]) => {
        for (const ray of rays) {
          for (let i = 0; i < ray.length; i++) {
            const s = ray[i];
            const tp = b[s];
            addAttack(s);
            if (!tp) { if (!attackedByPawn[them][s]) mob++; }
            else {
              if (colorOf(tp) !== c) mob++;
              // x-ray through own queen/rook battery
              if (colorOf(tp) === c && (typeOf(tp) === QUEEN || (typeOf(tp) === ROOK && ortho && rays === ORTHO_RAYS[sq]) || (typeOf(tp) === BISHOP && rays === DIAG_RAYS[sq]))) continue;
              break;
            }
          }
        }
      };
      if (diag) scan(DIAG_RAYS[sq]);
      if (ortho) scan(ORTHO_RAYS[sq]);
      if (t === BISHOP) { mg[c] += (mob - 6) * 3 * w.mobility; eg[c] += (mob - 6) * 4 * w.mobility; }
      else if (t === ROOK) {
        mg[c] += (mob - 7) * 2 * w.mobility; eg[c] += (mob - 7) * 4 * w.mobility;
        const f = (sq & 7) + 1;
        if (!pawnFiles[c][f]) {
          if (!pawnFiles[them][f]) { mg[c] += 22 * w.pieceActivity; eg[c] += 10 * w.pieceActivity; }
          else { mg[c] += 10 * w.pieceActivity; eg[c] += 8 * w.pieceActivity; }
        }
        const rel = c === WHITE ? sq >> 3 : 7 - (sq >> 3);
        if (rel === 6 && ((c === WHITE ? pos.king[them] >> 3 : 7 - (pos.king[them] >> 3)) === 7 || true)) { mg[c] += 12 * w.pieceActivity; eg[c] += 18 * w.pieceActivity; }
      } else if (t === QUEEN) {
        mg[c] += (mob - 12) * 1 * w.mobility; eg[c] += (mob - 12) * 2 * w.mobility;
      }
    }
    if (attacksKingZone) {
      kingZoneAttackers[c]++;
      kingZoneAttackUnits[c] += ATTACK_WEIGHT[t] * attacksKingZone;
    }
  }

  // add pawn/king attack counts for completeness
  for (const c of [WHITE, BLACK]) {
    for (const s of KING_MOVES[pos.king[c]]) { attackCount[c][s]++; if (attackMin[c][s] > KING) attackMin[c][s] = KING; }
  }

  for (const c of [WHITE, BLACK]) {
    const them = 1 - c;
    if (bishops[c] >= 2) { mg[c] += 28 * w.pieceActivity; eg[c] += 48 * w.pieceActivity; }

    // king safety (for side c): pawn shield + open files + enemy attackers
    const k = pos.king[c];
    const kf = k & 7, kr = k >> 3;
    let shield = 0;
    const fwd = c === WHITE ? 1 : -1;
    for (let df = -1; df <= 1; df++) {
      const ff = kf + df;
      if (ff < 0 || ff > 7) continue;
      let found = 0;
      for (let d = 1; d <= 3; d++) {
        const rr = kr + fwd * d;
        if (rr < 0 || rr > 7) break;
        if (b[rr * 8 + ff] === mk(PAWN, c)) { found = d; break; }
      }
      if (found === 1) shield += 12;
      else if (found === 2) shield += 7;
      else if (found === 3) shield += 2;
      else {
        shield -= 8;
        // open file near king
        if (!pawnFiles[them][ff + 1]) shield -= 8;
      }
    }
    const kingRel = c === WHITE ? kr : 7 - kr;
    if (kingRel > 2) shield -= 20; // wandering king
    mg[c] += shield * w.kingSafety;
    const units = Math.min(16, kingZoneAttackUnits[them]);
    const attackers = kingZoneAttackers[them];
    let danger = attackers >= 2 ? KING_ATTACK_TABLE[units] : (attackers === 1 ? KING_ATTACK_TABLE[units] * 0.3 : 0);
    // without enemy queen the attack is far weaker
    if (!hasPiece(pos, them, QUEEN)) danger *= 0.4;
    mg[c] -= danger * w.kingAttack;
    eg[c] -= danger * 0.1 * w.kingAttack;
  }

  // threats: loose/attacked pieces
  const stm = pos.turn;
  for (const c of [WHITE, BLACK]) {
    const them = 1 - c;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (!p || colorOf(p) !== them) continue;
      const t = typeOf(p);
      if (t === KING) continue;
      if (!attackCount[c][sq]) continue;
      let bonus = 0;
      const defended = attackCount[them][sq] > 0;
      if (t !== PAWN && attackMin[c][sq] < t && attackMin[c][sq] !== 255 && (SEE_VALUE[attackMin[c][sq]] < SEE_VALUE[t] - 50)) {
        bonus = Math.min(60, (SEE_VALUE[t] - SEE_VALUE[attackMin[c][sq]]) / 6);
      } else if (!defended && t !== PAWN) bonus = 14;
      else if (!defended && t === PAWN) bonus = 5;
      if (bonus) {
        const scale = c === stm ? 1 : 0.4; // side to move can act on threats
        mg[c] += bonus * scale * w.threats; eg[c] += bonus * 0.7 * scale * w.threats;
      }
    }
  }

  // space: safe squares in centre files controlled
  if (w.space > 0) {
    for (const c of [WHITE, BLACK]) {
      let sp = 0;
      for (let r = 2; r <= 4; r++) for (let f = 2; f <= 5; f++) {
        const s = (c === WHITE ? r : 7 - r) * 8 + f;
        if (attackCount[c][s] > attackCount[1 - c][s]) sp++;
      }
      mg[c] += sp * 2 * w.space;
    }
  }

  // tempo
  mg[stm] += 10;

  const scoreMg = mg[WHITE] - mg[BLACK];
  const scoreEg = eg[WHITE] - eg[BLACK];
  let score = (scoreMg * phase + scoreEg * (24 - phase)) / 24;

  // endgame scaling: drawish material (no pawns, minor edge) -> shrink
  score = drawishScale(pos, score, phase);
  return Math.round(stm === WHITE ? score : -score);
}

function drawishScale(pos: Position, score: number, phase: number): number {
  if (phase > 8) return score;
  // count pawns of the stronger side
  const strong = score > 0 ? WHITE : BLACK;
  let pawns = 0;
  for (let sq = 0; sq < 64; sq++) if (pos.board[sq] === mk(PAWN, strong)) pawns++;
  if (pawns === 0) {
    // no pawns: material edge smaller than a rook is hard to convert
    return score * (Math.abs(score) < 250 ? 0.35 : 0.8);
  }
  return score;
}

function hasPiece(pos: Position, c: number, t: number): boolean {
  const p = mk(t, c);
  for (let sq = 0; sq < 64; sq++) if (pos.board[sq] === p) return true;
  return false;
}
function cheb(a: number, b: number): number {
  return Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));
}

/** Simple material count in pawns (for UI). White minus black. */
export function materialBalance(pos: Position): number {
  const v = [0, 1, 3, 3, 5, 9, 0];
  let s = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (!p) continue;
    s += colorOf(p) === WHITE ? v[typeOf(p)] : -v[typeOf(p)];
  }
  return s;
}
