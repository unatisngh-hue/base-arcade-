'use client';

import { forwardRef } from 'react';
import { pillSVG } from '@/lib/canvas';

interface OverlayButton {
  label: string;
  ghost?: boolean;
  onClick: () => void;
}

interface OverlayProps {
  show: boolean;
  title: string;
  sub?: string;
  buttons: OverlayButton[];
  /** hovering a pill moves the d-pad highlight onto it, as in the original */
  onHoverButton?: (index: number) => void;
}

/* The ref is the button container (#ovBtns in the original) — that is the
   focus host, not the whole overlay. */
export const Overlay = forwardRef<HTMLDivElement, OverlayProps>(function Overlay(
  { show, title, sub, buttons, onHoverButton },
  ref
) {
  if (!show) return null;

  return (
    <div className="overlay show">
      <div className="ovTitle">{title}</div>
      {sub && <div className="ovSub" dangerouslySetInnerHTML={{ __html: sub }} />}
      <div ref={ref} className="ovBtns">
        {buttons.map((btn, i) => (
          <button
            key={i}
            className={`pill ${btn.ghost ? 'ghost' : ''}`}
            style={{ width: 200, height: 34 }}
            onClick={btn.onClick}
            onPointerEnter={() => onHoverButton?.(i)}
            dangerouslySetInnerHTML={{
              __html: pillSVG(200, 34) + `<span style="line-height:34px">${btn.label}</span>`,
            }}
          />
        ))}
      </div>
    </div>
  );
});
