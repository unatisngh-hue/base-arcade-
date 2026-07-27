import { MAX_LIVES } from './constants';

export interface GameState {
  screen: 'splash' | 'menu' | 'play' | 'board';
  key: string | null;
  paused: boolean;
  over: boolean;
  coins: number;
  score: number;
  time: number;
  level: number;
  lives: number;
  livesApply: boolean;
  hand: string;
}

export function createInitialState(): GameState {
  return {
    screen: 'splash',
    key: null,
    paused: false,
    over: false,
    coins: 0,
    score: 0,
    time: 0,
    level: 1,
    lives: MAX_LIVES,
    livesApply: false,
    hand: 'default',
  };
}

export interface HeldKeys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export function createHeldKeys(): HeldKeys {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
  };
}
