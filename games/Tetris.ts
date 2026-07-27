import { Game, GameContext } from './types';
import { cellBlock } from '@/lib/canvas';
import { COLS, ROWS, Direction } from '@/lib/constants';

const SHAPES: Record<string, number[][]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 1], [1, 1], [2, 1], [1, 0]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

interface Piece {
  cells: number[][];
  c: number;
  r: number;
}

export function createTetris(getContext: () => GameContext): Game {
  let grid: (string | null)[][] = [];
  let fall = 0.6;
  let t = 0;
  let levelLines = 0;
  let piece: Piece = { cells: [], c: 0, r: 0 };

  function spawnPiece() {
    const { COL, gameOver } = getContext();
    const keys = Object.keys(SHAPES);
    const k = keys[(Math.random() * keys.length) | 0];
    piece = { cells: SHAPES[k].map((p) => [...p]), c: (COLS / 2 | 0) - 2, r: 0 };
    if (hits(piece.cells, piece.c, piece.r)) {
      gameOver('STACK OVERFLOW');
    }
  }

  function addGarbageRow() {
    const { COL } = getContext();
    grid.shift();
    const gap = (Math.random() * COLS) | 0;
    grid.push(Array.from({ length: COLS }, (_, c) => (c === gap ? null : COL.dim)));
  }

  function hits(cells: number[][], oc: number, or: number): boolean {
    return cells.some(([x, y]) => {
      const cc = oc + x;
      const rr = or + y;
      return cc < 0 || cc >= COLS || rr >= ROWS || (rr >= 0 && grid[rr][cc]);
    });
  }

  function rotate() {
    const { sfx } = getContext();
    sfx('rotate');
    const rot = piece.cells.map(([x, y]) => [-y, x]);
    const minX = Math.min(...rot.map((q) => q[0]));
    const minY = Math.min(...rot.map((q) => q[1]));
    const norm = rot.map(([x, y]) => [x - minX, y - minY]);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!hits(norm, piece.c + kick, piece.r)) {
        piece.cells = norm;
        piece.c += kick;
        return;
      }
    }
  }

  function dropOne() {
    const { S } = getContext();
    if (!hits(piece.cells, piece.c, piece.r + 1)) {
      piece.r++;
      S.score += 1;
    } else {
      lock();
    }
  }

  function lock() {
    const { COL, S, sfx, levelUp } = getContext();
    piece.cells.forEach(([x, y]) => {
      const rr = piece.r + y;
      const cc = piece.c + x;
      if (rr >= 0) grid[rr][cc] = COL.block;
    });

    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every((v) => v)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }

    let leveledUp = false;
    if (cleared) {
      S.score += [0, 100, 300, 600, 1000][cleared];
      S.coins += cleared;
      sfx('line');
      fall = Math.max(0.16, fall * 0.97);
      levelLines += cleared;
      if (levelLines >= 5) {
        levelLines -= 5;
        S.level++;
        fall = Math.max(0.12, fall * 0.85);
        addGarbageRow();
        leveledUp = true;
      }
    }
    spawnPiece();
    if (leveledUp) levelUp('LEVEL UP — GARBAGE ROW ADDED');
  }

  return {
    title: 'TETRIS',

    init() {
      grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      fall = 0.6;
      t = 0;
      levelLines = 0;
      spawnPiece();
    },

    press(d: Direction) {
      if (d === 'left' && !hits(piece.cells, piece.c - 1, piece.r)) piece.c--;
      if (d === 'right' && !hits(piece.cells, piece.c + 1, piece.r)) piece.c++;
      if (d === 'up' || d === 'action') rotate();
      if (d === 'down') dropOne();
    },

    update(dt: number) {
      const { held } = getContext();
      t += dt;
      const speed = held.down ? fall / 8 : fall;
      if (t >= speed) {
        t = 0;
        dropOne();
      }
    },

    draw() {
      const { ctx, CELL, COL } = getContext();

      for (let r = 0; r < ROWS; r++) {
        for (let k = 0; k < COLS; k++) {
          if (grid[r][k]) cellBlock(ctx, k, r, CELL, grid[r][k]!, undefined, COL);
        }
      }

      piece.cells.forEach(([x, y]) => {
        if (piece.r + y >= 0) {
          cellBlock(ctx, piece.c + x, piece.r + y, CELL, COL.hi, COL.white, COL);
        }
      });
    },
  };
}
