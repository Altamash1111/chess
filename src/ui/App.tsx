import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameController } from './controller';
import { AnalysisManager } from './analysis';
import { Trainer } from './trainer';
import { BoardArea, opponentLabel, resultText } from './BoardArea';
import { PlayPanel, AnalysisPanel, TrainPanel, FenDialog, PgnDialog, SettingsDialog, analysisArrows, analysisMarks, trainerArrows } from './panels';
import { useSettings, BOARD_THEMES, getSettings } from './settings';
import { PieceDefs } from './pieces';
import { configureSound } from './sounds';
import { useCtl } from './shared';
import { sqFromName } from '../chess/position';

type Tab = 'play' | 'analysis' | 'train';

export default function App() {
  const s = useSettings();
  const ref = useRef<{ play: GameController; train: GameController; ana: GameController; mgr: AnalysisManager; playMgr: AnalysisManager; trainer: Trainer } | null>(null);
  if (!ref.current) {
    const play = new GameController('play');
    const train = new GameController('training');
    const ana = new GameController('analysis');
    const mgr = new AnalysisManager(ana);
    const playMgr = new AnalysisManager(play);
    playMgr.maxTimeMs = 2500; playMgr.multiPV = 1;
    ana.onMove = () => mgr.refresh();
    ref.current = { play, train, ana, mgr, playMgr, trainer: new Trainer(train) };
  }
  const { play, train, ana, mgr, playMgr, trainer } = ref.current;
  const [tab, setTab] = useState<Tab>('play');
  const [dialog, setDialog] = useState<null | 'fen' | 'pgn' | 'settings'>(null);
  const [focus, setFocus] = useState(false);
  const toggleFocus = (on?: boolean) => {
    const next = on ?? !focusRef.current;
    setFocus(next);
    try {
      if (next && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
      if (!next && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    } catch { /* fullscreen API unavailable: the CSS focus layout still works */ }
  };
  const focusRef = useRef(false); focusRef.current = focus;
  useEffect(() => {
    const h = () => { if (!document.fullscreenElement && focusRef.current) setFocus(false); };
    document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  useCtl(play); useCtl(train); useCtl(ana);

  useEffect(() => { const n = getSettings(); configureSound(n.sound, n.volume); void play.newGame(); return () => { /* controllers live for the page lifetime */ }; }, []); // eslint-disable-line

  const ctl = tab === 'play' ? play : tab === 'train' ? train : ana;

  // analysis engine only runs while the Analysis tab is visible
  useEffect(() => { if (tab === 'analysis') mgr.refresh(); else mgr.stop(); }, [tab]); // eslint-disable-line
  // optional evaluation bar during play
  useEffect(() => {
    if (tab !== 'play' || !s.evalBar) { if (playMgr.on) playMgr.setOn(false); return; }
    playMgr.on = true; playMgr.refresh();
  }, [s.evalBar, tab, play.viewIndex, play.plyCount]); // eslint-disable-line

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'ArrowLeft') { ctl.step(-1); if (tab === 'analysis') mgr.refresh(); }
      else if (e.key === 'ArrowRight') { ctl.step(1); if (tab === 'analysis') mgr.refresh(); }
      else if (e.key === 'ArrowUp') { ctl.goTo(0); if (tab === 'analysis') mgr.refresh(); }
      else if (e.key === 'ArrowDown') { ctl.goTo(null); if (tab === 'analysis') mgr.refresh(); }
      else if (e.key === 'f') ctl.flip();
      else if (e.key === 'F') toggleFocus();
      else if (e.key === 'Escape' && focusRef.current) toggleFocus(false);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [ctl, tab, mgr]);

  const theme = BOARD_THEMES.find(t => t.id === s.theme) ?? BOARD_THEMES[0];
  const cssVars = { '--sq-light': theme.light, '--sq-dark': theme.dark, '--frame': theme.frame, '--coord-light': theme.coordLight, '--coord-dark': theme.coordDark } as React.CSSProperties;

  const openFen = () => setDialog('fen');
  const openPgn = () => setDialog('pgn');
  const startReview = () => {
    ana.loadPgn(play.pgn(), { color: 'white' });
    ana.orientation = play.orientation;
    setTab('analysis');
    mgr.review = { ...mgr.review, status: 'idle' };
    mgr.setOn(true);
    void mgr.runReview(8, 350);
  };

  const label = (c: GameController) => {
    const opp = opponentLabel(c);
    const mk = (color: 0 | 1) => c.freeMode ? { name: color === 0 ? 'White' : 'Black', sub: undefined, icon: undefined } : color === c.playerColor ? { name: 'You', sub: undefined, icon: color === 0 ? '♔' : '♚' } : { name: opp.name, sub: opp.sub, icon: opp.icon };
    const top = mk((1 - c.orientation) as 0 | 1), bottom = mk(c.orientation);
    return { topName: top.name, topSub: top.sub, topIcon: top.icon, bottomName: bottom.name, bottomSub: bottom.sub, bottomIcon: bottom.icon };
  };

  const arrows = tab === 'analysis' ? analysisArrows(mgr, ana) : tab === 'train' ? trainerArrows(trainer) : [];
  const reviewDone = mgr.review.status === 'done';
  const reviewEval = reviewDone ? mgr.review.evalsWhite[ana.viewIndex] ?? null : null;
  const evalWhite = tab === 'analysis' ? (mgr.on ? (mgr.evalWhite() ?? reviewEval) : reviewEval) : tab === 'play' ? playMgr.evalWhite() : null;
  const showEvalBar = tab === 'analysis' ? (mgr.on || reviewDone) : tab === 'play' && s.evalBar;
  const marks = tab === 'analysis' ? analysisMarks(mgr, ana) : [];

  return (
    <div className={`app${focus ? ' focus' : ''}`} style={cssVars} data-theme={theme.id}>
      <PieceDefs />
      <header className="topbar">
        <div className="logo"><span className="logo-mark">♞</span><div><b>PROJECT GRANDMASTER</b><small>Human-like chess opponent</small></div></div>
        <nav className="tabs" role="tablist">
          {(['play', 'train', 'analysis'] as Tab[]).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)} data-tab={t}>{t === 'play' ? 'Play' : t === 'train' ? 'Opening Trainer' : 'Analysis'}</button>
          ))}
        </nav>
        <button className="btn" onClick={() => toggleFocus()} aria-label="Full screen board" title="Full screen board (Shift+F)" data-testid="focus-toggle">⛶ Full screen</button>
        <button className="btn icon" onClick={() => setDialog('settings')} aria-label="Settings" data-testid="settings-open">⚙</button>
      </header>
      {focus && <button className="focus-exit btn" onClick={() => toggleFocus(false)} data-testid="focus-exit" title="Exit full screen (Esc)">✕ Exit full screen</button>}
      <main className="main">
        <BoardArea ctl={ctl} {...label(ctl)} arrows={arrows} marks={marks} evalWhite={evalWhite} showEvalBar={showEvalBar}
          overlay={tab !== 'analysis' ? <GameOver ctl={ctl} onNew={() => { if (tab === 'play') void play.newGame(); else void trainer.restart(false); }} onReview={startReview} /> : null} />
        <aside className="side">
          {tab === 'play' && <PlayPanel ctl={play} openFen={openFen} openPgn={openPgn} onAnalyze={startReview} />}
          {tab === 'analysis' && <AnalysisPanel ctl={ana} mgr={mgr} playCtl={play} openFen={openFen} openPgn={openPgn} />}
          {tab === 'train' && <TrainPanel ctl={train} trainer={trainer} />}
        </aside>
      </main>
      {dialog === 'fen' && <FenDialog ctl={ctl} onClose={() => setDialog(null)} onLoad={fen => { if (tab === 'analysis') { ana.loadFenFree(fen); mgr.refresh(); } else if (tab === 'train') { train.loadFen(fen); } else play.loadFen(fen); }} />}
      {dialog === 'pgn' && <PgnDialog ctl={ctl} onClose={() => setDialog(null)} onLoad={pgn => { if (tab === 'analysis') { ana.loadPgn(pgn, { color: 'white' }); mgr.review = { ...mgr.review, status: 'idle', moves: [] }; mgr.refresh(); } else if (tab === 'train') train.loadPgn(pgn); else play.loadPgn(pgn); }} />}
      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

function GameOver({ ctl, onNew, onReview }: { ctl: GameController; onNew: () => void; onReview: () => void }) {
  const res = resultText(ctl);
  const [closed, setClosed] = useState(false);
  const key = ctl.plyCount + (res?.title ?? '');
  useEffect(() => setClosed(false), [key]);
  if (!res || closed) return null;
  return (
    <div className="gameover" data-testid="gameover">
      <div className="gameover-card">
        <button className="btn icon close" onClick={() => setClosed(true)} aria-label="Dismiss">✕</button>
        <div className="go-title">{res.title}</div>
        <div className="go-sub">{res.sub}</div>
        <div className="row gap">
          <button className="btn primary" onClick={onNew} data-testid="go-new">New game</button>
          <button className="btn" onClick={onReview} data-testid="go-review">Review game</button>
        </div>
      </div>
    </div>
  );
}
