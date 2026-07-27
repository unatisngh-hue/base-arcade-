'use client';

import { useRef, useCallback } from 'react';
import { Direction } from '@/lib/constants';

interface DPadProps {
  onPress: (dir: Direction) => void;
  onRelease: (dir: Direction) => void;
}

const DPAD_SVG = `<svg id="dpadArt" viewBox="205 661 160 160" xmlns="http://www.w3.org/2000/svg">
<path d="M315.193 667.543C355.668 684.304 374.87 730.715 358.108 771.19C341.346 811.665 294.945 830.89 254.469 814.128C213.994 797.366 194.764 750.981 211.532 710.49C228.301 669.998 274.702 650.775 315.193 667.543ZM295.549 714.979C281.268 709.065 264.906 715.844 258.991 730.125C253.077 744.405 259.856 760.767 274.137 766.682C288.418 772.596 304.78 765.817 310.694 751.536C316.608 737.255 309.829 720.893 295.549 714.979Z" fill="#162655" stroke="#A5C5EF"/>
<path d="M315.385 667.081C274.638 650.207 227.945 669.552 211.07 710.299C194.196 751.045 213.548 797.722 254.279 814.59C295.009 831.457 341.702 812.112 358.57 771.382C375.437 730.651 356.115 683.948 315.385 667.081ZM274.329 766.22C260.303 760.412 253.645 744.342 259.454 730.316C265.262 716.29 281.332 709.633 295.357 715.441C309.383 721.25 316.041 737.319 310.232 751.345C304.424 765.371 288.355 772.029 274.329 766.22Z" fill="none" stroke="#A5C5EF" stroke-width="0.73" stroke-miterlimit="10"/>
</svg>`;

const zones = [
  { d: 'up' as Direction, x: 39, y: 0, w: 80, h: 48 },
  { d: 'down' as Direction, x: 39, y: 110, w: 80, h: 48 },
  { d: 'left' as Direction, x: 0, y: 39, w: 48, h: 80 },
  { d: 'right' as Direction, x: 110, y: 39, w: 48, h: 80 },
  { d: 'action' as Direction, x: 50, y: 50, w: 58, h: 58 },
];

export function DPad({ onPress, onRelease }: DPadProps) {
  const pressedRef = useRef<Set<Direction>>(new Set());

  const handlePointerDown = useCallback(
    (dir: Direction) => (e: React.PointerEvent) => {
      e.preventDefault();
      pressedRef.current.add(dir);
      (e.target as HTMLElement).classList.add('pressed');
      onPress(dir);
    },
    [onPress]
  );

  const handlePointerUp = useCallback(
    (dir: Direction) => (e: React.PointerEvent) => {
      e.preventDefault();
      pressedRef.current.delete(dir);
      (e.target as HTMLElement).classList.remove('pressed');
      onRelease(dir);
    },
    [onRelease]
  );

  return (
    <div className="w-[158px] h-[158px] relative flex-none touch-none">
      <div
        className="absolute inset-0 w-full h-full pointer-events-none"
        dangerouslySetInnerHTML={{ __html: DPAD_SVG }}
      />
      {zones.map((z) => (
        <div
          key={z.d}
          className="dpadHit"
          data-dir={z.d}
          style={{
            left: `${(z.x / 158) * 100}%`,
            top: `${(z.y / 158) * 100}%`,
            width: `${(z.w / 158) * 100}%`,
            height: `${(z.h / 158) * 100}%`,
            position: 'absolute',
          }}
          onPointerDown={handlePointerDown(z.d)}
          onPointerUp={handlePointerUp(z.d)}
          onPointerLeave={handlePointerUp(z.d)}
          onPointerCancel={handlePointerUp(z.d)}
        />
      ))}
    </div>
  );
}

interface DPadContainerProps {
  hand: string;
  onPress: (dir: Direction) => void;
  onRelease: (dir: Direction) => void;
  onSelectPress: () => void;
}

export function DPadContainer({ hand, onPress, onRelease, onSelectPress }: DPadContainerProps) {
  const getContainerClass = () => {
    switch (hand) {
      case 'left':
        return 'justify-between';
      case 'right':
        return 'justify-between';
      default:
        return 'justify-center';
    }
  };

  return (
    <div className={`mt-[31px] w-full flex items-center flex-none px-[30px] min-h-[158px] ${getContainerClass()}`}>
      {hand === 'left' && (
        <button
          className="selectBtn"
          aria-label="Select game"
          onPointerDown={(e) => {
            e.preventDefault();
            onSelectPress();
          }}
        />
      )}
      <DPad onPress={onPress} onRelease={onRelease} />
      {hand === 'right' && (
        <button
          className="selectBtn"
          aria-label="Select game"
          onPointerDown={(e) => {
            e.preventDefault();
            onSelectPress();
          }}
        />
      )}
    </div>
  );
}
