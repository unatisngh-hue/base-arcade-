import { Game, GameContext } from './types';
import { stepArrow } from '@/lib/canvas';
import { Direction } from '@/lib/constants';

export interface MenuGame extends Game {
  sel: number;
  show: (i: number) => void;
}

export function createMenu(
  getContext: () => GameContext,
  catalog: { key: string; game: Game; short: string }[],
  onStart: (key: string) => void
): MenuGame {
  let sel = 0;

  function show(i: number) {
    const n = catalog.length;
    sel = (i + n) % n;
    catalog[sel].game.init();
  }

  return {
    title: 'BASE ARCADE',
    sel: 0,

    init() {
      show(sel || 0);
    },

    update() {
      // Menu has no physics update
    },

    show,

    press(d: Direction) {
      if (d === 'left') show(sel - 1);
      if (d === 'right') show(sel + 1);
      if (d === 'action') onStart(catalog[sel].key);
    },

    hit(px: number, py: number) {
      const { W, H } = getContext();
      const zone = W * 0.22;
      const y0 = H * 0.28;
      const y1 = H * 0.62;

      if (py > y0 && py < y1 && px < zone) {
        show(sel - 1);
        return;
      }
      if (py > y0 && py < y1 && px > W - zone) {
        show(sel + 1);
        return;
      }
      onStart(catalog[sel].key);
    },

    draw() {
      const { ctx, W, H } = getContext();
      const g = catalog[sel].game;
      if (g && g.draw) g.draw();

      const sc = W / 371;
      const ay = H * 0.4428;
      const len = 31.2 * sc;
      const spread = 56.2 * sc;
      const lcx = 33.1 * sc;
      const rcx = W - 32.65 * sc;
      const isLast = sel === catalog.length - 1;

      stepArrow(ctx, lcx, ay, len, spread, -1, isLast ? '#EEEFF1' : '#2760C4');
      stepArrow(ctx, rcx, ay, len, spread, 1, isLast ? '#2760C4' : '#EEEFF1');
    },
  };
}
