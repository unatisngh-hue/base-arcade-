import { Game, GameContext, Brick, Shot } from './types';
import { wallPattern } from './utils';
import { cellBlock, pxRect } from '@/lib/canvas';
import { COLS, ROWS, Direction } from '@/lib/constants';

export function createBrickShooter(getContext: () => GameContext): Game {
  let bricks: Brick[] = [];
  let creepInterval = 7;
  let col = COLS >> 1;
  let moveT = 0;
  let shots: Shot[] = [];
  let cool = 0;
  let drop = 0;
  let offset = 0;

  function initLevel() {
    const { S } = getContext();
    const lvl = Math.min(S.level, 5);
    bricks = wallPattern(lvl);
    creepInterval = Math.max(3, 7 - (lvl - 1));
    col = COLS >> 1;
    moveT = 0;
    shots = [];
    cool = 0;
    drop = 0;
    offset = 0;
  }

  function respawn() {
    const alive = bricks.filter((b) => b.alive);
    const lowest = alive.length ? Math.max(...alive.map((b) => b.r)) : 0;
    offset = Math.max(0, ROWS - 9 - lowest);
    col = COLS >> 1;
    moveT = 0;
    shots = [];
    cool = 0;
    drop = 0;
  }

  function stepCol(d: number) {
    col = Math.max(0, Math.min(COLS - 1, col + d));
    moveT = 0.14;
  }

  function fire() {
    const { CELL, sfx } = getContext();
    if (cool > 0) return;
    cool = 0.3;
    sfx('shoot');
    shots.push({ col, x: (col + 0.5) * CELL, y: (ROWS - 2.4) * CELL });
  }

  return {
    title: 'BRICK SHOOTER',

    init() {
      initLevel();
    },

    press(d: Direction) {
      if (d === 'left') stepCol(-1);
      if (d === 'right') stepCol(1);
      if (d === 'up' || d === 'action') fire();
    },

    update(dt: number) {
      const { CELL, held, S, gameOver, levelUp } = getContext();

      moveT -= dt;
      cool -= dt;

      if (moveT <= 0) {
        if (held.left) stepCol(-1);
        else if (held.right) stepCol(1);
      }
      if (held.up) fire();

      drop += dt;
      if (drop > creepInterval) {
        drop = 0;
        offset += 1;
      }

      for (const s of shots) {
        s.y -= CELL * 15 * dt;
      }
      shots = shots.filter((s) => s.y > -CELL);

      for (const s of shots) {
        const sr = Math.floor(s.y / CELL) - offset;
        for (const b of bricks) {
          if (b.alive && b.c === s.col && b.r === sr) {
            b.alive = false;
            S.score += 15;
            S.coins += 1;
            s.dead = true;
            break;
          }
        }
      }
      shots = shots.filter((s) => !s.dead);

      if (bricks.every((b) => !b.alive)) {
        S.level++;
        initLevel();
        return levelUp('WALL CLEARED');
      }

      const low = Math.max(...bricks.filter((b) => b.alive).map((b) => b.r + offset));
      if (low >= ROWS - 4) return gameOver('WALL BREACHED');
    },

    draw() {
      const { ctx, CELL, COL } = getContext();

      for (const b of bricks) {
        if (b.alive) cellBlock(ctx, b.c, b.r + offset, CELL, undefined, undefined, COL);
      }

      for (const s of shots) {
        pxRect(ctx, s.x - CELL * 0.3, s.y - CELL * 0.3, CELL * 0.6, CELL * 0.6, COL.orange, '#ffd77a');
      }

      for (const d of [-1, 0, 1]) {
        const cc = col + d;
        if (cc >= 0 && cc < COLS) cellBlock(ctx, cc, ROWS - 1, CELL, COL.block, COL.hi, COL);
      }
      cellBlock(ctx, col, ROWS - 2, CELL, COL.orange, '#ffd77a', COL);
    },

    respawn,
    initLevel,
  };
}
