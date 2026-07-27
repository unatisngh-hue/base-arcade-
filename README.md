# BASE ARCADE

Six retro arcade games in a single self-contained HTML file. No build step, no
dependencies, no bundler. Locked to phone width (393px) on any screen.

```
base-arcade-project/
├── index.html                the entire app — HTML + CSS + JS in one file
├── harness.js                headless test suite (40 checks)
├── vercel.json               deploy config
├── README.md / DEPLOY.md
├── .gitignore
└── variants/
    └── index-17col.html      17-column alternative (see "Grid width" below)
```

## Run it

Just open `index.html` in a browser — double-click, or in VS Code use the
**Live Preview** / **Live Server** extension.

To serve it the way it'll be deployed:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Test it

```bash
node harness.js index.html
```

Loads the inline `<script>` into a stubbed DOM and drives every game through
thousands of frames of fuzzed input plus scripted mechanic checks. Should
report **40/40**. Run it after any change to game logic — it has caught real
bugs (Brick Shooter burning all three lives in three frames; the grid's missing
bottom rule).

## Deploy

```bash
npx vercel login
npx vercel          # preview URL
npx vercel --prod   # go live
```

Or drag this folder onto vercel.com/new. See `DEPLOY.md` in this folder
for the full walkthrough.

## Where things are in `index.html`

It's one file, ~1,950 lines, in three parts:

| Lines | What |
|-------|------|
| 11–367 | `<style>` — all CSS. Design tokens live in `:root` at the top. |
| 369–482 | markup — phone shell, header, board, controls, popups |
| 484–1943 | `<script>` — all logic |

Inside the script:

| Line | Section |
|------|---------|
| 487 | Canvas core, `fitCanvas()`, `drawGrid()`, `cellBlock()` |
| 585 | BASE wordmark glyphs + wall patterns |
| 632 | Sound (Web Audio synthesis) |
| 665 | Leaderboard data |
| 730 | HUD icons (base64 PNGs) + lives |
| 813 | State, HUD, overlays |
| 855 | Menu-focus layer (D-pad drives panels) |
| 1018 | Input + D-pad |
| 1092 | Settings / hand preference |
| 1166 | `Menu` (the game carousel) |
| 1212 | `Leaderboard` screen |
| 1260 | `Breakout` |
| 1346 | `BrickShooter` |
| 1469 | `PacMan` |
| 1563 | `Snake` |
| 1643 | `Tetris` |
| 1738 | `Frogger` |
| 1816 | Flow — `start()`, `gameOver()`, `pause()`, `openMenu()` |
| 1917 | Boot + `requestAnimationFrame` loop |

## Things worth knowing before you edit

**The grid is sacred.** `COLS = 16, ROWS = 20` (17 in the variant).
Every game snaps to it via `cellBlock()`. `CELL` is the cell size and is derived
in `fitCanvas()`.

**The canvas sits *inside* the bezel.** `BEZEL = 7`. The pixel frame is drawn on
top of the board, so `fitCanvas()` insets the canvas by that amount — otherwise
the frame paints over the first and last rows and they render a third short.
This caused a long-running visual bug; don't undo it.

**Board height is computed, not CSS.** `fitCanvas()` sets it to exactly
`ROWS * CELL` so the grid always divides the board with nothing left over.
`#boardWrap` has no `aspect-ratio` for that reason.

**Artwork is baked.** The HUD icons (coin, star, hourglass, hearts) and the
leaderboard banner are the original Figma vectors rendered to 4x PNGs and
embedded as data URIs in the `ICON` map (~24KB total). That keeps the file
self-contained. To change them, re-export from the source SVGs.

**Sound is synthesised, not sampled.** Oscillators, no audio files. Off by
default — browsers block audio until the first user gesture, so an
on-by-default toggle would read ON while silent.

**Lives:** three hearts in Breakout, Brick Shooter, Pac-Man, Frogger and Snake.
Tetris shows them dimmed, since a "life" there would only mean clearing the
board. Each game's `respawn()` defines what a life costs you — Breakout keeps
the broken wall, Pac-Man keeps eaten dots, Frogger keeps traffic moving.

**Leaderboard is local.** Your best score persists in `localStorage`; the other
four names are placeholders. Replace `fetchBoard()` to wire it to a real source
— nothing else needs to change.

## Grid width

`index.html` runs a **16-column** grid, which leaves the BASE wall flush against
the right edge — the wordmark needs 15 of the 16 columns, so the single spare
column can't be split evenly.

`variants/index-17col.html` runs **17 columns**, giving the wall one cell of
margin on each side. Everything else is identical; the trade is that cells are
~6% narrower and the board is shorter. Swap it in by replacing `index.html`.
# base-arcade-
