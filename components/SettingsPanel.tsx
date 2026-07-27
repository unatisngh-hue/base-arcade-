'use client';

import { useRef, useEffect } from 'react';
import { pillSVG } from '@/lib/canvas';

interface SettingsPanelProps {
  show: boolean;
  hand: string;
  soundOn: boolean;
  onClose: () => void;
  onHandChange: (hand: string) => void;
  onSoundToggle: () => void;
}

function buildPanelFrame(svg: SVGSVGElement, w: number, h: number) {
  if (!w || !h) return;
  const u = 5;
  const BAR = 30;
  const r: string[] = [];
  const R = (x: number, y: number, ww: number, hh: number) =>
    r.push(`<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="var(--panel-edge)"/>`);

  R(2 * u, 0, w - 4 * u, u);
  R(2 * u, h - u, w - 4 * u, u);
  R(0, 2 * u, u, h - 4 * u);
  R(w - u, 2 * u, u, h - 4 * u);
  R(u, u, u, u);
  R(w - 2 * u, u, u, u);
  R(u, h - 2 * u, u, u);
  R(w - 2 * u, h - 2 * u, u, u);
  R(0, BAR, w, u);
  R(w - 9 * u, u, u, BAR - u);

  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = r.join('');
}

export function SettingsPanel({
  show,
  hand,
  soundOn,
  onClose,
  onHandChange,
  onSoundToggle,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (show && panelRef.current && frameRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      buildPanelFrame(frameRef.current, Math.round(rect.width), Math.round(rect.height));
    }
  }, [show]);

  if (!show) return null;

  const handOptions = ['left', 'default', 'right'];

  return (
    <div
      className="settingsOverlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className="settingsPanel">
        <button className="closeBtn" onClick={onClose} aria-label="Close" data-nofocus>
          <svg viewBox="0 0 7 5" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
            <rect x="0" y="0" width="7" height="5" fill="var(--close-face)" />
            <rect x="2" y="1" width="1" height="1" fill="var(--close-mark)" />
            <rect x="4" y="1" width="1" height="1" fill="var(--close-mark)" />
            <rect x="3" y="2" width="1" height="1" fill="var(--close-mark)" />
            <rect x="2" y="3" width="1" height="1" fill="var(--close-mark)" />
            <rect x="4" y="3" width="1" height="1" fill="var(--close-mark)" />
          </svg>
        </button>
        <svg
          ref={frameRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-[4]"
          xmlns="http://www.w3.org/2000/svg"
        />
        <div className="panelBar">
          <div className="settingsTitle">NAVIGATION STYLE</div>
        </div>
        <div className="panelBody">
          <div className="settingsRow">
            {handOptions.map((h) => (
              <button
                key={h}
                className={`pill opt ${hand === h ? 'sel' : ''}`}
                onClick={() => onHandChange(h)}
                dangerouslySetInnerHTML={{
                  __html: pillSVG(95, 30) + `<span style="font-size:8px;letter-spacing:0.5px;line-height:30px">${h.toUpperCase()}</span>`,
                }}
              />
            ))}
          </div>
          <div className={`handPreview pv-${hand}`}>
            <svg className="pvDpad" viewBox="0 0 62 62" xmlns="http://www.w3.org/2000/svg">
              <circle cx="31" cy="31" r="29" fill="var(--dpad-bg)" stroke="var(--dpad-edge)" strokeWidth="2" />
              <circle cx="31" cy="31" r="10" fill="var(--pix-frame)" />
              <path d="M31 8l6 8h-12z" fill="var(--dpad-arrow)" />
              <path d="M31 54l6-8h-12z" fill="var(--dpad-arrow)" />
              <path d="M8 31l8-6v12z" fill="var(--dpad-arrow)" />
              <path d="M54 31l-8-6v12z" fill="var(--dpad-arrow)" />
            </svg>
            {hand !== 'default' && <div className="pvRound" />}
          </div>
          <button
            className={`pill wide opt ${soundOn ? 'sel' : ''}`}
            style={{ marginBottom: 9 }}
            onClick={onSoundToggle}
            dangerouslySetInnerHTML={{
              __html: pillSVG(300, 34) + `<span style="line-height:34px">${soundOn ? 'SOUND ON' : 'SOUND OFF'}</span>`,
            }}
          />
          <button
            className="pill wide"
            onClick={onClose}
            dangerouslySetInnerHTML={{
              __html: pillSVG(300, 34) + '<span style="line-height:34px">DONE</span>',
            }}
          />
        </div>
      </div>
    </div>
  );
}
