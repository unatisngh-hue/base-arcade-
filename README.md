# BASE ARCADE

Six retro arcade games — Breakout, Snake & Ball, Brick Shooter, Pac-Man,
Tetris and Frogger — behind one shared menu, HUD, pause/settings flow and
local leaderboard. Built with Next.js (App Router), React and TypeScript;
every game renders to a single `<canvas>` grid shared across the whole app.

## Project structure

```
app/
  layout.tsx        root layout, loads globals.css
  page.tsx           renders <ArcadeGame />
  globals.css        all styling — design tokens live in :root at the top

components/
  ArcadeGame.tsx      orchestrator: owns game state, the render loop, screen
                      transitions (splash → menu → play → board) and wires
                      every other component together
  GameBoard.tsx       the canvas + pixel-frame + the in-canvas overlay slot
  Overlay.tsx         pause / life-lost / level-up / game-over card
  SettingsPanel.tsx   hand-preference + sound panel
  Controls.tsx        header row: PAUSE / CONTINUE / gear
  DPad.tsx            the D-pad + round select button
  HUD.tsx             coins / score / time / lives row
  Header.tsx          title text
  Splash.tsx          boot splash (animated clouds + wordmark)

games/
  types.ts            shared Game / GameContext / entity interfaces
  utils.ts             brick-wall pattern generator
  Menu.ts              the game carousel
  Leaderboard.ts       the scores screen
  Breakout.ts, BrickShooter.ts, PacMan.ts, Snake.ts, Tetris.ts, Frogger.ts
                       one file per game, each exporting a create*() factory
                       that returns a Game (init/update/draw/press/...)

hooks/
  useSound.ts          Web Audio synthesis (oscillators, no audio files)
  useFocus.ts          d-pad-driven focus system for overlays/panels —
                       lets the physical controls navigate on-screen menus

lib/
  constants.ts         grid size, lives table, icon data URIs, seed
                       leaderboard, Direction type
  canvas.ts             drawing primitives (grid, cells, pixel-art text,
                       pill-button SVGs) shared by every game's draw()
  state.ts              HeldKeys type
  storage.ts            localStorage-backed best score, hand + sound prefs

index.html, harness.js, variants/
                       the original, pre-migration single-file build and
                       its headless test suite — kept as a reference and
                       for `node harness.js index.html` regression checks
                       against the game logic this app was ported from
```

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Build

```bash
npm run build   # production build into .next/
npm run start   # serve that build
npm run lint    # next lint
```

## Architecture notes

**One shared mutable game-state object.** `ArcadeGame` keeps a single `S`
object (`sRef.current`) that every active game mutates directly by
reference — score, coins, level, lives, pause/over flags. React state
(`view`) is a throttled mirror of it, synced once per frame only when a
rendered value actually changes, so the HUD updates without triggering a
60fps re-render. This mirrors the original's single module-scope `const S`.

**Games are plain factories, not components.** Each `create*(getContext)`
in `games/` returns a `Game` object with `init/update/draw/press/...`.
`ArcadeGame` creates all six once on mount and switches between them by
swapping which one `gameRef.current` points at — nothing is
mounted/unmounted per game, so switching games never re-triggers game
construction.

**The d-pad drives on-screen panels via `useFocus`.** When an overlay or
the settings panel is open, `useFocus` tracks which button is highlighted
and lets directional presses move between them and the centre button
activate the highlighted one — a DOM-driven focus host system, not React
state, so it works the same way the original's `Focus`/`focusIn`/
`moveFocus` did.

**The grid is sacred.** `COLS = 17, ROWS = 20` (`lib/constants.ts`). Every
game snaps to it via `cellBlock()`; `CELL` is derived in `fitCanvas()`
from the board's actual pixel width, not hardcoded.

**Artwork is baked.** HUD icons and the leaderboard banner are PNGs
embedded as base64 data URIs in `ICON` (`lib/constants.ts`) — kept
dependency-free rather than served as static assets.

**Sound is synthesised, not sampled.** Oscillators via Web Audio, no audio
files. Off by default: browsers block audio until the first user gesture,
so an on-by-default toggle would read "ON" while silent.

**Lives:** three hearts in Breakout, Brick Shooter, Pac-Man, Frogger and
Snake (`LIVES_GAMES` in `lib/constants.ts`). Tetris shows them dimmed,
since a "life" there would only mean clearing the board. Losing one
respawns you into the same run — score/coins/level carry over.

**Leaderboard is local.** Your best score persists in `localStorage`
(`lib/storage.ts`); the other four names are seed placeholders
(`SEED_BOARD`). Swap `fetchBoard()` to wire it to a real backend —
nothing else needs to change.

## Testing against the original

`harness.js` is a headless test suite (40 checks) that was written for the
pre-migration single-file build. It loads `index.html`'s inline `<script>`
into a stubbed DOM and drives every game through thousands of frames of
fuzzed input plus scripted mechanic checks:

```bash
node harness.js index.html
```

This doesn't exercise the Next.js app directly (it needs a single inline
`<script>` with a specific export shape) — it's a regression check on the
game-logic reference this app was ported from, useful for diffing behavior
when in doubt about what a game *should* do.

## Deploy

`vercel.json` and `DEPLOY.md` predate the Next.js migration and describe
deploying the standalone `index.html` — they don't apply to this app.
Vercel auto-detects Next.js projects; `npx vercel` from the repo root is
enough.
