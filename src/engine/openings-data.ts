// Opening knowledge: hand-written book lines in SAN (original data, no external databases).
// `n` = number of plies after which the opening name applies (defaults to full line).
// `w` = weight (popularity). `tags` bias personality choices.

export type StyleTag = 'sharp' | 'solid' | 'positional' | 'tactical' | 'gambit';

export interface BookLine {
  name: string;
  eco?: string;
  san: string;
  n?: number;
  w?: number;
  tags?: StyleTag[];
}

const L = (name: string, san: string, o: Partial<BookLine> = {}): BookLine => ({ name, san, ...o });

export const BOOK_LINES: BookLine[] = [
  // ---------------- 1.e4 e5 : Italian family (trainer focus) ----------------
  L('King\'s Pawn Game', 'e4 e5', { n: 2, w: 10 }),
  L('King\'s Knight Opening', 'e4 e5 Nf3', { n: 3, w: 10 }),
  L('Italian Game', 'e4 e5 Nf3 Nc6 Bc4', { n: 5, w: 10 }),
  L('Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5', { n: 6, w: 10 }),
  L('Giuoco Piano: Classical, Main Line', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 Nxe4 O-O Bxc3 d5 Bf6 Re1 Ne7 Rxe4 d6', { n: 11, w: 5, tags: ['sharp'] }),
  L('Giuoco Piano: Classical, Greco Gambit line', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5 exd5 Nxd5 Qb3 Nce7 O-O O-O', { n: 11, w: 5, tags: ['positional'] }),
  L('Giuoco Pianissimo', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O a6 Bb3 Ba7 Re1 O-O Nbd2 Re8 Nf1 h6', { n: 9, w: 10, tags: ['solid', 'positional'] }),
  L('Giuoco Pianissimo: Italian Four Knights setup', 'e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 c3 d6 O-O O-O Re1 a6 a4 Ba7 h3 h6 Nbd2 Re8', { n: 7, w: 6, tags: ['solid'] }),
  L('Giuoco Pianissimo: ...d5 break', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d5 exd5 Nxd5 Qb3 Nb6 Bb5 Bd7 Bxc6 Bxc6 Nxe5 Qd6 Nxc6 Qxc6', { n: 9, w: 2, tags: ['tactical'] }),
  L('Evans Gambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O Nge7 Ng5 O-O Qh5 Ng6', { n: 8, w: 3, tags: ['gambit', 'sharp', 'tactical'] }),
  L('Evans Gambit Declined', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bb6 b5 Na5 Nxe5 Nxc4 Nxc4 d5', { n: 8, w: 1, tags: ['sharp'] }),
  L('Italian Game: Hungarian Defence', 'e4 e5 Nf3 Nc6 Bc4 Be7 d4 exd4 Nxd4 Nf6 Nc3 O-O', { n: 6, w: 3, tags: ['solid'] }),
  L('Italian Game: Paris Defence', 'e4 e5 Nf3 Nc6 Bc4 Nge7 Nc3 Ng6 d3 Bc5 Be3 Bb6 Qd2 d6', { n: 6, w: 1 }),
  L('Italian Game: Rousseau Gambit', 'e4 e5 Nf3 Nc6 Bc4 f5 d4 fxe4 Nxe5 Nxe5 dxe5 Qh4 O-O', { n: 6, w: 1, tags: ['gambit', 'sharp'] }),
  L('Italian Game: Blackburne Shilling Gambit', 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4 exd4 O-O c6 d3 Bc5', { n: 6, w: 1, tags: ['gambit', 'tactical'] }),
  // Two Knights Defence
  L('Two Knights Defence', 'e4 e5 Nf3 Nc6 Bc4 Nf6', { n: 6, w: 10, tags: ['sharp'] }),
  L('Two Knights: Knight Attack, Main Line (4.Ng5 d5 5.exd5 Na5)', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5 Bd6 d4 exd3 Nxd3 Qc7', { n: 10, w: 10, tags: ['sharp', 'tactical'] }),
  L('Two Knights: Knight Attack, 6.d3 line', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 d3 h6 Nf3 e4 Qe2 Nxc4 dxc4 Bc5 Nfd2 O-O', { n: 10, w: 3, tags: ['positional'] }),
  L('Two Knights: Knight Attack, 6.Bb3 line', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5 Bd6 d4 exd3 Nxd3 Qc7 Nd2 O-O', { n: 10, w: 2 }),
  L('Two Knights: Fried Liver Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3 Nb4 O-O c6 d4 Kd7', { n: 10, w: 4, tags: ['sharp', 'tactical', 'gambit'] }),
  L('Two Knights: Fried Liver, Lolli Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3 Ncb4 Qe4 c6 a3 Na6 d4 Nac7', { n: 10, w: 2, tags: ['sharp'] }),
  L('Two Knights: Traxler Counterattack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5 Nxf7 Bxf2+ Kxf2 Nxe4+ Ke3 Qh4 Qf3 Nxg5', { n: 8, w: 2, tags: ['sharp', 'tactical', 'gambit'] }),
  L('Two Knights: Traxler, 6.Bxf7+', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5 Bxf7+ Ke7 Bb3 Rf8 Nc3 d6 Nd5+ Nxd5 Bxd5 Bxf2+', { n: 8, w: 1, tags: ['sharp'] }),
  L('Two Knights: Modern Bishop\'s Opening (4.d3)', 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O d6 c3 O-O Re1 a6 Bb3 Be6', { n: 7, w: 5, tags: ['solid', 'positional'] }),
  L('Two Knights: 4.d3 Bc5', 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O a6 Bb3 Ba7 Nbd2 O-O Re1 Re8 Nf1 h6', { n: 7, w: 4, tags: ['solid'] }),
  L('Two Knights: 4.Nc3 (Four Knights line)', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Nc3 Bc5 Nxe5 Nxe5 d4 Bxd4 Qxd4 Nxc4 Qxc4', { n: 7, w: 2, tags: ['sharp'] }),
  L('Two Knights: 4.d4 (Max Lange line)', 'e4 e5 Nf3 Nc6 Bc4 Nf6 d4 exd4 O-O Nxe4 Re1 d5 Bxd5 Qxd5 Nc3 Qa5 Nxe4 Be6', { n: 7, w: 2, tags: ['sharp', 'tactical'] }),
  // Ruy Lopez
  L('Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5', { n: 5, w: 14, tags: ['positional'] }),
  L('Ruy Lopez: Morphy Defence, Closed', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7', { n: 8, w: 12, tags: ['positional', 'solid'] }),
  L('Ruy Lopez: Berlin Defence', 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8', { n: 6, w: 8, tags: ['solid'] }),
  L('Ruy Lopez: Exchange Variation', 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1 Bg4', { n: 7, w: 4, tags: ['positional'] }),
  L('Ruy Lopez: Open Variation', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5 dxe5 Be6 c3 Be7', { n: 8, w: 4, tags: ['sharp'] }),
  L('Ruy Lopez: Schliemann Defence', 'e4 e5 Nf3 Nc6 Bb5 f5 Nc3 fxe4 Nxe4 d5 Nxe5 dxe4 Nxc6 Qg5', { n: 6, w: 1, tags: ['sharp', 'gambit'] }),
  L('Ruy Lopez: Steinitz Defence', 'e4 e5 Nf3 Nc6 Bb5 d6 d4 Bd7 Nc3 Nf6 O-O Be7 Re1 exd4 Nxd4 O-O', { n: 6, w: 1, tags: ['solid'] }),
  // Scotch, Four Knights, Petroff, Philidor, others
  L('Scotch Game', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6', { n: 7, w: 7, tags: ['sharp'] }),
  L('Scotch Game: Classical', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4 Ne5 Be2 Qg6', { n: 7, w: 4, tags: ['positional'] }),
  L('Four Knights Game', 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 Bxc3 bxc3 d6 Bg5 Qe7', { n: 6, w: 5, tags: ['solid'] }),
  L('Four Knights: Scotch', 'e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4 Bb4 Nxc6 bxc6 Bd3 d5 exd5 cxd5 O-O O-O', { n: 6, w: 2 }),
  L('Petroff Defence', 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4', { n: 4, w: 7, tags: ['solid'] }),
  L('Petroff Defence: Nimzowitsch', 'e4 e5 Nf3 Nf6 Nc3 Nc6 Bb5 Bb4 O-O O-O d3 Bxc3 bxc3 d6', { n: 4, w: 1, tags: ['solid'] }),
  L('Philidor Defence', 'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O Re1 c6 a4 b6', { n: 4, w: 4, tags: ['solid'] }),
  L('Philidor Defence: Exchange', 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Be2 O-O O-O Re8', { n: 4, w: 2 }),
  L('Latvian Gambit', 'e4 e5 Nf3 f5 Nxe5 Qf6 d4 d6 Nc4 fxe4 Nc3 Qg6', { n: 4, w: 1, tags: ['gambit', 'sharp'] }),
  L('King\'s Gambit Accepted', 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 d4 d6 Nd3 Nxe4 Bxf4 Bg7', { n: 4, w: 4, tags: ['gambit', 'sharp', 'tactical'] }),
  L('King\'s Gambit Declined', 'e4 e5 f4 Bc5 Nf3 d6 c3 Nf6 Bc4 O-O d3 Nc6', { n: 4, w: 2, tags: ['sharp'] }),
  L('Vienna Game', 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 d3 Nxc3 bxc3 O-O', { n: 3, w: 4, tags: ['sharp'] }),
  L('Vienna Game: Bc4', 'e4 e5 Nc3 Nc6 Bc4 Nf6 d3 Na5 Nge2 Nxc4 dxc4 d6', { n: 3, w: 2 }),
  L('Bishop\'s Opening', 'e4 e5 Bc4 Nf6 d3 c6 Nf3 d5 Bb3 Bd6 O-O O-O', { n: 3, w: 2, tags: ['solid'] }),
  L('Center Game', 'e4 e5 d4 exd4 Qxd4 Nc6 Qe3 Nf6 Nc3 Bb4 Bd2 O-O', { n: 4, w: 1 }),

  // ---------------- Sicilian ----------------
  L('Sicilian Defence', 'e4 c5', { n: 2, w: 16, tags: ['sharp'] }),
  L('Sicilian: Open, Najdorf', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7', { n: 10, w: 10, tags: ['sharp', 'tactical'] }),
  L('Sicilian: Najdorf, English Attack', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e6 f3 b5 Qd2 Nbd7 g4 h6 O-O-O Bb7', { n: 10, w: 6, tags: ['sharp', 'tactical'] }),
  L('Sicilian: Najdorf, 6.Bg5', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O Nbd7', { n: 10, w: 5, tags: ['sharp'] }),
  L('Sicilian: Najdorf, 6.Be2', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O Be3 Be6', { n: 10, w: 3, tags: ['positional'] }),
  L('Sicilian: Dragon', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O Rc8', { n: 10, w: 6, tags: ['sharp', 'tactical'] }),
  L('Sicilian: Classical', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Bg5 e6 Qd2 a6 O-O-O Bd7 f4 Be7', { n: 8, w: 4, tags: ['sharp'] }),
  L('Sicilian: Sveshnikov', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Nd5 Be7', { n: 9, w: 4, tags: ['sharp'] }),
  L('Sicilian: Scheveningen', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Be2 Be7 O-O O-O f4 Nc6 Be3 a6', { n: 6, w: 4, tags: ['solid'] }),
  L('Sicilian: Taimanov', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be3 a6 Qd2 Nf6 O-O-O Bb4', { n: 6, w: 3 }),
  L('Sicilian: Kan', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3 Nc6 Nxc6 bxc6 O-O d5 c4 Nf6', { n: 6, w: 2 }),
  L('Sicilian: Alapin', 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4 Nb6 Bb3 dxe5 Nxe5 Nxe5 dxe5 Qxd1+ Kxd1', { n: 3, w: 5, tags: ['solid'] }),
  L('Sicilian: Alapin, 2...d5', 'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6 Be2 Nc6 O-O cxd4 cxd4 Be7', { n: 3, w: 2 }),
  L('Sicilian: Closed', 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 Be3 e6 Qd2 Nge7 Nge2 O-O', { n: 4, w: 3, tags: ['positional'] }),
  L('Sicilian: Smith-Morra Gambit', 'e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6 Nf3 d6 Bc4 e6 O-O Nf6 Qe2 Be7', { n: 4, w: 2, tags: ['gambit', 'sharp'] }),
  L('Sicilian: Grand Prix Attack', 'e4 c5 Nc3 Nc6 f4 g6 Nf3 Bg7 Bb5 Nd4 O-O Nxb5 Nxb5 d6', { n: 4, w: 1, tags: ['sharp'] }),

  // ---------------- French / Caro-Kann / others vs 1.e4 ----------------
  L('French Defence', 'e4 e6', { n: 2, w: 8, tags: ['solid'] }),
  L('French Defence: Advance', 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 Nh6 b4 cxd4 cxd4 Nf5', { n: 6, w: 4 }),
  L('French Defence: Classical', 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5', { n: 6, w: 4 }),
  L('French Defence: Winawer', 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7 Qxg7 Rg8 Qxh7 cxd4', { n: 7, w: 4, tags: ['sharp'] }),
  L('French Defence: Tarrasch', 'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2 cxd4 cxd4 f6', { n: 6, w: 3 }),
  L('French Defence: Exchange', 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O Bg5 Bg4', { n: 6, w: 2, tags: ['solid'] }),
  L('Caro-Kann Defence', 'e4 c6', { n: 2, w: 8, tags: ['solid'] }),
  L('Caro-Kann: Advance', 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nd7 O-O Ne7', { n: 6, w: 3 }),
  L('Caro-Kann: Classical', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6', { n: 8, w: 6, tags: ['solid'] }),
  L('Caro-Kann: Exchange', 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7', { n: 6, w: 2 }),
  L('Caro-Kann: Panov Attack', 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6', { n: 7, w: 3, tags: ['sharp'] }),
  L('Scandinavian Defence', 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6', { n: 3, w: 4 }),
  L('Scandinavian: Modern', 'e4 d5 exd5 Nf6 d4 Nxd5 Nf3 g6 Be2 Bg7 O-O O-O c4 Nb6', { n: 3, w: 2 }),
  L('Pirc Defence', 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6 a4 Nbd7', { n: 4, w: 3, tags: ['sharp'] }),
  L('Pirc: Austrian Attack', 'e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3 O-O Bd3 Na6 O-O c5', { n: 4, w: 2, tags: ['sharp'] }),
  L('Modern Defence', 'e4 g6 d4 Bg7 Nc3 d6 Be3 a6 Qd2 b5 f3 Nd7', { n: 2, w: 2 }),
  L('Alekhine\'s Defence', 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7 c4 Nb6', { n: 2, w: 2, tags: ['sharp'] }),

  // ---------------- 1.d4 ----------------
  L('Queen\'s Pawn Game', 'd4 d5', { n: 2, w: 10 }),
  L('Queen\'s Gambit', 'd4 d5 c4', { n: 3, w: 12, tags: ['positional'] }),
  L('Queen\'s Gambit Declined', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4 Nd5', { n: 4, w: 10, tags: ['solid', 'positional'] }),
  L('QGD: Exchange Variation', 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 Nbd7 Qc2 Re8 Nge2 Nf8', { n: 6, w: 4, tags: ['positional'] }),
  L('QGD: Tarrasch Defence', 'd4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 Nf6 Bg2 Be7 O-O O-O Bg5 cxd4 Nxd4 h6', { n: 6, w: 2 }),
  L('Queen\'s Gambit Accepted', 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6 Qe2 b5 Bb3 Nc6', { n: 4, w: 5 }),
  L('Slav Defence', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O Nbd7', { n: 4, w: 8, tags: ['solid'] }),
  L('Semi-Slav Defence', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5 Bd3 a6 e4 c5', { n: 6, w: 5, tags: ['sharp'] }),
  L('Slav: Exchange', 'd4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Bf4 Nc6 e3 Bf5 Nf3 e6', { n: 4, w: 2 }),
  L('Queen\'s Gambit: Albin Countergambit', 'd4 d5 c4 e5 dxe5 d4 Nf3 Nc6 g3 Be6 Nbd2 Qd7', { n: 4, w: 1, tags: ['gambit', 'sharp'] }),
  L('London System', 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3 O-O Bd3 b6', { n: 3, w: 6, tags: ['solid'] }),
  L('London System: vs King\'s Indian setup', 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O h3 d6 Be2 Nbd7 O-O c5 c3 b6', { n: 3, w: 2, tags: ['solid'] }),
  L('Colle System', 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 b3 Nc6 O-O Bd6 Bb2 O-O', { n: 5, w: 2, tags: ['solid'] }),
  L('Trompowsky Attack', 'd4 Nf6 Bg5 Ne4 Bf4 c5 f3 Qa5+ c3 Nf6 dxc5 e6', { n: 3, w: 2, tags: ['sharp'] }),
  L('Indian Defence', 'd4 Nf6 c4', { n: 3, w: 10 }),
  L('King\'s Indian Defence', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7', { n: 6, w: 10, tags: ['sharp'] }),
  L('King\'s Indian: Samisch', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5 Qd2 f5', { n: 8, w: 3, tags: ['sharp'] }),
  L('King\'s Indian: Fianchetto', 'd4 Nf6 c4 g6 g3 Bg7 Bg2 O-O Nc3 d6 Nf3 Nbd7 O-O e5 e4 c6', { n: 6, w: 3, tags: ['positional'] }),
  L('Nimzo-Indian Defence', 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4 Qc7', { n: 8, w: 10, tags: ['positional'] }),
  L('Nimzo-Indian: Classical', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7 e3 d6 f3 Nbd7', { n: 8, w: 5, tags: ['positional'] }),
  L('Queen\'s Indian Defence', 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6 Bc3 d5 Ne5 Nfd7', { n: 6, w: 6, tags: ['solid', 'positional'] }),
  L('Grunfeld Defence', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Be3 Qa5 Qd2 Bg4', { n: 6, w: 5, tags: ['sharp'] }),
  L('Benoni Defence', 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O O-O Re8', { n: 4, w: 3, tags: ['sharp'] }),
  L('Benko Gambit', 'd4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6 Nc3 d6 e4 Bxf1 Kxf1 g6', { n: 6, w: 2, tags: ['gambit', 'sharp'] }),
  L('Catalan Opening', 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6 Qxc4 b5 Qc2 Bb7', { n: 7, w: 6, tags: ['positional'] }),
  L('Dutch Defence: Leningrad', 'd4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6 Nc3 Qe8', { n: 4, w: 2, tags: ['sharp'] }),
  L('Dutch Defence: Stonewall', 'd4 f5 c4 Nf6 g3 e6 Bg2 Be7 Nf3 O-O O-O d5 b3 c6', { n: 4, w: 2, tags: ['solid'] }),
  L('Old Indian Defence', 'd4 Nf6 c4 d6 Nc3 Nbd7 e4 e5 Nf3 c6 Be2 Be7 O-O O-O', { n: 4, w: 1 }),
  L('Budapest Gambit', 'd4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4+ Nbd2 Qe7', { n: 4, w: 1, tags: ['gambit', 'sharp'] }),

  // ---------------- English / Reti / others ----------------
  L('English Opening', 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 d3 O-O', { n: 1, w: 10, tags: ['positional'] }),
  L('English: Symmetrical', 'c4 c5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nc7 Nf3 Nc6 O-O e5 d3 Be7', { n: 2, w: 5, tags: ['positional'] }),
  L('English: Anglo-Indian', 'c4 Nf6 Nc3 e6 Nf3 d5 d4 Be7 Bg5 O-O e3 h6 Bh4 b6', { n: 2, w: 3 }),
  L('English: King\'s English, Four Knights', 'c4 e5 Nc3 Nc6 Nf3 Nf6 g3 Bb4 Bg2 O-O O-O e4 Ng5 Bxc3 dxc3 h6', { n: 4, w: 2 }),
  L('Reti Opening', 'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O b3 c5 Bb2 Nc6', { n: 1, w: 6, tags: ['positional', 'solid'] }),
  L('Reti: King\'s Indian Attack', 'Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O Nbd2 c5 e4 Nc6', { n: 3, w: 3, tags: ['solid'] }),
  L('Bird\'s Opening', 'f4 d5 Nf3 Nf6 e3 g6 Be2 Bg7 O-O O-O d3 c5', { n: 1, w: 1, tags: ['sharp'] }),
  L('Larsen\'s Opening', 'b3 e5 Bb2 Nc6 e3 d5 Bb5 Bd6 f4 Qh4+ g3 Qe7', { n: 1, w: 1 }),
  L('Zukertort / Reti 1...Nf6', 'Nf3 Nf6 c4 g6 Nc3 Bg7 e4 d6 d4 O-O Be2 e5 O-O Nc6', { n: 2, w: 2 }),
];

// ---------------- Opening trainer lessons ----------------

export interface LearnStep { san: string; text: string; }

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  userColor: 0 | 1;
  /** SAN moves played automatically to reach the training start position. */
  setup: string;
  description: string;
  goals: string[];
  /** Guided "learn" line from the setup position: each step is one of the user's or opponent's moves. */
  learn: LearnStep[];
  /** Name of opponent replies to promote (book filter), e.g. only lines starting with these prefixes. */
  focusPrefix?: string;
  /** start with "let me choose the opponent's reply" switched on */
  chooserDefault?: boolean;
}

export const LESSONS: Lesson[] = [
  {
    id: 'italian',
    title: 'Italian Game',
    subtitle: '1.e4 e5 2.Nf3 Nc6 3.Bc4 — you are White',
    userColor: 0,
    setup: '',
    focusPrefix: 'e4 e5 Nf3 Nc6 Bc4',
    description: 'A classical opening aiming at quick development, central control and pressure on f7. Practise the first moves and see how Black can deviate.',
    goals: ['Develop knights and bishop before moving pawns twice', 'Castle early', 'Prepare the central break d3/c3 and d4', 'Know the main Black replies: 3...Bc5, 3...Nf6, 3...Be7'],
    learn: [
      { san: 'e4', text: 'Take the centre and open lines for the queen and bishop.' },
      { san: 'e5', text: 'Black mirrors, claiming the centre too.' },
      { san: 'Nf3', text: 'Develops with tempo: attacks the e5 pawn.' },
      { san: 'Nc6', text: 'Black defends e5 and develops.' },
      { san: 'Bc4', text: 'The Italian bishop eyes f7, Black\'s weakest square before castling.' },
      { san: 'Bc5', text: 'Black copies: the Giuoco Piano ("quiet game").' },
      { san: 'c3', text: 'Prepares d4 to build a strong pawn centre and gives the bishop a retreat on c2/b3.' },
      { san: 'Nf6', text: 'Black develops and hits e4.' },
      { san: 'd3', text: 'The modern "Giuoco Pianissimo": a slow, solid plan keeping tension and avoiding sharp theory.' },
      { san: 'd6', text: 'Black supports e5 and opens the c8-bishop.' },
      { san: 'O-O', text: 'King to safety. Castle before starting any plan.' },
      { san: 'a6', text: 'Black prepares ...Ba7 so the bishop isn\'t exchanged.' },
      { san: 'Bb3', text: 'Keep the bishop on the a2-g8 diagonal.' },
      { san: 'Ba7', text: 'The bishop keeps its diagonal too.' },
      { san: 'Re1', text: 'Supports e4 and prepares Nbd2-f1-g3 and the central break d4.' },
    ],
  },
  {
    id: 'giuoco',
    title: 'Giuoco Piano',
    subtitle: '3...Bc5 — the "quiet game". Learn both main plans',
    userColor: 0,
    setup: 'e4 e5 Nf3 Nc6 Bc4 Bc5',
    focusPrefix: 'e4 e5 Nf3 Nc6 Bc4 Bc5',
    description: 'Start from the Giuoco Piano position. Choose between the slow plan (c3 + d3) and the sharper central plan (c3 + d4).',
    goals: ['Play c3 to prepare d4', 'Decide between d3 (slow) and d4 (sharp)', 'Know the ...Bb4+ resource after d4 exd4 cxd4', 'Keep your king safe: castle before opening the centre'],
    learn: [
      { san: 'c3', text: 'The key move. Threatens d4, forming a big centre and attacking the c5 bishop.' },
      { san: 'Nf6', text: 'Black counterattacks e4 and develops.' },
      { san: 'd4', text: 'The classical, sharp plan: challenge the centre immediately.' },
      { san: 'exd4', text: 'Black takes. If 5...Bb6, then 6.dxe5 Nxe4 gives White a comfortable game.' },
      { san: 'cxd4', text: 'Recapture with the pawn to keep a strong centre, attacking the bishop.' },
      { san: 'Bb4+', text: 'A check. You can block with Bd2 (the solid choice) or Nc3 (the sharp, main line).' },
      { san: 'Bd2', text: 'Solid: after ...Bxd2+ Nbxd2 d5! Black equalises, but you keep a healthy position.' },
      { san: 'Bxd2+', text: 'Trading bishops reduces your attack but also Black\'s counterplay.' },
      { san: 'Nbxd2', text: 'Recapture with the knight to keep the c3-pawn structure flexible.' },
      { san: 'd5', text: 'Black breaks in the centre. Accurate play is needed from here.' },
      { san: 'exd5', text: 'Open the centre and keep control with your better-developed pieces.' },
      { san: 'Nxd5', text: 'Black recaptures; now Qb3 hits d5 and b7.' },
      { san: 'Qb3', text: 'Double attack on d5 and b7. Black should defend with ...Nce7 or ...Na5.' },
    ],
  },
  {
    id: 'two-knights',
    title: 'Practise against the Two Knights Defence',
    subtitle: '3...Nf6 — you are White; face 4.Ng5, 4.d3 and more',
    userColor: 0,
    setup: 'e4 e5 Nf3 Nc6 Bc4 Nf6',
    focusPrefix: 'e4 e5 Nf3 Nc6 Bc4 Nf6',
    description: 'Black counterattacks e4 at once. Choose between the sharp 4.Ng5 (threatening f7) or the calm 4.d3. The AI will pick different replies each time.',
    goals: ['Understand 4.Ng5 d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Be2', 'Spot the traps: 5...Nxd5? 6.Nxf7 (Fried Liver)', 'Know the Traxler 4...Bc5!? and how to meet it', 'Use 4.d3 when you want a safe, positional game'],
    learn: [
      { san: 'Ng5', text: 'Threatens Nxf7 and tests Black. Black must find ...d5.' },
      { san: 'd5', text: 'The only good reply: block the bishop and counter in the centre.' },
      { san: 'exd5', text: 'Take the pawn. Black can recapture with the knight (a trap) or the main-line ...Na5.' },
      { san: 'Na5', text: 'Black avoids the Fried Liver and kicks the bishop. A pawn down, Black gets the bishop pair and development.' },
      { san: 'Bb5+', text: 'Do not retreat to e2 yet: this check forces ...c6 and wins time.' },
      { san: 'c6', text: 'Black blocks and aims to open lines against the white pieces.' },
      { san: 'dxc6', text: 'Open the b-file and the c-file to gain more material.' },
      { san: 'bxc6', text: 'Black recaptures, attacking the bishop on b5.' },
      { san: 'Be2', text: 'A key retreat, covering f3 and the kingside. You are a pawn up; Black has compensation.' },
      { san: 'h6', text: 'Black kicks the knight out of g5.' },
      { san: 'Nf3', text: 'Retreat with the knight, keeping control of e5 and d4.' },
      { san: 'e4', text: 'Black pushes with tempo, hitting the knight again.' },
      { san: 'Ne5', text: 'The knight lands on the strong central square.' },
    ],
  },
  {
    id: 'black-alternatives',
    chooserDefault: true,
    title: 'Explore Black\'s Alternatives',
    subtitle: 'After 3.Bc4 — what can Black play? (you are White)',
    userColor: 0,
    setup: 'e4 e5 Nf3 Nc6 Bc4',
    focusPrefix: 'e4 e5 Nf3 Nc6 Bc4',
    description: 'From the Italian Game position, the AI will pick different Black replies — 3...Bc5, 3...Nf6, 3...Be7, 3...Nge7, 3...f5 and more. Use the "Force this reply" list to explore any of them on demand.',
    goals: ['Recognise every common Black reply to 3.Bc4', 'Learn a plan against each', 'Practise being flexible instead of memorising one line'],
    learn: [
      { san: 'Bc5', text: '3...Bc5: Giuoco Piano. Plan: c3, d3, O-O (or c3 and d4).' },
    ],
  },
  {
    id: 'italian-black',
    title: 'Defending the Italian as Black',
    subtitle: 'You are Black: reply to 1.e4 and meet 3.Bc4 with the Two Knights',
    userColor: 1,
    setup: '',
    focusPrefix: 'e4 e5 Nf3 Nc6 Bc4',
    description: 'Play as Black against the Italian Game. The AI plays White and will choose between 4.Ng5, 4.d3, 4.Nc3, 4.d4 and others.',
    goals: ['Play 1...e5, 2...Nc6, 3...Nf6 or 3...Bc5', 'Meet 4.Ng5 with 4...d5!', 'Know when 4...Bc5 (Traxler) is worth the risk', 'Develop, castle, and fight for the centre'],
    learn: [
      { san: 'e4', text: 'White takes the centre.' },
      { san: 'e5', text: 'You answer symmetrically — a classical, solid reply.' },
      { san: 'Nf3', text: 'White attacks e5.' },
      { san: 'Nc6', text: 'Defend e5 with a developing move.' },
      { san: 'Bc4', text: 'The Italian Game bishop.' },
      { san: 'Nf6', text: 'The Two Knights Defence: counterattack e4 and develop. It leads to sharper play than 3...Bc5.' },
      { san: 'Ng5', text: 'White threatens Nxf7. You must reply 4...d5!' },
      { san: 'd5', text: 'The only good move. Block the bishop\'s diagonal and challenge the centre.' },
      { san: 'exd5', text: 'White takes the pawn.' },
      { san: 'Na5', text: 'Avoid 5...Nxd5? 6.Nxf7 (Fried Liver). Kick the bishop instead.' },
    ],
  },
];

/** Start positions players can jump to ("play from a specific opening position"). */
export interface StartPosition { id: string; name: string; setup: string; userColor: 0 | 1; }
export const START_POSITIONS: StartPosition[] = [
  { id: 'italian', name: 'Italian Game (3.Bc4)', setup: 'e4 e5 Nf3 Nc6 Bc4', userColor: 0 },
  { id: 'giuoco', name: 'Giuoco Piano (3...Bc5)', setup: 'e4 e5 Nf3 Nc6 Bc4 Bc5', userColor: 0 },
  { id: 'pianissimo', name: 'Giuoco Pianissimo (4.c3 Nf6 5.d3)', setup: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3', userColor: 1 },
  { id: 'classical', name: 'Giuoco Piano, Classical (4.c3 Nf6 5.d4)', setup: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4', userColor: 1 },
  { id: 'twoknights', name: 'Two Knights Defence (3...Nf6)', setup: 'e4 e5 Nf3 Nc6 Bc4 Nf6', userColor: 0 },
  { id: 'knightattack', name: 'Two Knights: 4.Ng5', setup: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5', userColor: 1 },
  { id: 'fried', name: 'Two Knights: 4.Ng5 d5 5.exd5', setup: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5', userColor: 1 },
  { id: 'evans', name: 'Evans Gambit (4.b4)', setup: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4', userColor: 1 },
  { id: 'ruy', name: 'Ruy Lopez (3.Bb5)', setup: 'e4 e5 Nf3 Nc6 Bb5', userColor: 1 },
  { id: 'sicilian', name: 'Sicilian Defence (1.e4 c5)', setup: 'e4 c5', userColor: 0 },
  { id: 'qgd', name: 'Queen\'s Gambit (2.c4)', setup: 'd4 d5 c4', userColor: 1 },
];
