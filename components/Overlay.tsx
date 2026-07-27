'use client';

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
}

export function Overlay({ show, title, sub, buttons }: OverlayProps) {
  if (!show) return null;

  return (
    <div className="overlay show">
      <div className="ovTitle">{title}</div>
      {sub && <div className="ovSub" dangerouslySetInnerHTML={{ __html: sub }} />}
      <div className="ovBtns">
        {buttons.map((btn, i) => (
          <button
            key={i}
            className={`pill ${btn.ghost ? 'ghost' : ''}`}
            style={{ width: 200, height: 34 }}
            onClick={btn.onClick}
            dangerouslySetInnerHTML={{
              __html: pillSVG(200, 34) + `<span style="line-height:34px">${btn.label}</span>`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
