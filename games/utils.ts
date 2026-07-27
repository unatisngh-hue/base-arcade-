import { COLS, GLYPH } from '@/lib/constants';
import { Brick } from './types';

const WALL_TOP = 1;

export function baseBricks(top: number): Brick[] {
  const out: Brick[] = [];
  let col = 1;
  for (const ch of 'BASE') {
    const g = GLYPH[ch];
    for (let r = 0; r < g.length; r++) {
      for (let k = 0; k < g[r].length; k++) {
        if (g[r][k] === '1') {
          out.push({ c: col + k, r: top + r, alive: true });
        }
      }
    }
    col += 4;
  }
  return out;
}

export function wallPattern(level: number): Brick[] {
  const lvl = Math.max(1, Math.min(level, 5));
  const T = WALL_TOP;
  if (lvl === 1) return baseBricks(T);

  const out: Brick[] = [];
  if (lvl === 2) {
    const widths = [4, 6, 8, 10, 12];
    widths.forEach((w, i) => {
      const r = T + i;
      const startC = Math.floor((COLS - w) / 2);
      for (let k = 0; k < w; k++) {
        out.push({ c: startC + k, r, alive: true });
      }
    });
  } else if (lvl === 3) {
    for (let r = T; r <= T + 3; r++) {
      for (let c = 0; c < COLS; c++) {
        out.push({ c, r, alive: true });
      }
    }
  } else if (lvl === 4) {
    for (let r = T; r <= T + 5; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((c + r) % 2 === 0) {
          out.push({ c, r, alive: true });
        }
      }
    }
  } else {
    for (let r = T; r <= T + 1; r++) {
      for (let c = 0; c < COLS; c++) {
        out.push({ c, r, alive: true });
      }
    }
    for (let r = T + 3; r <= T + 4; r++) {
      for (let c = 0; c < COLS; c++) {
        out.push({ c, r, alive: true });
      }
    }
  }
  return out;
}
