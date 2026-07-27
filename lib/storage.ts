import { SEED_BOARD, BOARD_SIZE } from './constants';

export interface LeaderboardEntry {
  name: string;
  score: number;
  you?: boolean;
}

let bestScore = 0;

export function initStorage() {
  if (typeof window === 'undefined') return;
  try {
    bestScore = parseInt(localStorage.getItem('baseArcadeBest') || '0', 10) || 0;
  } catch (e) {
    // localStorage not available
  }
}

export function getBestScore(): number {
  return bestScore;
}

export function submitScore(key: string, score: number): number {
  if (!score) return 0;
  const improved = score > bestScore;
  if (improved) {
    bestScore = score;
    try {
      localStorage.setItem('baseArcadeBest', String(score));
    } catch (e) {
      // localStorage not available
    }
  }
  const rank = fetchBoard().findIndex((r) => r.you) + 1;
  return improved && rank ? rank : 0;
}

export function fetchBoard(): LeaderboardEntry[] {
  const rows: LeaderboardEntry[] = SEED_BOARD.map((r) => ({ ...r, you: false }));
  if (bestScore > 0) {
    rows.push({ name: 'YOU', score: bestScore, you: true });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, BOARD_SIZE);
}

export function getSavedHand(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    return localStorage.getItem('baseArcadeHand') || 'default';
  } catch (e) {
    return 'default';
  }
}

export function saveHand(mode: string) {
  try {
    localStorage.setItem('baseArcadeHand', mode);
  } catch (e) {
    // localStorage not available
  }
}

export function getSavedSound(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('baseArcadeSound') === 'on';
  } catch (e) {
    return false;
  }
}

export function saveSound(on: boolean) {
  try {
    localStorage.setItem('baseArcadeSound', on ? 'on' : 'off');
  } catch (e) {
    // localStorage not available
  }
}
