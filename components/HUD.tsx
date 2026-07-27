'use client';

import { ICON, MAX_LIVES } from '@/lib/constants';

interface HUDProps {
  coins: number;
  score: number;
  time: number;
  lives: number;
  livesApply: boolean;
}

function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function HUD({ coins, score, time, lives, livesApply }: HUDProps) {
  return (
    <div className="flex justify-between items-center w-full px-[19px] pr-[25px] mt-[30px] box-border font-pixel text-[11px] text-stat tracking-[0.5px]">
      <span className="statCell">
        <i
          className="ico w-[19px] h-[17px]"
          style={{ backgroundImage: `url(${ICON.coin})` }}
        />
        <b>{coins}</b>
      </span>
      <span className="statCell">
        <i
          className="ico w-[19px] h-[17px]"
          style={{ backgroundImage: `url(${ICON.star})` }}
        />
        <b>{String(score).padStart(3, '0')}</b>
      </span>
      <span className="statCell">
        <i
          className="ico w-[16px] h-[17px]"
          style={{ backgroundImage: `url(${ICON.hourglass})` }}
        />
        <b>{fmtTime(time)}</b>
      </span>
      <span className={`statCell gap-[3px] ${!livesApply ? 'lives na' : ''}`}>
        {Array.from({ length: MAX_LIVES }).map((_, i) => (
          <img
            key={i}
            className="heart"
            alt=""
            src={i < (livesApply ? lives : 0) ? ICON.heart : ICON.heartEmpty}
          />
        ))}
      </span>
    </div>
  );
}
