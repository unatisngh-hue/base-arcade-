'use client';

import { useEffect, useRef } from 'react';

interface SplashProps {
  show: boolean;
  onFinish: () => void;
}

const CLOUD_SHAPES = [
  ['..XXX....', '.XXXXX.X.', 'XXXXXXXXX', '.XXXXXXX.'],
  ['...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', '.XXXXXX.'],
  ['..XX..XXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', '..XXXXXXX..'],
  ['.XX..', 'XXXXX', '.XXX.'],
  ['....XXX..', '..XXXXXXX', '.XXXXXXXX', 'XXXXXXXX.', '..XXXX...'],
];

interface CloudConfig {
  shape: string[];
  y: number;
  scale: number;
  dur: number;
  delay: number;
  opacity: number;
}

const CLOUD_CONFIGS: CloudConfig[] = [
  { shape: CLOUD_SHAPES[0], y: 70, scale: 1.4, dur: 16, delay: -6, opacity: 0.95 },
  { shape: CLOUD_SHAPES[3], y: 165, scale: 0.9, dur: 11, delay: -13, opacity: 0.65 },
  { shape: CLOUD_SHAPES[2], y: 250, scale: 1.1, dur: 23, delay: -3, opacity: 0.85 },
  { shape: CLOUD_SHAPES[1], y: 360, scale: 1.7, dur: 27, delay: -18, opacity: 0.9 },
  { shape: CLOUD_SHAPES[4], y: 505, scale: 1.0, dur: 14, delay: -9, opacity: 0.75 },
  { shape: CLOUD_SHAPES[3], y: 600, scale: 1.3, dur: 20, delay: -21, opacity: 0.8 },
  { shape: CLOUD_SHAPES[2], y: 700, scale: 0.8, dur: 17, delay: -12, opacity: 0.6 },
];

function Cloud({ config }: { config: CloudConfig }) {
  const p = Math.round(8 * config.scale);
  const shadows: string[] = [];

  config.shape.forEach((row, ry) => {
    row.split('').forEach((ch, rx) => {
      if (ch === 'X') shadows.push(`${rx * p}px ${ry * p}px 0 #D7E8FF`);
    });
  });

  return (
    <div
      className="cloud"
      style={{
        width: p,
        height: p,
        boxShadow: shadows.join(','),
        top: config.y,
        left: -90,
        opacity: config.opacity,
        animationDuration: `${config.dur}s`,
        animationDelay: `${config.delay}s`,
      }}
    />
  );
}

export function Splash({ show, onFinish }: SplashProps) {
  const hasFinished = useRef(false);

  useEffect(() => {
    if (!show || hasFinished.current) return;

    const timer = setTimeout(() => {
      if (!hasFinished.current) {
        hasFinished.current = true;
        onFinish();
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, [show, onFinish]);

  const handleClick = () => {
    if (!hasFinished.current) {
      hasFinished.current = true;
      onFinish();
    }
  };

  if (!show) return null;

  return (
    <div
      className="splash"
      onClick={handleClick}
      onPointerDown={handleClick}
    >
      {CLOUD_CONFIGS.map((config, i) => (
        <Cloud key={i} config={config} />
      ))}
      <div className="splashText">
        <div className="splashLine">PRESENTING</div>
        <div className="splashLine big">BASE ARCADE</div>
      </div>
    </div>
  );
}
