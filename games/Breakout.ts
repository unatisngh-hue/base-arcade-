import { Game, GameContext, Brick } from './types';
import { wallPattern } from './utils';
import { cellBlock, pxRect, dot } from '@/lib/canvas';
import { ROWS } from '@/lib/constants';

export function createBreakout(getContext: () => GameContext): Game {
  let bricks: Brick[] = [];
  let speedMul = 1;
  let padW = 0;
  let padH = 0;
  let padX = 0;
  let bx = 0;
  let by = 0;
  let vx = 0;
  let vy = 0;
  let speed = 0;
  let trail: { x: number; y: number }[] = [];

  function initLevel() {
    const { CELL, W, S } = getContext();
    const lvl = Math.min(S.level, 5);
    bricks = wallPattern(lvl);
    speedMul = 1 + (lvl - 1) * 0.08;
    padW = Math.max(2, 3 - (lvl - 1) * 0.25) * CELL;
    padH = CELL * 0.6;
    padX = W / 2 - padW / 2;
    reset();
  }

  function reset() {
    const { CELL, W, H } = getContext();
    bx = W / 2;
    by = H - CELL * 3;
    const a = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
    speed = CELL * 5.4 * speedMul;
    vx = Math.cos(a) * speed;
    vy = Math.sin(a) * speed;
    trail = [];
  }

  function respawn() {
    const { W } = getContext();
    padX = W / 2 - padW / 2;
    reset();
  }

  return {
    title: 'BREAKOUT',

    init() {
      initLevel();
    },

    press() {
      // Breakout uses held keys, not press events
    },

    update(dt: number) {
      const { ctx, CELL, W, H, COL, held, S, sfx, gameOver, levelUp } = getContext();
      const sp = CELL * 9;

      if (held.left) padX -= sp * dt;
      if (held.right) padX += sp * dt;
      padX = Math.max(0, Math.min(W - padW, padX));

      bx += vx * dt;
      by += vy * dt;
      const r = CELL * 0.22;

      if (bx < r) {
        bx = r;
        vx = Math.abs(vx);
      }
      if (bx > W - r) {
        bx = W - r;
        vx = -Math.abs(vx);
      }
      if (by < r) {
        by = r;
        vy = Math.abs(vy);
      }

      const padY = H - CELL * 1.6;
      if (
        vy > 0 &&
        by + r >= padY &&
        by - r <= padY + padH &&
        bx >= padX - r &&
        bx <= padX + padW + r
      ) {
        by = padY - r;
        const hit = (bx - (padX + padW / 2)) / (padW / 2);
        const a = -Math.PI / 2 + hit * 0.9;
        vx = Math.cos(a) * speed;
        vy = Math.sin(a) * speed;
        speed = Math.min(speed * 1.004, CELL * 8.5 * speedMul);
      }

      for (const b of bricks) {
        if (!b.alive) continue;
        const x = b.c * CELL;
        const y = b.r * CELL;
        if (bx + r > x && bx - r < x + CELL && by + r > y && by - r < y + CELL) {
          b.alive = false;
          S.score += 10;
          S.coins += 1;
          sfx('brick');
          const ox = Math.min(bx + r - x, x + CELL - (bx - r));
          const oy = Math.min(by + r - y, y + CELL - (by - r));
          if (ox < oy) vx = -vx;
          else vy = -vy;
          break;
        }
      }

      trail.unshift({ x: bx, y: by });
      if (trail.length > 14) trail.pop();

      if (bricks.every((b) => !b.alive)) {
        S.level++;
        initLevel();
        return levelUp('WALL CLEARED');
      }
      if (by - r > H) return gameOver('BALL LOST');
    },

    draw() {
      const { ctx, CELL, W, H, COL } = getContext();

      for (const b of bricks) {
        if (b.alive) cellBlock(ctx, b.c, b.r, CELL, undefined, undefined, COL);
      }

      for (let i = 4; i < trail.length; i += 4) {
        dot(ctx, trail[i].x, trail[i].y, CELL * 0.16, 'rgba(251,191,36,.4)');
      }

      ctx.save();
      ctx.shadowColor = 'rgba(251,191,36,.76)';
      ctx.shadowBlur = CELL * 0.5;
      pxRect(ctx, bx - CELL * 0.32, by - CELL * 0.32, CELL * 0.64, CELL * 0.64, COL.yellow);
      ctx.restore();

      pxRect(ctx, padX, H - CELL * 1.6, padW, padH, '#3778E2', COL.hi);
    },

    respawn,
    initLevel,
  };
}
