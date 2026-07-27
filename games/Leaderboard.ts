import { Game, GameContext } from './types';
import { clearBoard, drawGrid, label } from '@/lib/canvas';
import { ICON } from '@/lib/constants';
import { fetchBoard, LeaderboardEntry } from '@/lib/storage';
import { Direction } from '@/lib/constants';

export function createLeaderboard(
  getContext: () => GameContext,
  onBack: () => void
): Game {
  let rows: LeaderboardEntry[] = [];
  let bannerImg: HTMLImageElement | null = null;
  let starImg: HTMLImageElement | null = null;

  return {
    title: 'SCORES',

    init() {
      rows = fetchBoard();
      if (typeof window !== 'undefined') {
        bannerImg = new Image();
        bannerImg.src = ICON.banner;
        starImg = new Image();
        starImg.src = ICON.star;
      }
    },

    update() {
      // Leaderboard has no physics update
    },

    press(d: Direction) {
      if (d === 'action') onBack();
    },

    hit() {
      onBack();
    },

    draw() {
      const { ctx, W, H, CELL, COL } = getContext();

      clearBoard(ctx, W, H, COL.board);
      drawGrid(ctx, W, H, CELL, COL.grid);

      const sc = W / 371;

      // Banner
      const bw = 285 * sc;
      const bh = (bw * 124) / 406;
      const bx = (W - bw) / 2;
      const by = 16 * sc;
      if (bannerImg?.complete) {
        ctx.drawImage(bannerImg, bx, by, bw, bh);
      }

      // Stars
      const ss = 27 * sc;
      const gap = 13 * sc;
      const sy = by + bh - 15 * sc;
      const totalS = ss * 3 + gap * 2;
      if (starImg?.complete) {
        for (let i = 0; i < 3; i++) {
          ctx.drawImage(starImg, (W - totalS) / 2 + i * (ss + gap), sy, ss, (ss * 20) / 22);
        }
      }

      // Rows
      const top = sy + 46 * sc;
      const rowH = 40 * sc;
      ctx.textBaseline = 'middle';

      rows.forEach((r, i) => {
        const y = top + i * rowH;
        const col = r.you ? COL.yellow : COL.hi;
        label(ctx, `${i + 1}.`, 46 * sc, y, 15 * sc, col, 'left');
        label(ctx, r.name, 84 * sc, y, 15 * sc, col, 'left');
        label(ctx, String(r.score), W - 46 * sc, y, 15 * sc, col, 'right');
      });

      if (!rows.length) {
        label(ctx, 'NO SCORES YET', W / 2, top + rowH, 13 * sc, COL.dim, 'center');
      }
    },
  };
}
