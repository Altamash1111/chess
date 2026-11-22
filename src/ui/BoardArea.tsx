import React from 'react';
import { GameController } from './controller';
import { Board, Arrow, Mark } from './Board';
import { Captured, Clock, EvalBar, useCtl } from './shared';
import { useSettings } from './settings';
import { getLevel } from '../engine/levels';
import { getPersonality } from '../engine/personalities';
import { typeOf } from '../chess/position';

export function resultText(ctl: GameController): { title: string; sub: string } | null {
  const st = ctl.status;
  if (!st.over) return null;
  const you = ctl.playerColor;
  const reason: Record<string, string> = {
    checkmate: 'by checkmate', stalemate: 'by stalemate', insufficient: 'by insufficient material', fifty: 'by the fifty-move rule',
    repetition: 'by threefold repetition', resignation: 'by resignation', timeout: 'on time', agreement: 'by agreement', none: '',
  };
  if (st.result === '1/2-1/2') return { title: 'Draw', sub: reason[st.reason] ?? '' };
  if (ctl.freeMode) return { title: st.winner === 0 ? 'White wins' : 'Black wins', sub: reason[st.reason] };
  return st.winner === you ? { title: 'You win!', sub: reason[st.reason] } : { title: 'You lose', sub: reason[st.reason] };
}

export interface BoardAreaProps {
  ctl: GameController;
  topName: string; topSub?: string; topIcon?: string;
  bottomName: string; bottomSub?: string; bottomIcon?: string;
  arrows?: Arrow[];
  marks?: Mark[];
  evalWhite?: number | null;   // when defined, shows the evaluation bar
  showEvalBar?: boolean;
  overlay?: React.ReactNode;
  statusText?: string;
}

export function BoardArea(props: BoardAreaProps) {
  const { ctl } = props;
  useCtl(ctl);
  const s = useSettings();
  const top = (1 - ctl.orientation) as 0 | 1;
  const bottom = ctl.orientation;
  const res = resultText(ctl);
  const viewing = !ctl.isLive;
  const status = props.statusText ?? (res ? `${res.title} ${res.sub}` : viewing ? 'Viewing an earlier position' : ctl.thinking ? 'Opponent is thinking…' : ctl.freeMode ? `${ctl.game.pos.turn === 0 ? 'White' : 'Black'} to move` : ctl.game.pos.turn === ctl.playerColor ? 'Your move' : 'Opponent to move');
  const pos = ctl.viewPos;
  return (
    <div className="board-area">
      <div className="board-row">
        {props.showEvalBar && <EvalBar whiteCp={props.evalWhite ?? null} orientation={ctl.orientation} />}
        <div className="board-col">
          <PlayerBar name={props.topName} sub={props.topSub} icon={props.topIcon} color={top} ctl={ctl} thinking={ctl.thinking && ctl.game.pos.turn === top && !ctl.freeMode} />
          <div className="board-holder">
            <Board
              board={pos.board} orientation={ctl.orientation} lastMove={ctl.lastMoveView} checkSq={ctl.checkSquare}
              pieceSet={s.pieceSet} showCoords={s.showCoords} showLegal={s.showLegal} animate={s.animate && ctl.animate}
              canMovePiece={sq => ctl.canMovePiece(sq)} legalTargets={sq => ctl.legalTargets(sq)} isCapture={(a, b) => ctl.isCapture(a, b)}
              onMove={(a, b, drag) => { ctl.attemptMove(a, b, 0, drag); }}
              promotion={ctl.promotion} promotionColor={ctl.game.pos.turn} onPromote={pc => ctl.choosePromotion(pc)} onCancelPromotion={() => ctl.cancelPromotion()}
              arrows={props.arrows} marks={props.marks} positionKey={pos.fen() + ctl.viewIndex}
            />
            {props.overlay}
          </div>
          <PlayerBar name={props.bottomName} sub={props.bottomSub} icon={props.bottomIcon} color={bottom} ctl={ctl} thinking={false} />
        </div>
      </div>
      <div className={`statusline${res ? ' over' : ''}`} data-testid="status" aria-live="polite">{status}</div>
      {ctl.notice && <div className={`notice ${ctl.notice.kind}`} key={ctl.notice.id} role="status">{ctl.notice.text}</div>}
    </div>
  );
}

function PlayerBar({ name, sub, icon, color, ctl, thinking }: { name: string; sub?: string; icon?: string; color: 0 | 1; ctl: GameController; thinking: boolean }) {
  return (
    <div className="playerbar" data-testid={`playerbar-${color === 0 ? 'white' : 'black'}`}>
      <div className="avatar" aria-hidden="true">{icon ?? (color === 0 ? '♔' : '♚')}</div>
      <div className="pinfo">
        <div className="pname">{name}{thinking && <span className="dots" aria-label="thinking"><i /><i /><i /></span>}</div>
        {sub && <div className="psub">{sub}</div>}
      </div>
      <Captured ctl={ctl} color={color} />
      <Clock ctl={ctl} color={color} />
    </div>
  );
}

export function opponentLabel(ctl: GameController) {
  const l = getLevel(ctl.level), p = getPersonality(ctl.personality);
  return { name: p.name, sub: `${l.name} level`, icon: p.icon };
}
export { typeOf };
