import { Game, GameContext, Lane } from './types';
import { cellBlock, pxRect } from '@/lib/canvas';
import { COLS, ROWS, Direction } from '@/lib/constants';

export function createFrogger(getContext: () => GameContext): Game {
  const startRow = ROWS - 1;
  const homeRow = 0;
  let frog = { c: COLS >> 1, r: startRow };
  let bestRow = startRow;
  let lanes: Lane[] = [];

  function buildLanes(): Lane[] {
    const { S } = getContext();
    const lvl = Math.min(S.level, 5);
    const laneRows = [2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16];
    return laneRows.map((row, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      const speed = (1.6 + (i % 4) * 0.35) * (1 + (lvl - 1) * 0.18);
      const spacing = Math.max(2.5, 4 + (i % 3) - (lvl - 1) * 0.4);
      const count = Math.ceil(COLS / spacing) + 1;
      const cars: number[] = [];
      for (let k = 0; k < count; k++) {
        cars.push(k * spacing + ((i * 1.3) % spacing));
      }
      return { row, dir, speed, spacing, count, cars };
    });
  }

  function respawn() {
    frog = { c: COLS >> 1, r: startRow };
    bestRow = startRow;
  }

  return {
    title: 'FROGGER',

    init() {
      frog = { c: COLS >> 1, r: startRow };
      bestRow = startRow;
      lanes = buildLanes();
    },

    press(d: Direction) {
      const { S, levelUp } = getContext();
      let c = frog.c;
      let r = frog.r;

      if (d === 'left') c--;
      if (d === 'right') c++;
      if (d === 'up') r--;
      if (d === 'down') r++;

      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
      frog.c = c;
      frog.r = r;

      if (r < bestRow) {
        S.score += (bestRow - r) * 10;
        S.coins += 1;
        bestRow = r;
      }

      if (r === homeRow) {
        S.level++;
        frog = { c: COLS >> 1, r: startRow };
        bestRow = startRow;
        lanes = buildLanes();
        return levelUp('REACHED HOME');
      }
    },

    update(dt: number) {
      const { gameOver } = getContext();

      for (const lane of lanes) {
        const span = lane.spacing * lane.count;
        for (let i = 0; i < lane.cars.length; i++) {
          lane.cars[i] += lane.dir * lane.speed * dt;
          if (lane.dir > 0 && lane.cars[i] > COLS + 1) lane.cars[i] -= span;
          if (lane.dir < 0 && lane.cars[i] < -lane.spacing - 1) lane.cars[i] += span;
        }
      }

      for (const lane of lanes) {
        if (lane.row !== frog.r) continue;
        for (const x of lane.cars) {
          if (x < frog.c + 1 && x + 1 > frog.c) {
            return gameOver('HIT BY TRAFFIC');
          }
        }
      }
    },

    draw() {
      const { ctx, CELL, W, COL } = getContext();

      pxRect(ctx, 0, homeRow * CELL, W, CELL, 'rgba(251,191,36,.15)');

      for (const lane of lanes) {
        pxRect(ctx, 0, lane.row * CELL, W, CELL, 'rgba(255,255,255,.03)');
        for (const x of lane.cars) {
          if (x > -1.5 && x < COLS + 1.5) {
            cellBlock(ctx, x, lane.row, CELL, COL.block, COL.hi, COL);
          }
        }
      }

      ctx.save();
      ctx.shadowColor = 'rgba(251,191,36,.7)';
      ctx.shadowBlur = CELL * 0.45;
      cellBlock(ctx, frog.c, frog.r, CELL, COL.yellow, '#FDE08A', COL);
      ctx.restore();
    },

    respawn,
  };
}
