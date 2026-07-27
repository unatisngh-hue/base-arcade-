import { Direction } from '@/lib/constants';

export interface Game {
  title: string;
  init: () => void;
  update: (dt: number) => void | string;
  draw: () => void;
  press?: (dir: Direction) => void;
  respawn?: () => void;
  initLevel?: () => void;
  hit?: (px: number, py: number) => void;
}

export interface GameContext {
  ctx: CanvasRenderingContext2D;
  CELL: number;
  W: number;
  H: number;
  COL: Record<string, string>;
  held: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };
  S: {
    screen: string;
    key: string | null;
    paused: boolean;
    over: boolean;
    coins: number;
    score: number;
    time: number;
    level: number;
    lives: number;
    livesApply: boolean;
  };
  sfx: (name: string) => void;
  gameOver: (reason: string) => void;
  levelUp: (reason: string) => void;
}

export interface Brick {
  c: number;
  r: number;
  alive: boolean;
}

export interface Shot {
  col: number;
  x: number;
  y: number;
  dead?: boolean;
}

export interface Ghost {
  c: number;
  r: number;
  dir: string;
  t: number;
  col: string;
}

export interface Lane {
  row: number;
  dir: number;
  speed: number;
  spacing: number;
  count: number;
  cars: number[];
}
