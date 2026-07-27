import { Game, GameContext, Ghost } from './types';
import { cellBlock, dot } from '@/lib/canvas';
import { COLS, ROWS, Direction } from '@/lib/constants';

const PAC_MAPS = [
  [
    '................', '##..............', '.#..............', '................',
    '...##...........', '................', '.......##.......', '........#.......',
    '................', '................', '..###...........', '................',
    '................', '................', '.####...........', '................',
    '..............#.', '..............#.', '............###.', '................'
  ],
  [
    '................', '..............##', '..............#.', '................',
    '...........##...', '................', '.......##.......', '.......#........',
    '................', '................', '...........###..', '................',
    '................', '................', '...........####.', '................',
    '.#..............', '.#..............', '.###............', '................'
  ],
  [
    '................', '............###.', '..............#.', '..............#.',
    '................', '.####...........', '................', '................',
    '................', '..###...........', '................', '................',
    '........#.......', '.......##.......', '................', '...##...........',
    '................', '.#..............', '##..............', '................'
  ],
  [
    '................', '.###............', '.#..............', '.#..............',
    '................', '...........####.', '................', '................',
    '................', '...........###..', '................', '................',
    '.......#........', '.......##.......', '................', '...........##...',
    '................', '..............#.', '..............##', '................'
  ],
  [
    '................', '.####......####.', '.#............#.', '.#.##....##...#.',
    '.#.#......#...#.', '.#............#.', '.##############.', '................',
    '......##.#......', '......#..#......', '......#..#......', '......####......',
    '................', '.##############.', '.#............#.', '.#.#......#...#.',
    '.#.##....##...#.', '.#............#.', '.####......####.', '................'
  ]
];

export function createPacMan(getContext: () => GameContext): Game {
  let wall: boolean[][] = [];
  let dots: boolean[][] = [];
  let p = { c: 8, r: 9, dir: 'left', next: null as string | null, t: 0 };
  let ghosts: Ghost[] = [];
  let step = 0.27;
  let left = 0;

  function initLevel() {
    const { S } = getContext();
    const lvl = Math.min(S.level, 5);
    const map = PAC_MAPS[lvl - 1];
    wall = map.map((r) => r.split('').map((ch) => ch === '#'));
    dots = map.map((r) => r.split('').map((ch) => ch === '.'));
    p = { c: 8, r: 9, dir: 'left', next: null, t: 0 };
    dots[9][8] = false;

    const ghostCount = Math.min(2 + (lvl - 1), 6);
    const ghostColors = ['#e8657a', '#7ae0d8', '#c98af0', '#f0a868'];
    const ghostStarts = [{ c: 2, r: 2 }, { c: 13, r: 17 }, { c: 13, r: 2 }, { c: 2, r: 17 }];
    ghosts = [];
    for (let i = 0; i < ghostCount; i++) {
      const st = ghostStarts[i % ghostStarts.length];
      ghosts.push({ c: st.c, r: st.r, dir: 'right', t: 0, col: ghostColors[i % ghostColors.length] });
    }
    step = Math.max(0.16, 0.27 - (lvl - 1) * 0.02);
    left = dots.flat().filter(Boolean).length;
  }

  function respawn() {
    p = { c: 8, r: 9, dir: 'left', next: null, t: 0 };
    const starts = [{ c: 2, r: 2 }, { c: 13, r: 17 }, { c: 13, r: 2 }, { c: 2, r: 17 }];
    ghosts.forEach((g, i) => {
      const st = starts[i % starts.length];
      g.c = st.c;
      g.r = st.r;
      g.t = 0;
    });
  }

  function free(c: number, r: number) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && !wall[r][c];
  }

  function move(e: { c: number; r: number }, d: string) {
    const dc = d === 'left' ? -1 : d === 'right' ? 1 : 0;
    const dr = d === 'up' ? -1 : d === 'down' ? 1 : 0;
    return { c: e.c + dc, r: e.r + dr };
  }

  return {
    title: 'PAC MAN',

    init() {
      initLevel();
    },

    press(d: Direction) {
      if (['up', 'down', 'left', 'right'].includes(d)) {
        p.next = d;
      }
    },

    update(dt: number) {
      const { CELL, S, sfx, gameOver, levelUp } = getContext();

      p.t += dt;
      if (p.t >= step) {
        p.t -= step;
        if (p.next) {
          const t = move(p, p.next);
          if (free(t.c, t.r)) {
            p.dir = p.next;
            p.next = null;
          }
        }
        const t = move(p, p.dir);
        if (free(t.c, t.r)) {
          p.c = t.c;
          p.r = t.r;
        }
        if (dots[p.r][p.c]) {
          dots[p.r][p.c] = false;
          S.coins += 1;
          S.score += 10;
          left--;
          sfx('eat');
        }
        if (left <= 0) {
          S.level++;
          initLevel();
          return levelUp('ALL DOTS EATEN');
        }
      }

      for (const g of ghosts) {
        g.t += dt;
        if (g.t >= step * 1.5) {
          g.t = 0;
          const opts = ['up', 'down', 'left', 'right'].filter((d) => {
            const t = move(g, d);
            return free(t.c, t.r);
          });
          if (opts.length) {
            opts.sort((a, b) => {
              const A = move(g, a);
              const B = move(g, b);
              return Math.abs(A.c - p.c) + Math.abs(A.r - p.r) - (Math.abs(B.c - p.c) + Math.abs(B.r - p.r));
            });
            g.dir = Math.random() < 0.7 ? opts[0] : opts[Math.floor(Math.random() * opts.length)];
            const t = move(g, g.dir);
            g.c = t.c;
            g.r = t.r;
          }
        }
        if (g.c === p.c && g.r === p.r) return gameOver('CAUGHT BY GHOST');
      }
    },

    draw() {
      const { ctx, CELL, COL, S } = getContext();

      for (let r = 0; r < ROWS; r++) {
        for (let k = 0; k < COLS; k++) {
          if (wall[r][k]) cellBlock(ctx, k, r, CELL, undefined, undefined, COL);
          else if (dots[r][k]) dot(ctx, (k + 0.5) * CELL, (r + 0.5) * CELL, CELL * 0.13, '#8fc0f5');
        }
      }

      const px = (p.c + 0.5) * CELL;
      const py = (p.r + 0.5) * CELL;
      const base: Record<string, number> = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 };
      const mouth = 0.30 * Math.abs(Math.sin(S.time * 7));
      ctx.fillStyle = COL.yellow;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, CELL * 0.42, base[p.dir] + mouth, base[p.dir] - mouth + Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      for (const g of ghosts) {
        const gx = g.c * CELL;
        const gy = g.r * CELL;
        ctx.fillStyle = g.col;
        ctx.beginPath();
        ctx.arc(gx + CELL / 2, gy + CELL * 0.45, CELL * 0.36, Math.PI, 0);
        ctx.lineTo(gx + CELL * 0.86, gy + CELL * 0.86);
        ctx.lineTo(gx + CELL * 0.14, gy + CELL * 0.86);
        ctx.closePath();
        ctx.fill();
      }
    },

    respawn,
    initLevel,
  };
}
