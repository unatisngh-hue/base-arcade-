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
  // `sel` lives on the returned object itself (mirroring `this.sel` in the
  // original's Menu singleton) so callers reading `menu.sel` — including the
  // gameLabel text in ArcadeGame — see the real, current selection instead
  // of a value frozen at construction time.
  function show(i: number) {
    const n = catalog.length;
    menu.sel = (i + n) % n;
    catalog[menu.sel].game.init();
  }

  const menu: MenuGame = {
    title: 'BASE ARCADE',
    sel: 0,

    init() {
      show(menu.sel || 0);
    },

    update() {
      // Menu has no physics update
    },

    show,

    press(d: Direction) {
      if (d === 'left') show(menu.sel - 1);
      if (d === 'right') show(menu.sel + 1);
      if (d === 'action') onStart(catalog[menu.sel].key);
    },

    hit(px: number, py: number) {
      const { W, H } = getContext();
      const zone = W * 0.22;
      const y0 = H * 0.28;
      const y1 = H * 0.62;

      if (py > y0 && py < y1 && px < zone) {
        show(menu.sel - 1);
        return;
      }
      if (py > y0 && py < y1 && px > W - zone) {
        show(menu.sel + 1);
        return;
      }
      onStart(catalog[menu.sel].key);
    },

    draw() {
      const { ctx, W, H } = getContext();
      const g = catalog[menu.sel].game;
      if (g && g.draw) g.draw();

      const sc = W / 371;
      const ay = H * 0.4428;
      const len = 31.2 * sc;
      const spread = 56.2 * sc;
      const lcx = 33.1 * sc;
      const rcx = W - 32.65 * sc;
      const isLast = menu.sel === catalog.length - 1;

      stepArrow(ctx, lcx, ay, len, spread, -1, isLast ? '#EEEFF1' : '#2760C4');
      stepArrow(ctx, rcx, ay, len, spread, 1, isLast ? '#2760C4' : '#EEEFF1');
    },
  };

  return menu;
}
