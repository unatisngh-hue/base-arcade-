import { Game, GameContext } from './types';
import { cellBlock } from '@/lib/canvas';
import { COLS, ROWS, Direction } from '@/lib/constants';

interface SnakeSegment {
  c: number;
  r: number;
}

interface Obstacle {
  c: number;
  r: number;
}

export function createSnake(getContext: () => GameContext): Game {
  const levelThresholds = [80, 200, 360, 560];
  let body: SnakeSegment[] = [];
  let dir = 'right';
  let next = 'right';
  let t = 0;
  let step = 0.2;
  let obstacles: Obstacle[] = [];
  let food: SnakeSegment = { c: 0, r: 0 };
  let grow = 0;

  function spawn(): SnakeSegment {
    let f: SnakeSegment;
    do {
      f = { c: (Math.random() * COLS) | 0, r: (Math.random() * ROWS) | 0 };
    } while (
      body.some((b) => b.c === f.c && b.r === f.r) ||
      obstacles.some((o) => o.c === f.c && o.r === f.r)
    );
    return f;
  }

  function spawnObstacles(count: number) {
    const obs: Obstacle[] = [];
    while (obs.length < count) {
      const o = { c: (Math.random() * COLS) | 0, r: (Math.random() * ROWS) | 0 };
      const clash =
        body.some((b) => b.c === o.c && b.r === o.r) ||
        (food.c === o.c && food.r === o.r) ||
        obs.some((x) => x.c === o.c && x.r === o.r);
      if (!clash) obs.push(o);
    }
    obstacles = obs;
  }

  function respawn() {
    body = [{ c: 8, r: 8 }, { c: 7, r: 8 }, { c: 6, r: 8 }, { c: 5, r: 8 }];
    dir = 'right';
    next = 'right';
    t = 0;
    grow = 0;
    obstacles = obstacles.filter((o) => !body.some((b) => b.c === o.c && b.r === o.r));
    if (body.some((b) => b.c === food.c && b.r === food.r)) {
      food = spawn();
    }
  }

  return {
    title: 'SNAKE & BALL',

    init() {
      body = [{ c: 8, r: 8 }, { c: 7, r: 8 }, { c: 6, r: 8 }, { c: 5, r: 8 }];
      dir = 'right';
      next = 'right';
      t = 0;
      step = 0.2;
      obstacles = [];
      food = spawn();
    },

    press(d: Direction) {
      const opp: Record<string, string> = { left: 'right', right: 'left', up: 'down', down: 'up' };
      if (['up', 'down', 'left', 'right'].includes(d) && opp[d] !== dir) {
        next = d;
      }
    },

    update(dt: number) {
      const { S, sfx, gameOver, levelUp } = getContext();

      t += dt;
      if (t < step) return;
      t = 0;
      dir = next;

      const h = body[0];
      const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
      const nh = { c: h.c + dc, r: h.r + dr };

      if (nh.c < 0 || nh.c >= COLS || nh.r < 0 || nh.r >= ROWS) {
        return gameOver('HIT THE WALL');
      }
      if (body.some((b) => b.c === nh.c && b.r === nh.r)) {
        return gameOver('BIT YOURSELF');
      }
      if (obstacles.some((o) => o.c === nh.c && o.r === nh.r)) {
        return gameOver('HIT AN OBSTACLE');
      }

      body.unshift(nh);

      if (nh.c === food.c && nh.r === food.r) {
        S.coins += 1;
        S.score += 20;
        food = spawn();
        sfx('eat');
        step = Math.max(0.09, step * 0.98);

        const idx = S.level - 1;
        if (idx < levelThresholds.length && S.score >= levelThresholds[idx]) {
          S.level++;
          spawnObstacles((S.level - 1) * 4);
          return levelUp('LEVEL UP');
        }
      } else {
        body.pop();
      }
    },

    draw() {
      const { ctx, CELL, COL } = getContext();

      for (const o of obstacles) {
        cellBlock(ctx, o.c, o.r, CELL, COL.dim, COL.grid, COL);
      }
      cellBlock(ctx, food.c, food.r, CELL, COL.orange, '#ffd77a', COL);

      body.forEach((b, i) => {
        cellBlock(ctx, b.c, b.r, CELL, i === 0 ? COL.hi : COL.block, i === 0 ? COL.white : COL.hi, COL);
      });
    },

    respawn,
  };
}
