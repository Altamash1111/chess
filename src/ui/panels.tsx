import React, { useEffect, useRef, useState } from 'react';
import { GameController } from './controller';
import { AnalysisManager } from './analysis';
import { Trainer, LESSONS, START_POSITIONS } from './trainer';
import { useSettings, updateSettings, BOARD_THEMES, CLOCK_PRESETS, getSettings } from './settings';
import { PIECE_SETS, PieceSvg } from './pieces';
import { LEVELS, getLevel } from '../engine/levels';
import { PERSONALITIES, getPersonality } from '../engine/personalities';
import { MoveList, NavButtons, EvalGraph, Modal, useCtl, CLASS_ICON } from './shared';
import { bookMoves, openingName } from '../engine/book';
import { formatScore } from '../engine/search';
import { CLASS_LABEL } from '../engine/explain';
import { sqFromName, validateFen, START_FEN } from '../chess/position';
import { configureSound } from './sounds';
import { Arrow, Mark } from './Board';

// ------------------------------------------------------------------ dialogs
export function FenDialog({ ctl, onClose, onLoad }: { ctl: GameController; onClose: () => void; onLoad: (fen: string) => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const current = ctl.fen();
  const submit = () => {
    const e = validateFen(text.trim());
    if (e) { setErr(e); return; }
    onLoad(text.trim()); onClose();
  };
  return (
    <Modal title="Load / copy FEN" onClose={onClose}>
      <label className="field-label">Paste a FEN position</label>
      <textarea className="input mono" rows={3} value={text} placeholder={START_FEN} onChange={e => { setText(e.target.value); setErr(null); }} data-testid="fen-input" />
      {err && <div className="error" data-testid="fen-error">{err}</div>}
      <div className="row gap">
        <button className="btn primary" onClick={submit} data-testid="fen-load">Load position</button>
        <button className="btn" onClick={() => setText(START_FEN)}>Start position</button>
      </div>
      <label className="field-label">Current position</label>
      <div className="row gap"><code className="code-box" data-testid="fen-current">{current}</code><button className="btn" onClick={() => navigator.clipboard?.writeText(current)}>Copy</button></div>
    </Modal>
  );
}

export function PgnDialog({ ctl, onClose, onLoad }: { ctl: GameController; onClose: () => void; onLoad: (pgn: string) => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pgn = ctl.pgn();
  const submit = () => {
    try { onLoad(text); onClose(); } catch (e: any) { setErr(e.message ?? String(e)); }
  };
  const download = () => {
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'game.pgn'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <Modal title="PGN import / export" onClose={onClose} wide>
      <label className="field-label">Export current game</label>
      <textarea className="input mono" rows={7} readOnly value={pgn} data-testid="pgn-export" />
      <div className="row gap"><button className="btn" onClick={() => navigator.clipboard?.writeText(pgn)}>Copy PGN</button><button className="btn" onClick={download}>Download .pgn</button></div>
      <label className="field-label">Import a game (paste PGN or choose a file)</label>
      <textarea className="input mono" rows={6} value={text} onChange={e => { setText(e.target.value); setErr(null); }} placeholder='[Event "?"]  1. e4 e5 2. Nf3 …' data-testid="pgn-input" />
      {err && <div className="error" data-testid="pgn-error">{err}</div>}
      <div className="row gap">
        <button className="btn primary" onClick={submit} data-testid="pgn-load">Import PGN</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Choose file…</button>
        <input ref={fileRef} type="file" accept=".pgn,.txt" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
      </div>
    </Modal>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const set = (p: Partial<typeof s>) => { updateSettings(p); const n = getSettings(); configureSound(n.sound, n.volume); };
  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="settings-grid">
        <section>
          <h4>Board theme</h4>
          <div className="swatches">
            {BOARD_THEMES.map(t => (
              <button key={t.id} className={`swatch${s.theme === t.id ? ' active' : ''}`} onClick={() => set({ theme: t.id })} title={t.name} data-theme-id={t.id} aria-label={t.name}>
                <span style={{ background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)` }} /><em>{t.name}</em>
              </button>
            ))}
          </div>
          <h4>Piece set</h4>
          <div className="pieceset-list">
            {PIECE_SETS.map(ps => (
              <button key={ps.id} className={`pieceset${s.pieceSet === ps.id ? ' active' : ''}`} onClick={() => set({ pieceSet: ps.id })} data-set-id={ps.id}>
                <span className="pieceset-prev"><PieceSvg type={2} color={0} setId={ps.id} /><PieceSvg type={5} color={1} setId={ps.id} /></span>
                <em>{ps.name}</em>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h4>Interface</h4>
          <Toggle label="Move sounds" value={s.sound} onChange={v => set({ sound: v })} />
          <div className="row gap center"><span className="small muted">Volume</span><input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={e => set({ volume: +e.target.value })} aria-label="Volume" /></div>
          <Toggle label="Show legal-move indicators" value={s.showLegal} onChange={v => set({ showLegal: v })} />
          <Toggle label="Show board coordinates" value={s.showCoords} onChange={v => set({ showCoords: v })} />
          <Toggle label="Animate piece movement" value={s.animate} onChange={v => set({ animate: v })} />
          <Toggle label="Auto-promote to queen" value={s.autoQueen} onChange={v => set({ autoQueen: v })} />
          <Toggle label="Evaluation bar while playing" value={s.evalBar} onChange={v => set({ evalBar: v })} />
          <Toggle label="Realistic thinking time" value={s.humanDelay} onChange={v => set({ humanDelay: v })} />
          <Toggle label="Show the engine's thoughts" value={s.showAiThoughts} onChange={v => set({ showAiThoughts: v })} />
          <Toggle label="Confirm before resigning" value={s.confirmResign} onChange={v => set({ confirmResign: v })} />
        </section>
      </div>
    </Modal>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle"><span>{label}</span>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} /><i className="slider" />
    </label>
  );
}

// ------------------------------------------------------------------ opponent selection
export function OpponentPicker({ level, personality, onLevel, onPersonality }: { level: string; personality: string; onLevel: (v: string) => void; onPersonality: (v: string) => void }) {
  const lv = getLevel(level), pe = getPersonality(personality);
  return (
    <div className="picker">
      <label className="field-label">Difficulty</label>
      <div className="levels" role="radiogroup" aria-label="Difficulty">
        {LEVELS.map((l, i) => (
          <button key={l.id} role="radio" aria-checked={level === l.id} className={`lvl${level === l.id ? ' active' : ''}`} onClick={() => onLevel(l.id)} data-level={l.id} title={l.blurb}>
            <span className="lvl-bars">{LEVELS.map((_, j) => <i key={j} className={j <= i ? 'on' : ''} />)}</span>{l.name}
          </button>
        ))}
      </div>
      <p className="small muted">{lv.blurb}</p>
      <label className="field-label">Personality</label>
      <div className="personalities" role="radiogroup" aria-label="Personality">
        {PERSONALITIES.map(p => (
          <button key={p.id} role="radio" aria-checked={personality === p.id} className={`pers${personality === p.id ? ' active' : ''}`} onClick={() => onPersonality(p.id)} data-personality={p.id}>
            <span className="pers-icon">{p.icon}</span><span><b>{p.name}</b><small>{p.tagline}</small></span>
          </button>
        ))}
      </div>
      <p className="small muted">{pe.description}</p>
    </div>
  );
}

// ------------------------------------------------------------------ PLAY
export function PlayPanel({ ctl, openFen, openPgn, onAnalyze }: { ctl: GameController; openFen: () => void; openPgn: () => void; onAnalyze: () => void }) {
  useCtl(ctl);
  const s = useSettings();
  const [setupOpen, setSetupOpen] = useState(true);
  const [confirmResign, setConfirmResign] = useState(false);
  const started = ctl.plyCount > 0 || ctl.thinking;
  const over = ctl.over;
  const last = ctl.aiLog[ctl.aiLog.length - 1];
  const pe = getPersonality(ctl.personality), lv = getLevel(ctl.level);

  useEffect(() => { if (over) setConfirmResign(false); }, [over]);

  const startGame = () => {
    setSetupOpen(false);
    void ctl.newGame({ color: s.playerColor, level: s.level, personality: s.personality, clock: s.clock });
  };

  return (
    <div className="panel-stack">
      <section className="card opp-card">
        <div className="opp-head">
          <div className="avatar big">{pe.icon}</div>
          <div><div className="opp-name">{pe.name}</div><div className="small muted">{lv.name} · {pe.tagline}</div></div>
        </div>
        {s.showAiThoughts && (
          <div className="thoughts" data-testid="ai-thoughts">
            {ctl.thinking ? <span className="muted">Thinking…</span>
              : last ? (<><div className="thought-head"><b>{last.san}</b>{last.source === 'book' && <span className="tag book">book</span>}{last.mistake && <span className="tag slip">slip</span>}{last.book && <span className="tag">{last.book}</span>}</div><p>{last.text}</p></>)
                : <span className="muted">Make your first move. The opponent will explain its ideas here.</span>}
          </div>
        )}
      </section>

      <section className="card">
        <div className="btn-grid">
          <button className="btn primary" onClick={() => setSetupOpen(o => !o)} data-testid="new-game-toggle">{setupOpen ? 'Hide setup' : 'New game'}</button>
          <button className="btn" disabled={!ctl.canUndo()} onClick={() => ctl.undo()} data-testid="undo">↶ Takeback</button>
          <button className="btn" onClick={() => ctl.flip()} data-testid="flip">⇅ Flip board</button>
          {!confirmResign ? (
            <button className="btn danger" disabled={over || !started} onClick={() => s.confirmResign ? setConfirmResign(true) : ctl.resign()} data-testid="resign">⚑ Resign</button>
          ) : (
            <span className="confirm"><button className="btn danger" onClick={() => { ctl.resign(); setConfirmResign(false); }} data-testid="resign-confirm">Confirm</button><button className="btn" onClick={() => setConfirmResign(false)}>Cancel</button></span>
          )}
          <button className="btn" disabled={over || ctl.thinking || ctl.plyCount < 2} onClick={() => void ctl.offerDraw()} data-testid="draw">½ Offer draw</button>
          <button className="btn" onClick={openFen} data-testid="fen-open">FEN</button>
          <button className="btn" onClick={openPgn} data-testid="pgn-open">PGN</button>
          <button className="btn" disabled={ctl.plyCount === 0} onClick={onAnalyze} data-testid="analyze-game">Review game</button>
        </div>
      </section>

      {setupOpen && (
        <section className="card">
          <h4>New game</h4>
          <label className="field-label">Play as</label>
          <div className="seg" role="radiogroup">
            {(['white', 'black', 'random'] as const).map(c => <button key={c} role="radio" aria-checked={s.playerColor === c} className={s.playerColor === c ? 'active' : ''} onClick={() => updateSettings({ playerColor: c })} data-color={c}>{c[0].toUpperCase() + c.slice(1)}</button>)}
          </div>
          <label className="field-label">Clock (minutes + increment)</label>
          <div className="chips">
            {CLOCK_PRESETS.map(c => <button key={c} className={`chip${s.clock === c ? ' active' : ''}`} onClick={() => updateSettings({ clock: c })} data-clock={c}>{c === 'off' ? 'No clock' : c}</button>)}
          </div>
          <OpponentPicker level={s.level} personality={s.personality} onLevel={v => updateSettings({ level: v })} onPersonality={v => updateSettings({ personality: v })} />
          <button className="btn primary wide" onClick={startGame} data-testid="start-game">Start game</button>
        </section>
      )}

      <section className="card grow">
        <div className="row between center"><h4>Moves</h4><NavButtons ctl={ctl} /></div>
        <MoveList ctl={ctl} />
        <OpeningLine ctl={ctl} />
      </section>
    </div>
  );
}

function OpeningLine({ ctl }: { ctl: GameController }) {
  const name = openingName(ctl.viewPos);
  return name ? <div className="opening-name" data-testid="opening-name">📖 {name}</div> : null;
}

// ------------------------------------------------------------------ ANALYSIS
export function AnalysisPanel({ ctl, mgr, playCtl, openFen, openPgn }: { ctl: GameController; mgr: AnalysisManager; playCtl: GameController; openFen: () => void; openPgn: () => void }) {
  useCtl(ctl);
  const rv = mgr.review;
  const cur = ctl.viewIndex;
  const [quality, setQuality] = useState<'quick' | 'deep'>('quick');
  const book = bookMoves(ctl.viewPos);
  const totalW = book.reduce((a, b) => a + b.weight, 0) || 1;
  const goPly = (n: number) => { ctl.goTo(n); mgr.refresh(); };

  return (
    <div className="panel-stack">
      <ReviewCard ctl={ctl} mgr={mgr} quality={quality} setQuality={setQuality} goPly={goPly} />

      <section className="card grow">
        <div className="row between center"><h4>Moves</h4><NavButtons ctl={ctl} onNav={() => mgr.refresh()} /></div>
        <MoveList ctl={ctl} review={rv.status === 'done' ? rv.moves : undefined} onSelect={n => goPly(n)} />
        <OpeningLine ctl={ctl} />
        {book.length > 0 && (
          <div className="explorer" data-testid="explorer">
            <h5>Opening explorer</h5>
            {book.slice(0, 6).map(b => (
              <button key={b.uci} className="exp-row" onClick={() => { ctl.attemptMove(sqFromName(b.uci.slice(0, 2)), sqFromName(b.uci.slice(2, 4)), b.uci[4] ? ' pnbrqk'.indexOf(b.uci[4]) : 0); mgr.refresh(); }}>
                <b>{b.san}</b><span className="bar"><i style={{ width: `${Math.round(b.weight / totalW * 100)}%` }} /></span><span>{Math.round(b.weight / totalW * 100)}%</span><small>{b.lines[0]}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row between center">
          <h4>Engine analysis</h4>
          <label className="toggle compact"><span>{mgr.on ? 'On' : 'Off'}</span><input type="checkbox" checked={mgr.on} onChange={e => mgr.setOn(e.target.checked)} data-testid="analysis-toggle" /><i className="slider" /></label>
        </div>
        {!mgr.on && <p className="small muted">Turn the engine on to see its evaluation and suggested moves. Analysis is independent from the game you play against the AI.</p>}
        {mgr.on && (
          <div className="lines" data-testid="analysis-lines">
            <div className="small muted">{mgr.gameOver ? 'Game over in this position.' : `Depth ${mgr.depth}${mgr.running ? ' · searching…' : ''}`}</div>
            {mgr.lines.map((l, i) => (
              <button key={i} className="line" onClick={() => { const from = sqFromName(l.uci.slice(0, 2)), to = sqFromName(l.uci.slice(2, 4)); ctl.attemptMove(from, to, l.uci[4] ? ' pnbrqk'.indexOf(l.uci[4]) : 0); mgr.refresh(); }} title="Play this move">
                <span className={`score ${(mgr.turn === 0 ? l.score : -l.score) >= 0 ? 'w' : 'b'}`}>{formatScore(mgr.turn === 0 ? l.score : -l.score)}</span>
                <span className="pv"><b>{l.san}</b> {l.pv.slice(1, 8).join(' ')}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="btn-grid">
          <button className="btn" onClick={() => { ctl.loadPgn(playCtl.pgn()); mgr.review = { ...mgr.review, status: 'idle', moves: [] }; mgr.refresh(); }} data-testid="import-current">Import current game</button>
          <button className="btn" onClick={() => ctl.flip()}>⇅ Flip</button>
          <button className="btn" disabled={!ctl.canUndo()} onClick={() => { ctl.undo(); mgr.refresh(); }}>↶ Undo</button>
          <button className="btn" onClick={() => { ctl.loadFenFree(START_FEN); mgr.refresh(); }}>Reset board</button>
          <button className="btn" onClick={openFen}>FEN</button>
          <button className="btn" onClick={openPgn}>PGN</button>
        </div>
      </section>
    </div>
  );
}

const CLS_COLOR: Record<string, string> = { blunder: '#ef4444', mistake: '#f59e0b', inaccuracy: '#eab308', miss: '#ef4444', best: '#22c55e', excellent: '#34d399', good: '#86efac', book: '#60a5fa', brilliant: '#14b8a6' };

function reviewSel(mgr: AnalysisManager, ctl: GameController) {
  if (mgr.review.status !== 'done') return undefined;
  const i = ctl.viewIndex;
  return i > 0 ? mgr.review.moves[i - 1] : undefined;
}

export function analysisArrows(mgr: AnalysisManager, ctl: GameController): Arrow[] {
  const sel = reviewSel(mgr, ctl);
  if (sel) {
    const out: Arrow[] = [];
    const bad = ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(sel.cls);
    if (sel.bestUci && sel.bestUci !== sel.uci && (bad || sel.cls === 'good')) out.push({ from: sqFromName(sel.bestUci.slice(0, 2)), to: sqFromName(sel.bestUci.slice(2, 4)), color: '#22c55e' });
    return out;
  }
  if (!mgr.on) return [];
  const cols = ['#5fd68f', '#6cc9b5', '#e9a23b'];
  return mgr.lines.slice(0, 3).map((l, i) => ({ from: sqFromName(l.uci.slice(0, 2)), to: sqFromName(l.uci.slice(2, 4)), color: cols[i] }));
}

/** Badge on the destination square of the move being reviewed (like the ?! / ?? marks in common review UIs). */
export function analysisMarks(mgr: AnalysisManager, ctl: GameController): Mark[] {
  const sel = reviewSel(mgr, ctl);
  if (!sel) return [];
  return [{ sq: sqFromName(sel.uci.slice(2, 4)), color: 'transparent', label: CLASS_ICON[sel.cls], badge: CLS_COLOR[sel.cls] }];
}

const fmtWhite = (cp: number | undefined) => cp === undefined ? '' : Math.abs(cp) > 29000 ? (cp > 0 ? 'mate for White' : 'mate for Black') : Math.abs(cp) < 5 ? '0.0' : `${cp > 0 ? '+' : '−'}${(Math.abs(cp) / 100).toFixed(1)}`;

function ReviewCard({ ctl, mgr, quality, setQuality, goPly }: { ctl: GameController; mgr: AnalysisManager; quality: 'quick' | 'deep'; setQuality: (q: 'quick' | 'deep') => void; goPly: (n: number) => void }) {
  const rv = mgr.review;
  const cur = ctl.viewIndex;
  const n = ctl.plyCount;
  const run = () => void mgr.runReview(quality === 'quick' ? 8 : 12, quality === 'quick' ? 350 : 1200);
  if (rv.status !== 'done') {
    return (
      <section className="card">
        <div className="row between center"><h4>Game review</h4>
          <div className="seg small"><button className={quality === 'quick' ? 'active' : ''} onClick={() => setQuality('quick')}>Quick</button><button className={quality === 'deep' ? 'active' : ''} onClick={() => setQuality('deep')}>Deep</button></div>
        </div>
        {rv.status === 'idle' && <><p className="small muted">Checks every move with the engine, labels mistakes and blunders, and explains what went wrong.</p>
          <button className="btn primary wide" disabled={n === 0} onClick={run} data-testid="run-review">Review this game ({n} moves)</button></>}
        {rv.status === 'running' && (<div><div className="progress"><div style={{ width: `${rv.progress * 100}%` }} /></div><div className="row between center"><span className="small muted">Analysing… {Math.round(rv.progress * 100)}%</span><button className="btn" onClick={() => mgr.cancelReview()}>Cancel</button></div></div>)}
        {rv.status === 'error' && <><div className="error">{rv.error}</div><button className="btn wide" onClick={() => mgr.cancelReview()}>OK</button></>}
      </section>
    );
  }
  const sel = cur > 0 ? rv.moves[cur - 1] : undefined;
  const bad = (c: string) => c === 'mistake' || c === 'blunder' || c === 'miss';
  const keyPlies = rv.moves.filter(m => bad(m.cls)).map(m => m.ply);
  const prevKey = [...keyPlies].reverse().find(p => p < cur);
  const nextKey = keyPlies.find(p => p > cur);
  const who = sel ? (sel.color === 0 ? 'White' : 'Black') : '';
  const showBetter = sel && sel.bestSan && sel.uci !== sel.bestUci && !['book', 'best'].includes(sel.cls);
  return (
    <section className="card review" data-testid="review-summary">
      <div className="row between center"><h4>Game review</h4><button className="btn" onClick={() => mgr.cancelReview()}>Clear</button></div>
      <div className="acc-row">
        <div><span className="small muted">⚪ White accuracy</span><b>{rv.accuracy[0].toFixed(0)}%</b></div>
        <div><span className="small muted">⚫ Black accuracy</span><b>{rv.accuracy[1].toFixed(0)}%</b></div>
      </div>
      <EvalGraph values={rv.evalsWhite} current={cur} onPick={goPly} />
      <div className="coach-card" data-testid="move-explanation">
        {!sel && <p className="small muted">Start of the game. Press ▶ (or the → key) to step through each move, or jump straight to the key moments below.</p>}
        {sel && <>
          <div className="coach-head">
            <i className={`badge big b-${sel.cls}`}>{CLASS_ICON[sel.cls]}</i>
            <div><b className="coach-san">{Math.ceil(sel.ply / 2)}{sel.color === 0 ? '.' : '…'} {sel.san}</b><div className="small muted">{who} · {CLASS_LABEL[sel.cls]}</div></div>
            <div className="coach-eval" title="Evaluation before → after (White's view)"><span>{fmtWhite(rv.evalsWhite[cur - 1])}</span> → <b>{fmtWhite(rv.evalsWhite[cur])}</b></div>
          </div>
          <p>{sel.text}</p>
          {showBetter && <div className="better">Better was <b>{sel.bestSan}</b> <span className="small muted">(green arrow)</span></div>}
        </>}
      </div>
      <div className="review-nav">
        <button className="btn" disabled={prevKey === undefined} onClick={() => prevKey !== undefined && goPly(prevKey)} data-testid="prev-mistake">◀ Prev mistake</button>
        <button className="btn" disabled={nextKey === undefined} onClick={() => nextKey !== undefined && goPly(nextKey)} data-testid="next-mistake">Next mistake ▶</button>
      </div>
      <div className="review-steps"><NavButtons ctl={ctl} onNav={() => mgr.refresh()} /></div>
      <details className="counts-wrap">
        <summary>Move quality summary</summary>
        <table className="counts"><thead><tr><th></th><th>White</th><th>Black</th></tr></thead><tbody>
          {(['brilliant', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'] as const).filter(c => (rv.counts[0][c] ?? 0) + (rv.counts[1][c] ?? 0) > 0).map(c => (
            <tr key={c}><td><i className={`badge b-${c}`}>{CLASS_ICON[c]}</i> {CLASS_LABEL[c]}</td><td>{rv.counts[0][c] ?? 0}</td><td>{rv.counts[1][c] ?? 0}</td></tr>
          ))}
        </tbody></table>
      </details>
      <div className="small muted key-title">Key moments</div>
      <div className="chips">
        {rv.moves.filter(m => bad(m.cls)).length === 0 && <span className="small muted">No mistakes or blunders — a clean game.</span>}
        {rv.moves.filter(m => bad(m.cls)).slice(0, 14).map(m => (
          <button key={m.ply} className={`chip cls-${m.cls}${cur === m.ply ? ' active' : ''}`} onClick={() => goPly(m.ply)}>{Math.ceil(m.ply / 2)}{m.color === 0 ? '.' : '…'} {m.san} <i className={`badge b-${m.cls}`}>{CLASS_ICON[m.cls]}</i></button>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ TRAINING
export function TrainPanel({ ctl, trainer }: { ctl: GameController; trainer: Trainer }) {
  useCtl(ctl);
  const s = useSettings();
  const t = trainer;
  const active = !!(t.lesson || t.position);
  const explorer = t.explorer();
  const lines = active ? t.availableLines() : [];
  const name = openingName(ctl.viewPos);
  const [mode, setMode] = useState<'learn' | 'practice'>('practice');

  return (
    <div className="panel-stack">
      {!active && (
        <section className="card">
          <h4>Opening trainer</h4>
          <p className="small muted">Pick a lesson. Use <b>Learn</b> for a guided walk-through with explanations, or <b>Practice</b> to play the opening against the AI.</p>
          <div className="seg"><button className={mode === 'learn' ? 'active' : ''} onClick={() => setMode('learn')} data-testid="mode-learn">Learn</button><button className={mode === 'practice' ? 'active' : ''} onClick={() => setMode('practice')} data-testid="mode-practice">Practice vs AI</button></div>
          <div className="lessons">
            {LESSONS.map(l => (
              <button key={l.id} className="lesson" data-lesson={l.id} onClick={() => void t.startLesson(l, mode)}>
                <b>{l.title}</b><small>{l.subtitle}</small><span className="small muted">{l.description}</span>
              </button>
            ))}
          </div>
          <h4>Play from a specific position</h4>
          <div className="chips">
            {START_POSITIONS.map(sp => <button key={sp.id} className="chip" data-start={sp.id} onClick={() => void t.startPosition(sp)}>{sp.name}</button>)}
          </div>
          <div className="level-mini">
            <OpponentPicker level={s.level} personality={s.personality} onLevel={v => updateSettings({ level: v })} onPersonality={v => updateSettings({ personality: v })} />
          </div>
        </section>
      )}

      {active && (
        <>
          <section className="card">
            <div className="row between center">
              <div><h4>{t.lesson?.title ?? t.position?.name}</h4><div className="small muted">{t.lesson?.subtitle ?? 'Custom start position'}</div></div>
              <button className="btn" onClick={() => { t.stop(); ctl.emit(); }} data-testid="train-back">← Lessons</button>
            </div>
            {t.lesson && (
              <div className="seg"><button className={t.mode === 'learn' ? 'active' : ''} onClick={() => void t.startLesson(t.lesson!, 'learn')}>Learn</button><button className={t.mode === 'practice' ? 'active' : ''} onClick={() => void t.startLesson(t.lesson!, 'practice')}>Practice vs AI</button></div>
            )}
            <div className={`coach ${t.coachKind}`} data-testid="coach"><span className="coach-icon">🎓</span><p>{t.coach}</p></div>
            {t.mode === 'learn' && t.expected && <button className="btn" onClick={() => { ctl.emit(); setHint(true); }} data-testid="show-move">Show move</button>}
            <div className="btn-grid">
              <button className="btn primary" onClick={() => void t.restart(false)} data-testid="train-restart">↺ Restart (new variation)</button>
              <button className="btn" onClick={() => void t.restart(true)} data-testid="train-repeat">⟲ Repeat same line</button>
              <button className="btn" onClick={() => ctl.flip()}>⇅ Flip</button>
              <button className="btn" disabled={!ctl.canUndo() || t.mode === 'learn'} onClick={() => ctl.undo()}>↶ Takeback</button>
            </div>
            <div className="small muted">Attempt {t.attempts} · {t.accuracyText()}{t.streak > 1 ? ` · streak ${t.streak}` : ''}</div>
            {t.lesson && t.lesson.goals.length > 0 && (
              <details><summary className="small">Lesson goals</summary><ul className="goals">{t.lesson.goals.map((g, i) => <li key={i}>{g}</li>)}</ul></details>
            )}
          </section>

          {t.mode === 'practice' && (
            <section className="card">
              <h4>Opponent control</h4>
              <Toggle label="Let me choose the opponent's reply" value={t.chooser} onChange={v => t.setChooser(v)} />
              {lines.length > 0 && (
                <>
                  <label className="field-label">Make the AI follow a specific line</label>
                  <select className="input" value={t.focusLine?.name ?? ''} onChange={e => t.setFocusLine(e.target.value || null)} data-testid="focus-line">
                    <option value="">Random (book + engine)</option>
                    {lines.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                  </select>
                </>
              )}
              {t.awaitingChoice && (
                <div className="choice" data-testid="choice-box">
                  <b>Choose the opponent&apos;s reply:</b>
                  {explorer.map(m => (
                    <button key={m.uci} className="exp-row" onClick={() => t.chooseReply(m.uci)} data-uci={m.uci}><b>{m.san}</b><span className="bar"><i style={{ width: `${m.pct}%` }} /></span><span>{m.pct}%</span><small>{m.lines[0]}</small></button>
                  ))}
                  <button className="btn" onClick={() => t.chooseReply(null)}>Let the AI decide</button>
                </div>
              )}
            </section>
          )}

          <section className="card">
            <h4>Opening explorer</h4>
            {name && <div className="opening-name" data-testid="opening-name">📖 {name}</div>}
            {explorer.length === 0 ? <p className="small muted">This position is outside the opening book — the AI is using its engine.</p> : explorer.slice(0, 8).map(m => (
              <div key={m.uci} className="exp-row static"><b>{m.san}</b><span className="bar"><i style={{ width: `${m.pct}%` }} /></span><span>{m.pct}%</span><small>{m.lines[0]}</small></div>
            ))}
          </section>

          {t.feedback.length > 0 && (
            <section className="card">
              <h4>Your moves</h4>
              <ul className="feedback" data-testid="feedback">
                {t.feedback.slice(-8).map((f, i) => <li key={i} className={`fb-${f.verdict}`}><b>{Math.ceil(f.ply / 2)}{f.ply % 2 ? '.' : '…'} {f.san}</b> {f.text}</li>)}
              </ul>
            </section>
          )}
          <section className="card grow">
            <div className="row between center"><h4>Moves</h4><NavButtons ctl={ctl} /></div>
            <MoveList ctl={ctl} />
          </section>
        </>
      )}
    </div>
  );
  function setHint(_: boolean) { /* arrow is derived from trainer.hintArrow(); toggled by showHint flag */ t.showHint = true; ctl.emit(); }
}

export function trainerArrows(t: Trainer): Arrow[] {
  const a = t.showHint ? t.hintArrow() : null;
  return a ? [{ ...a, color: '#4ade80' }] : [];
}
export type { Mark };
