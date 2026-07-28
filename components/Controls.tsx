'use client';

import { forwardRef } from 'react';
import { pillSVG } from '@/lib/canvas';

interface ControlsProps {
  onPause: () => void;
  onContinue: () => void;
  onSettings: () => void;
  pauseDisabled: boolean;
  continueDisabled: boolean;
}

/* The header row (#buttons in the original) — a focus host, so the d-pad can
   walk PAUSE / CONTINUE / SETTINGS with left+right. */
export const Controls = forwardRef<HTMLDivElement, ControlsProps>(function Controls(
  { onPause, onContinue, onSettings, pauseDisabled, continueDisabled },
  ref
) {
  return (
    <div ref={ref} className="flex items-center w-full px-[19px] pr-[25px] mt-[22px] gap-0">
      <button
        className="pill"
        onClick={onPause}
        disabled={pauseDisabled}
        dangerouslySetInnerHTML={{ __html: pillSVG(132, 29) + '<span>PAUSE</span>' }}
      />
      <button
        className="pill ml-[27px]"
        onClick={onContinue}
        disabled={continueDisabled}
        dangerouslySetInnerHTML={{ __html: pillSVG(132, 29) + '<span>CONTINUE</span>' }}
      />
      <button
        onClick={onSettings}
        className="gearBtn ml-[16px]"
        aria-label="Settings"
      >
        <svg viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
          <rect x="6" y="0" width="4" height="18" fill="var(--gear)" />
          <rect x="0" y="7" width="16" height="4" fill="var(--gear)" />
          <rect x="2" y="3" width="12" height="12" fill="var(--gear)" />
          <rect x="5" y="6" width="6" height="6" fill="var(--gear-edge)" />
          <rect x="6" y="7" width="4" height="4" fill="var(--gear)" />
          <rect x="6" y="17" width="4" height="1" fill="var(--gear-edge)" />
          <rect x="13" y="13" width="2" height="2" fill="var(--gear-edge)" />
        </svg>
      </button>
    </div>
  );
});
