'use strict';
/*
 * Headless verification harness for base-arcade.html (Section 8 style).
 * Loads the page's inline <script>, stubs canvas/DOM, and drives every
 * game via fuzz (random input, thousands of frames, crash-freedom +
 * NaN checks) and scripted-player checks (does the mechanic work).
 *
 * IMPORTANT: the game's rAF loop keeps a module-level `last` timestamp
 * that is only ever updated inside frame(t) — it is NOT reset by
 * start()/init(). All frame(t) calls in this harness therefore share
 * ONE monotonically-increasing clock for the whole run (see tick()).
 * Resetting a local timestamp per-test produces a deeply negative dt
 * and silently breaks every mechanic — this bit us during development.
 */
const fs = require('fs');
const vm = require('vm');

const HTML_PATH = process.argv[2];
if (!HTML_PATH) { console.error('usage: node harness.js <path-to-base-arcade.html>'); process.exit(1); }
const html = fs.readFileSync(HTML_PATH, 'utf8');

// ---- extract :root token map ----
const rootMatch = html.match(/:root\s*\{([\s\S]*?)\n\}/);
if (!rootMatch) throw new Error('could not find :root block');
const tokenMap = {};
for (const m of rootMatch[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  tokenMap['--' + m[1]] = m[2].trim();
}

// ---- extract the inline <script> ----
const scriptMatch = html.match(/<script>\s*\n([\s\S]*?)\n<\/script>/);
if (!scriptMatch) throw new Error('could not find inline <script>');
const gameScript = scriptMatch[1];

// ---- fake DOM ----
// The board's height comes from CSS `aspect-ratio`, so the stub has to honour
// it — otherwise CELL and H disagree and grid geometry can't be tested.
const BOARD_W = 320;
const BOARD_H = (() => {                       // only a fallback now: fitCanvas()
  const m = html.match(/aspect-ratio:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  return m ? BOARD_W * (parseFloat(m[2]) / parseFloat(m[1])) : 400;
})();

function makeEl(tag) {
  const listeners = {};
  const classes = new Set();
  const attrs = {};
  const el = {
    tagName: tag, id: '', className: '', textContent: '',
    style: {}, dataset: {}, children: [], disabled: false,
    isConnected: true,
    hasAttribute(n){ return n in attrs; },
    getAttribute(n){ return n in attrs ? attrs[n] : null; },
    click(){ if (typeof el.onclick === 'function') el.onclick({preventDefault(){}}); },
    classList: {
      add(c){ classes.add(c); }, remove(c){ classes.delete(c); },
      contains(c){ return classes.has(c); },
      toggle(c, force){ const want = force===undefined ? !classes.has(c) : force; want ? classes.add(c) : classes.delete(c); return want; },
    },
    addEventListener(type, fn){ (listeners[type] = listeners[type]||[]).push(fn); },
    removeEventListener(){},
    setAttribute(n, v){ attrs[n] = v; },
    insertAdjacentHTML(){},
    querySelector(sel){ return el.querySelectorAll(sel)[0] || null; },
    appendChild(child){ el.children.push(child); return child; },
    getBoundingClientRect(){ return { width: BOARD_W, height: BOARD_H, left: 0, top: 0 }; },
    clientWidth: BOARD_W, clientHeight: BOARD_H,
    getContext(){ return ctxStub; },
    // shallow selector support: only tag names, walked recursively —
    // enough for the menu-focus layer's querySelectorAll('button')
    querySelectorAll(sel){
      const want = String(sel||'').trim().toLowerCase();
      const out = [];
      (function walk(n){
        for (const c of n.children) {
          if (c.tagName && c.tagName.toLowerCase() === want) out.push(c);
          walk(c);
        }
      })(el);
      return out;
    },
    _trigger(type, evt){ (listeners[type]||[]).forEach(fn=>fn(evt||{preventDefault(){}})); },
  };
  // setting innerHTML='' is how the code clears a container
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get(){ return _html; },
    set(v){ _html = v; if (v === '') el.children.length = 0; },
  });
  return el;
}
const ctxStub = {
  fillStyle:'', strokeStyle:'', lineWidth:1, font:'', textAlign:'', textBaseline:'',
  shadowColor:'', shadowBlur:0,
  // opt-in recorder so tests can assert on what was actually drawn
  _rec:null,
  setTransform(){}, fillRect(){}, strokeRect(){},
  beginPath(){ if(this._rec) this._rec.length = 0; },
  moveTo(x,y){ if(this._rec) this._rec.push(['M',x,y]); },
  lineTo(x,y){ if(this._rec) this._rec.push(['L',x,y]); },
  stroke(){}, fill(){}, arc(){}, closePath(){}, fillText(){},
  save(){}, restore(){}, translate(){}, rotate(){},
  createLinearGradient(){ return { addColorStop(){} }; },
};

const elCache = new Map();
const documentStub = {
  documentElement: makeEl('html'),
  getElementById(id){
    if (!elCache.has(id)) elCache.set(id, makeEl('div'));
    return elCache.get(id);
  },
  createElement(tag){ return makeEl(tag); },
  addEventListener(){}, removeEventListener(){},
  // only the selectors the app actually uses on `document`
  querySelector(sel){
    if (String(sel).trim() === '.settingsPanel') return settingsPanelStub;
    return null;
  },
  querySelectorAll(sel){
    if (String(sel).trim() === '[data-hand]') return handButtons;
    return [];
  },
  fonts: undefined,
};

// ---- seed the buttons that are declared in HTML (the harness never
// parses markup, so without this those containers look empty and the
// menu-focus tests can't reach into them) ----
const settingsOvStub    = documentStub.getElementById('settingsOverlay');
const settingsPanelStub = makeEl('div');
const headerStub        = documentStub.getElementById('buttons');
const handButtons = [];

// which container each HTML-declared button belongs to
const HEADER_IDS   = ['btnPause', 'btnContinue', 'btnSettings'];
const SETTINGS_IDS = ['btnCloseSettings', 'btnCloseX', 'btnSound'];

for (const m of html.matchAll(/<button\b([^>]*)>/g)) {
  const attrs = m[1];
  const idM   = /id="([^"]+)"/.exec(attrs);
  const handM = /data-hand="([^"]+)"/.exec(attrs);
  const id    = idM ? idM[1] : '';
  const inHeader   = HEADER_IDS.includes(id);
  const inSettings = !!handM || SETTINGS_IDS.includes(id);
  if (!inHeader && !inSettings) continue;

  const b = makeEl('button');
  if (id) { b.id = id; elCache.set(id, b); }
  if (handM) { b.dataset.hand = handM[1]; handButtons.push(b); }
  if (/\bdata-nofocus\b/.test(attrs)) b.setAttribute('data-nofocus', '');
  b.appendChild(makeEl('span'));          // every pill carries its label in a <span>
  (inHeader ? headerStub : settingsOvStub).appendChild(b);
}

const windowStub = { addEventListener(){}, removeEventListener(){}, devicePixelRatio: 1 };
function getComputedStyleStub(){
  return { getPropertyValue(name){ return tokenMap[name] || ''; } };
}

// HUD/banner artwork is loaded through Image(); the harness never paints,
// so `complete` stays false and the draw calls are simply skipped.
function ImageStub(){ this.src=''; this.complete=false; this.width=0; this.height=0; }
const storageStub = (() => {
  const m = new Map();
  return { getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)),
           removeItem:k=>m.delete(k), clear:()=>m.clear() };
})();

const sandbox = {
  document: documentStub,
  window: windowStub,
  Image: ImageStub,
  localStorage: storageStub,
  performance: { now: () => clock },
  getComputedStyle: getComputedStyleStub,
  addEventListener(){}, removeEventListener(){},
  requestAnimationFrame(){ return 0; },
  // capture (don't run) timers so tests can fire the splash timeout manually
  __timeouts: [],
  setTimeout(fn, ms){ sandbox.__timeouts.push({ fn, ms }); return sandbox.__timeouts.length; },
  clearTimeout(){},
  Math, Date, console, Object, Array, JSON, Number, String, Boolean,
  __captured: {},
};
vm.createContext(sandbox);

// Symbols every version must have.
const REQUIRED = `start, press, release, held, S, CATALOG, gameOver, levelUp, pause, resume, openMenu, frame, el,
  Breakout, BrickShooter, PacMan, Snake, Tetris, Frogger, Menu, baseBricks, GLYPH, wallPattern, PAC_MAPS,
  applyHand, openSettings, closeSettings, controlsRow, selectBtn, settingsOv, finishSplash, initSplash, hud,
  COLS, ROWS`;

// Symbols only newer versions have. Captured when present so the same
// harness can run against both the baseline and the experimental build;
// the tests that need them are skipped when they're absent.
const OPTIONAL = ['ctx', 'drawGrid', 'Focus', 'focusables', 'focusActive', 'showOverlay', 'hideOverlay',
                  'LIVES_GAMES', 'MAX_LIVES', 'fetchBoard', 'submitScore', 'openLeaderboard',
                  'Leaderboard', 'fmtTime', 'setSound', 'sfx'];

const trailer = `
Object.assign(__captured, { ${REQUIRED} });
${OPTIONAL.map(n => `try { __captured.${n} = ${n}; } catch(e) {}`).join('\n')}
__captured.getG = function(){ return G; };
`;

vm.runInContext(gameScript + '\n' + trailer, sandbox, { filename: 'base-arcade-inline.js' });
const H = sandbox.__captured;

// ---- ONE shared monotonic clock for the whole harness run ----
let clock = 0;
function tick(ms){ clock += ms; H.frame(clock); return clock; }
function tap(dir){ H.press(dir); H.release(dir); } // simulate a discrete button tap, no stuck `held` flags

// =========================================================
// Results collection
// =========================================================
const results = [];
function report(name, ok, detail){ results.push({ name, ok, detail }); }
function skip(name, why){ results.push({ name, ok: true, skipped: true, detail: 'SKIPPED — ' + why }); }

// the menu-focus layer (D-pad drives open panels) only exists in newer builds
const HAS_FOCUS = typeof H.focusActive === 'function' && !!H.Focus;
// lives / leaderboard / sound landed together
const HAS_SCORE = typeof H.fetchBoard === 'function' && !!H.LIVES_GAMES;

// =========================================================
// FUZZ: every game, thousands of frames, random input, crash + NaN checks
// =========================================================
const DIRS = ['left','right','up','down','action'];
function fuzzGame(key, frames){
  H.start(key);
  H.held.left = H.held.right = H.held.up = H.held.down = false;
  const dt = 1000/60;
  let restarts = 0;
  try {
    for (let i = 0; i < frames; i++) {
      if (Math.random() < 0.35) tap(DIRS[(Math.random()*DIRS.length)|0]);
      H.held.left  = Math.random() < 0.25;
      H.held.right = Math.random() < 0.25;
      H.held.up    = Math.random() < 0.25;
      H.held.down  = Math.random() < 0.25;
      tick(dt);
      if (!Number.isFinite(H.S.score) || !Number.isFinite(H.S.coins) || !Number.isFinite(H.S.time) || !Number.isFinite(H.S.level)) {
        throw new Error(`non-finite HUD state at frame ${i}: score=${H.S.score} coins=${H.S.coins} time=${H.S.time} level=${H.S.level}`);
      }
      if (H.S.paused && !H.S.over) H.S.paused = false; // auto-"continue" past level-up cards so fuzzing actually reaches later levels
      if (H.S.over) {
        restarts++;
        H.start(key);
        H.held.left = H.held.right = H.held.up = H.held.down = false;
      }
    }
    report(`fuzz:${key}`, true, `${frames} frames ok, ${restarts} restarts, no crash, HUD always finite`);
  } catch (e) {
    report(`fuzz:${key}`, false, e.stack || e.message);
  } finally {
    H.held.left = H.held.right = H.held.up = H.held.down = false;
  }
}

const ALL_KEYS = H.CATALOG.map(g => g.key);
for (const key of ALL_KEYS) fuzzGame(key, 3000);

// =========================================================
// SCRIPTED: Brick Shooter — every column 0..15 is reachable/firable
// (regression test for the float-overlap wall-reachability bug)
// =========================================================
(function testBrickShooterReachability(){
  try {
    H.start('brickshooter');
    const g = H.getG();
    const hitCols = new Set();
    const columnsWithBricks = new Set(H.baseBricks(1).map(b => b.c)); // pure fn, no shared-state risk

    for (let col = 0; col < 16; col++) {
      if (H.S.paused || H.S.over) break; // wall already fully cleared (levelUp) or breached
      while (g.col < col) tap('right');
      while (g.col > col) tap('left');
      if (!g.bricks.some(b=>b.alive && b.c===col)) continue;
      let attempts = 0;
      while (g.bricks.some(b=>b.alive && b.c===col) && attempts < 8) {
        tap('up');
        attempts++;
        for (let f = 0; f < 100; f++) {
          tick(1000/60);
          g.drop = 0; // decouple reachability test from the unrelated 7s creep timer
          if (H.S.over || H.S.paused) break;
          if (!g.shots.some(s=>s.col===col)) break; // shot connected or left the board
        }
        if (H.S.over || H.S.paused) break;
      }
      // check before initLevel() (triggered by the last brick dying) overwrites g.bricks with the next level's wall
      if (!g.bricks.some(b=>b.alive && b.c===col)) hitCols.add(col);
      if (H.S.over || H.S.paused) break;
    }

    const missed = [...columnsWithBricks].filter(c=>!hitCols.has(c));
    const wallClearedAndLeveledUp = H.S.paused && H.S.level === 2;
    if (wallClearedAndLeveledUp && missed.length === 0) {
      report('scripted:brickshooter-reachability', true,
        `every brick column (${[...columnsWithBricks].sort((a,b)=>a-b).join(',')}) was reachable; wall cleared and level advanced to 2`);
    } else {
      report('scripted:brickshooter-reachability', false,
        `leveledUp=${wallClearedAndLeveledUp} (S.level=${H.S.level}); columns never cleared: ${missed.join(',') || 'none'}`);
    }
  } catch (e) {
    report('scripted:brickshooter-reachability', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: wallPattern(level) is a valid, non-empty, in-bounds
// brick layout for every level 1-5 (shared by Breakout & Brick Shooter)
// =========================================================
(function testWallPatterns(){
  try {
    const bad = [];
    const counts = [];
    for (let lvl = 1; lvl <= 5; lvl++) {
      const bricks = H.wallPattern(lvl);
      counts.push(bricks.length);
      const outOfBounds = bricks.some(b => b.c < 0 || b.c >= H.COLS || b.r < 0 || b.r >= H.ROWS || !b.alive);
      if (bricks.length === 0 || outOfBounds) bad.push(lvl);
    }
    report('scripted:wallpattern-shapes', bad.length === 0,
      `brick counts per level 1-5: ${counts.join(',')}; out-of-range/empty levels: ${bad.join(',') || 'none'}`);
  } catch (e) {
    report('scripted:wallpattern-shapes', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Tetris — full line clear (2-line clear via O piece)
// =========================================================
(function testTetrisLineClear(){
  try {
    H.start('tetris');
    const g = H.getG();
    const scoreBefore = H.S.score, coinsBefore = H.S.coins, fallBefore = g.fall;
    for (let r = g.grid.length - 2; r < g.grid.length; r++) {
      for (let c = 0; c < g.grid[r].length; c++) g.grid[r][c] = (c===5||c===6) ? null : '#3a6fd0';
    }
    g.piece = { cells:[[0,0],[1,0],[0,1],[1,1]], c:5, r:g.grid.length-2 };
    g.lock();
    const scoreGain = H.S.score - scoreBefore;
    const coinsGain = H.S.coins - coinsBefore;
    const ok = scoreGain === 300 && coinsGain === 2 && g.fall <= fallBefore;
    report('scripted:tetris-line-clear', ok,
      `2-line clear: score +${scoreGain} (want 300), coins +${coinsGain} (want 2), fall ${fallBefore}->${g.fall}`);
  } catch (e) {
    report('scripted:tetris-line-clear', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Snake — eats food, grows, speeds up
// =========================================================
(function testSnakeEats(){
  try {
    H.start('snake');
    const g = H.getG();
    const lenBefore = g.body.length, scoreBefore = H.S.score, stepBefore = g.step;
    const head = g.body[0];
    g.food = { c: head.c + 1, r: head.r }; // directly ahead, dir is 'right'
    for (let f = 0; f < 30 && !H.S.over; f++) tick(1000/60);
    const ok = !H.S.over && g.body.length === lenBefore+1 && H.S.score === scoreBefore+20 && g.step < stepBefore;
    report('scripted:snake-eat', ok,
      `len ${lenBefore}->${g.body.length}, score +${H.S.score-scoreBefore} (want 20), step ${stepBefore}->${g.step}`);
  } catch (e) {
    report('scripted:snake-eat', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Pac Man — autonomous movement eats dots
// =========================================================
(function testPacManEats(){
  try {
    H.start('pacman');
    const g = H.getG();
    const leftBefore = g.left, coinsBefore = H.S.coins;
    for (let f = 0; f < 40 && !H.S.over; f++) tick(1000/60);
    const ok = g.left < leftBefore && H.S.coins > coinsBefore;
    report('scripted:pacman-eat', ok, `dots left ${leftBefore}->${g.left}, coins +${H.S.coins-coinsBefore}`);
  } catch (e) {
    report('scripted:pacman-eat', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Frogger — reaching the home row advances a level (not gameOver),
// and the next level's lanes are measurably faster
// =========================================================
(function testFroggerReachesHome(){
  try {
    H.start('frogger');
    const g = H.getG();
    const lvl1Speed = g.lanes[0].speed;
    for (let i = 0; i < 25 && !H.S.paused && !H.S.over; i++) tap('up'); // no tick() between hops: isolate win-path from traffic timing
    const lvl2Speed = g.lanes[0].speed;
    const ok = H.S.paused && !H.S.over && H.S.level === 2 &&
      H.el.ovS.innerHTML.includes('REACHED HOME') && lvl2Speed > lvl1Speed;
    report('scripted:frogger-reach-home', ok,
      `paused=${H.S.paused} over=${H.S.over} level=${H.S.level} reason="${H.el.ovS.innerHTML}" lane0 speed ${lvl1Speed.toFixed(2)}->${lvl2Speed.toFixed(2)}`);
  } catch (e) {
    report('scripted:frogger-reach-home', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Frogger — overlapping traffic kills
// =========================================================
(function testFroggerTrafficKills(){
  try {
    H.start('frogger');
    const squash = () => {
      const g = H.getG();
      g.frog.r = g.lanes[0].row;
      g.frog.c = 5;
      g.lanes[0].cars[0] = 5.0; // overlaps frog cell [5,6)
      tick(16);
    };
    if (!HAS_SCORE) {
      // baseline build: one hit ends the run outright
      squash();
      const ok = H.S.over && H.el.ovS.innerHTML.includes('HIT BY TRAFFIC');
      report('scripted:frogger-traffic-kill', ok, `over=${H.S.over} (no lives system in this build)`);
      return;
    }
    // with lives: the first two hits cost a heart, the third ends it
    squash();
    const hit1 = !H.S.over && H.S.lives === 2 && H.el.ovS.innerHTML.includes('HIT BY TRAFFIC');
    H.S.paused = false; H.hideOverlay(); H.getG().respawn();
    squash();
    const hit2 = !H.S.over && H.S.lives === 1;
    H.S.paused = false; H.hideOverlay(); H.getG().respawn();
    squash();
    const dead = H.S.over && H.S.lives === 0;
    const ok = hit1 && hit2 && dead;
    report('scripted:frogger-traffic-kill', ok,
      `hit1 costs a life (lives 3->2)=${hit1}, hit2 (->1)=${hit2}, hit3 ends the run=${dead}`);
  } catch (e) {
    report('scripted:frogger-traffic-kill', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Settings — hand preference layout + power button wiring
// =========================================================
(function testHandPreference(){
  try {
    H.applyHand('left');
    const classOk = H.controlsRow.className.includes('hand-left');
    H.applyHand('right');
    const classOk2 = H.controlsRow.className.includes('hand-right');
    H.applyHand('default');
    const classOk3 = H.controlsRow.className.includes('hand-default');
    report('scripted:hand-preference-layout', classOk && classOk2 && classOk3,
      `controlsRow class cycled through left/right/default correctly`);
  } catch (e) {
    report('scripted:hand-preference-layout', false, e.stack || e.message);
  }
})();

(function testSelectButtonFiresAction(){
  try {
    H.start('brickshooter');
    const g = H.getG();
    const shotsBefore = g.shots.length;
    H.selectBtn._trigger('pointerdown');
    const ok = g.shots.length === shotsBefore + 1;
    report('scripted:select-button-action', ok, `shots ${shotsBefore} -> ${g.shots.length} after simulated select-button tap`);
  } catch (e) {
    report('scripted:select-button-action', false, e.stack || e.message);
  }
})();

(function testSettingsPauseResume(){
  try {
    H.start('tetris');
    H.openSettings();
    const pausedWhileOpen = H.S.paused === true && H.settingsOv.classList.contains('show');
    H.closeSettings();
    const resumedAfterClose = H.S.paused === false && !H.settingsOv.classList.contains('show');
    report('scripted:settings-pause-resume', pausedWhileOpen && resumedAfterClose,
      `paused while open=${pausedWhileOpen}, resumed after close=${resumedAfterClose}`);
  } catch (e) {
    report('scripted:settings-pause-resume', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Breakout — level-up shrinks the paddle, speeds up the ball,
// and swaps in wallPattern(level)
// =========================================================
(function testBreakoutLevelScaling(){
  try {
    H.start('breakout');
    const g = H.getG();
    const padW1 = g.padW, speedMul1 = g.speedMul, bricks1 = g.bricks.length;
    H.S.level = 3;
    g.initLevel();
    const padW3 = g.padW, speedMul3 = g.speedMul, bricks3 = g.bricks.length;
    const ok = padW3 < padW1 && speedMul3 > speedMul1 && bricks3 !== bricks1;
    report('scripted:breakout-level-scaling', ok,
      `level1: padW=${padW1.toFixed(1)} speedMul=${speedMul1.toFixed(2)} bricks=${bricks1}; level3: padW=${padW3.toFixed(1)} speedMul=${speedMul3.toFixed(2)} bricks=${bricks3}`);
  } catch (e) {
    report('scripted:breakout-level-scaling', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Brick Shooter — level-up shrinks the creep interval
// (wall drops faster) and swaps in wallPattern(level)
// =========================================================
(function testBrickShooterLevelScaling(){
  try {
    H.start('brickshooter');
    const g = H.getG();
    const creep1 = g.creepInterval, bricks1 = g.bricks.length;
    H.S.level = 4;
    g.initLevel();
    const creep4 = g.creepInterval, bricks4 = g.bricks.length;
    const ok = creep4 < creep1 && bricks4 !== bricks1;
    report('scripted:brickshooter-level-scaling', ok,
      `level1: creepInterval=${creep1} bricks=${bricks1}; level4: creepInterval=${creep4} bricks=${bricks4}`);
  } catch (e) {
    report('scripted:brickshooter-level-scaling', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Pac Man — all 5 mazes are fully connected (BFS from the
// player start), all 4 ghost-spawn corners are open on every maze,
// and ghost count scales 2 -> 6 across levels 1-5
// =========================================================
(function testPacManLevels(){
  try {
    function bfsReachable(mapRows, start){
      const rows = mapRows.length, cols = mapRows[0].length;
      const wall = mapRows.map(r=>r.split('').map(ch=>ch==='#'));
      const seen = Array.from({length:rows},()=>Array(cols).fill(false));
      const stack=[start]; seen[start.r][start.c]=true; let count=0;
      while(stack.length){
        const {c,r}=stack.pop(); count++;
        for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nc=c+dc, nr=r+dr;
          if(nc>=0&&nc<cols&&nr>=0&&nr<rows&&!wall[nr][nc]&&!seen[nr][nc]){ seen[nr][nc]=true; stack.push({c:nc,r:nr}); }
        }
      }
      let totalFree=0;
      for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) if(!wall[r][c]) totalFree++;
      return { reached: count, totalFree };
    }
    const spawnCorners = [{c:2,r:2},{c:13,r:17},{c:13,r:2},{c:2,r:17}];
    const issues = [];
    H.start('pacman');
    const g = H.getG();
    for (let lvl = 1; lvl <= 5; lvl++) {
      const map = H.PAC_MAPS[lvl-1];
      const wall = map.map(r=>r.split('').map(ch=>ch==='#'));
      const { reached, totalFree } = bfsReachable(map, {c:8,r:9});
      if (reached !== totalFree) issues.push(`level ${lvl}: only ${reached}/${totalFree} cells reachable`);
      for (const s of spawnCorners) if (wall[s.r][s.c]) issues.push(`level ${lvl}: ghost spawn (${s.c},${s.r}) is a wall`);

      H.S.level = lvl;
      g.initLevel();
      const expectedGhosts = Math.min(2+(lvl-1), 6);
      if (g.ghosts.length !== expectedGhosts) issues.push(`level ${lvl}: expected ${expectedGhosts} ghosts, got ${g.ghosts.length}`);
    }
    report('scripted:pacman-levels', issues.length===0,
      issues.length ? issues.join('; ') : 'all 5 mazes fully reachable, all 4 ghost-spawn corners open, ghost count scales 2->6');
  } catch (e) {
    report('scripted:pacman-levels', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Snake — obstacle count scales (4,8,12,16) across levels 2-5,
// and colliding with an obstacle ends the run
// =========================================================
(function testSnakeLevels(){
  try {
    H.start('snake');
    const g = H.getG();
    const counts = [];
    for (let lvl=2; lvl<=5; lvl++){
      g.spawnObstacles((lvl-1)*4);
      counts.push(g.obstacles.length);
    }
    const expected = [4,8,12,16];
    const countsOk = JSON.stringify(counts) === JSON.stringify(expected);

    H.start('snake');
    const g2 = H.getG();
    if (HAS_SCORE) H.S.lives = 1;              // snake has lives now — spend them first
    const head = g2.body[0];
    g2.obstacles = [{c: head.c+1, r: head.r}]; // directly ahead, dir is 'right'
    for (let f=0; f<15 && !H.S.over; f++) tick(1000/60);
    const collidedOk = H.S.over && H.el.ovS.innerHTML.includes('HIT AN OBSTACLE');

    report('scripted:snake-levels', countsOk && collidedOk,
      `obstacle counts for levels 2-5: ${counts.join(',')} (want ${expected.join(',')}); obstacle collision ends run=${collidedOk}`);
  } catch (e) {
    report('scripted:snake-levels', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: Tetris — 5 cumulative line clears trigger a level-up
// and seed exactly one garbage row (one gap) at the bottom
// =========================================================
(function testTetrisGarbage(){
  try {
    H.start('tetris');
    const g = H.getG();
    const levelBefore = H.S.level;
    for (let i=0;i<5;i++){
      const r = g.grid.length-1;
      const slot = H.COLS - 4;   // leave exactly 4 cells at the right for the I-piece
      for (let c=0;c<H.COLS;c++) g.grid[r][c] = (c<slot) ? '#3a6fd0' : null;
      g.piece = { cells:[[0,0],[1,0],[2,0],[3,0]], c:slot, r };
      g.lock();
    }
    const leveledUp = H.S.level === levelBefore+1;
    const bottomRow = g.grid[g.grid.length-1];
    const gapCount = bottomRow.filter(v=>!v).length;
    report('scripted:tetris-garbage-row', leveledUp && gapCount===1,
      `level ${levelBefore}->${H.S.level}, bottom row gaps=${gapCount} (want 1)`);
  } catch (e) {
    report('scripted:tetris-garbage-row', false, e.stack || e.message);
  }
})();

// =========================================================
// SANITY: 6 games in CATALOG; carousel Menu cycles and wraps both ways
// =========================================================
(function testCatalogAndMenu(){
  try {
    const keys = H.CATALOG.map(g=>g.key);
    const has6 = keys.length === 6 && keys.includes('frogger');
    report('sanity:catalog-6-games', has6, `keys=${keys.join(',')}`);
  } catch (e) {
    report('sanity:catalog-6-games', false, e.stack || e.message);
  }
})();

(function testSplashScreen(){
  try {
    // boot ran initSplash() — its auto-advance timeout is captured in __timeouts
    H.S.screen = 'splash';
    const t = sandbox.__timeouts.find(x => x.ms >= 2000);
    t.fn();                                   // fire the captured 2.8s timeout
    const transitioned = H.S.screen === 'menu';
    report('scripted:splash-timeout', !!t && transitioned,
      `captured ${sandbox.__timeouts.length} timer(s); splash auto-transitions to menu=${transitioned}`);

    H.S.screen = 'splash';
    H.finishSplash();
    const skipped = H.S.screen === 'menu';
    report('scripted:splash-skip', skipped, `finishSplash() (tap) skips straight to menu=${skipped}`);
  } catch (e) {
    report('scripted:splash-screen', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: the physical controls must drive open panels.
// Regression: press() used to bail out whenever S.paused/S.over
// was set, so the D-pad went dead on the pause + game-over screens.
// =========================================================
(function testPauseOverlayDpadNav(){
  if (!HAS_FOCUS) return skip('scripted:pause-overlay-dpad-nav', 'build has no menu-focus layer');
  try {
    H.start('tetris');
    H.pause();
    // labels live on a child <span>, which the stub doesn't aggregate,
    // so assert on the count rather than the text
    const btns = H.focusables(H.el.ovB);
    const startIdx = H.Focus.idx;
    tap('down');  const afterDown  = H.Focus.idx;
    tap('down');  const afterDown2 = H.Focus.idx;
    tap('up');    const afterUp    = H.Focus.idx;
    // wrap past the end returns to the first option
    tap('up');    const wrapped    = H.Focus.idx;
    const ok = btns.length === 3 && startIdx === 0 &&
               afterDown === 1 && afterDown2 === 2 && afterUp === 1 && wrapped === 0;
    report('scripted:pause-overlay-dpad-nav', ok,
      `${btns.length} options (RESUME/RESTART/MENU); focus 0->${afterDown}->${afterDown2}, up->${afterUp}, wrap->${wrapped}`);
  } catch (e) {
    report('scripted:pause-overlay-dpad-nav', false, e.stack || e.message);
  }
})();

(function testPauseOverlayDpadActivate(){
  if (!HAS_FOCUS) return skip('scripted:pause-overlay-dpad-activate', 'build has no menu-focus layer');
  try {
    H.start('tetris');
    H.pause();
    const wasPaused = H.S.paused === true;
    tap('action');                       // centre button on the focused RESUME
    const resumed = H.S.paused === false;
    report('scripted:pause-overlay-dpad-activate', wasPaused && resumed,
      `paused=${wasPaused}; centre button on RESUME un-paused=${resumed}`);
  } catch (e) {
    report('scripted:pause-overlay-dpad-activate', false, e.stack || e.message);
  }
})();

(function testGameOverDpadNavAndControlsRestored(){
  if (!HAS_FOCUS) return skip('scripted:gameover-dpad-nav', 'build has no menu-focus layer');
  try {
    H.start('tetris');            // the one game with no lives, so this is a real game over
    H.gameOver('TEST');
    const focusOnOverlay = H.focusActive() === true;
    tap('down'); tap('down');
    const movedToMenu = H.Focus.idx === 2;      // PLAY AGAIN -> SCORES -> MENU
    tap('action');                               // activate MENU
    const backToMenu = H.S.screen === 'menu';
    // once the overlay is gone the controls must drive the game again
    const controlsReleased = H.focusActive() === false;
    tap('right');
    const carouselMoved = H.Menu.sel === 1;
    const ok = focusOnOverlay && movedToMenu && backToMenu && controlsReleased && carouselMoved;
    report('scripted:gameover-dpad-nav', ok,
      `focus captured=${focusOnOverlay}, down->MENU=${movedToMenu}, activated=${backToMenu}, released=${controlsReleased}, carousel works after=${carouselMoved}`);
  } catch (e) {
    report('scripted:gameover-dpad-nav', false, e.stack || e.message);
  }
})();

(function testSettingsDpadNav(){
  if (!HAS_FOCUS) return skip('scripted:settings-dpad-nav', 'build has no menu-focus layer');
  try {
    H.openMenu();
    H.applyHand('default');
    H.openSettings();
    const opts = H.focusables(H.settingsOv);
    const startsOnCurrent = opts[H.Focus.idx] && opts[H.Focus.idx].dataset.hand === 'default';
    tap('down');
    tap('action');                    // activate whatever is now focused
    const changed = H.S.hand !== 'default';
    H.closeSettings();
    const released = H.focusActive() === false;
    const ok = opts.length === 5 && startsOnCurrent && changed && released;
    report('scripted:settings-dpad-nav', ok,
      `${opts.length} focusable options (3 styles + sound + done), opened on current style=${startsOnCurrent}, d-pad changed hand to "${H.S.hand}"=${changed}, released on close=${released}`);
  } catch (e) {
    report('scripted:settings-dpad-nav', false, e.stack || e.message);
  }
})();

(function testSplashSkippableByDpad(){
  if (!HAS_FOCUS) return skip('scripted:splash-dpad-skip', 'build has no menu-focus layer');
  try {
    H.S.screen = 'splash';
    tap('action');
    const skipped = H.S.screen === 'menu';
    report('scripted:splash-dpad-skip', skipped,
      `centre button during splash goes to the carousel=${skipped}`);
  } catch (e) {
    report('scripted:splash-dpad-skip', false, e.stack || e.message);
  }
})();

(function testCarouselReachesHeaderRow(){
  if (!HAS_FOCUS) return skip('scripted:carousel-header-reach', 'build has no menu-focus layer');
  try {
    H.openMenu();
    H.Menu.show(0);
    const beforeUp = H.focusActive();
    tap('up');                                  // into the header row
    const reachedHeader = H.focusActive() && H.Focus.host === H.el.header;
    tap('down');                                // back down to the board
    const released = !H.focusActive();
    tap('right');                               // carousel must work again
    const carouselWorks = H.Menu.sel === 1;
    const ok = !beforeUp && reachedHeader && released && carouselWorks;
    report('scripted:carousel-header-reach', ok,
      `up reaches header=${reachedHeader}, down returns to board=${released}, carousel still works=${carouselWorks}`);
  } catch (e) {
    report('scripted:carousel-header-reach', false, e.stack || e.message);
  }
})();

(function testHeaderFocusDoesNotLeakIntoGame(){
  if (!HAS_FOCUS) return skip('scripted:header-focus-no-leak', 'build has no menu-focus layer');
  try {
    H.openMenu();
    tap('up');                                  // focus parked in the header
    H.start('tetris');                          // starting a game must release it
    const released = !H.focusActive();
    const g = H.getG();
    const before = g.piece.c;
    tap('left');
    const moved = g.piece.c === before - 1;
    report('scripted:header-focus-no-leak', released && moved,
      `focus released on start=${released}, gameplay input reaches the game=${moved}`);
  } catch (e) {
    report('scripted:header-focus-no-leak', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: lives, leaderboard, HUD formatting
// =========================================================
(function testLivesApplyToTheRightGames(){
  if (!HAS_SCORE) return skip('scripted:lives-per-game', 'build has no lives system');
  try {
    const withLives = [], without = [];
    for (const c of H.CATALOG) {
      H.start(c.key);
      (H.S.livesApply ? withLives : without).push(c.key);
      if (H.S.livesApply && H.S.lives !== H.MAX_LIVES) throw new Error(c.key+' did not start with 3 lives');
    }
    const ok = withLives.length === 5 && without.length === 1 &&
               without.includes('tetris');
    report('scripted:lives-per-game', ok,
      `lives: ${withLives.join(',')} | dimmed: ${without.join(',')}`);
  } catch (e) {
    report('scripted:lives-per-game', false, e.stack || e.message);
  }
})();

(function testLifeLossKeepsScoreAndLevel(){
  if (!HAS_SCORE) return skip('scripted:life-keeps-progress', 'build has no lives system');
  try {
    H.start('breakout');
    H.S.score = 250; H.S.coins = 12; H.S.level = 3;
    H.gameOver('TEST DEATH');
    const kept = H.S.score === 250 && H.S.coins === 12 && H.S.level === 3;
    const spent = H.S.lives === 2 && !H.S.over && H.S.paused;
    // the two games without lives must die on the first hit
    H.start('tetris');
    H.gameOver('TOPPED OUT');
    const tetrisDies = H.S.over === true;
    const ok = kept && spent && tetrisDies;
    report('scripted:life-keeps-progress', ok,
      `score/coins/level survive=${kept}, one heart spent and run continues=${spent}, tetris still ends on first death=${tetrisDies}`);
  } catch (e) {
    report('scripted:life-keeps-progress', false, e.stack || e.message);
  }
})();

// Regression: BrickShooter.respawn() only nudged the wall up by a fixed
// amount, so it stayed past the breach line and the next frame killed you
// again — all three lives gone in three frames. A respawn has to leave you
// somewhere actually survivable.
(function testRespawnIsSurvivable(){
  if (!HAS_SCORE) return skip('scripted:respawn-survivable', 'build has no lives system');
  try {
    const kill = {
      breakout:     g => { g.by = 10000; },
      brickshooter: g => { g.offset = 40; },
      pacman:       g => { const gh=g.ghosts[0]; gh.c=g.p.c; gh.r=g.p.r; },
      frogger:      g => { g.frog.r = g.lanes[0].row; g.frog.c = 5; g.lanes[0].cars[0] = 5.0; },
      snake:        g => { g.body[0] = {c:0, r:0}; g.dir='left'; g.next='left'; }  // into the wall
    };
    const WANT = 60;                     // ~1s of uninterrupted play is the bar
    const bad = [];
    for (const key of Object.keys(kill)) {
      H.start(key);
      const g = H.CATALOG.find(c=>c.key===key).game;
      kill[key](g);
      tick(16);
      if (H.S.over) { bad.push(`${key}: first death ended the run`); continue; }
      H.el.ovB.children[0].click();      // CONTINUE off the LIFE LOST card
      let n = 0;
      while (n < WANT && !H.S.over && !H.S.paused) { tick(16); n++; }
      if (n < WANT) bad.push(`${key}: only ${n} frames before dying again`);
    }
    report('scripted:respawn-survivable', bad.length === 0,
      bad.length ? bad.join('; ')
                 : `all 5 life-bearing games give >=${WANT} frames of play after a respawn`);
  } catch (e) {
    report('scripted:respawn-survivable', false, e.stack || e.message);
  }
})();

(function testLeaderboard(){
  if (!HAS_SCORE) return skip('scripted:leaderboard', 'build has no leaderboard');
  try {
    const rows = H.fetchBoard();
    const sorted = rows.every((r,i)=> i===0 || rows[i-1].score >= r.score);
    const capped = rows.length <= 5;
    // a big score should put YOU on the board and mark exactly one row
    H.submitScore('breakout', 999);
    const after = H.fetchBoard();
    const you = after.filter(r=>r.you);
    const topIsYou = after[0].you === true;
    const ok = sorted && capped && you.length === 1 && topIsYou;
    report('scripted:leaderboard', ok,
      `sorted=${sorted}, max 5 rows=${capped}, exactly one YOU row=${you.length===1}, 999 ranks first=${topIsYou}`);
  } catch (e) {
    report('scripted:leaderboard', false, e.stack || e.message);
  }
})();

(function testLeaderboardScreenAndBack(){
  if (!HAS_SCORE) return skip('scripted:leaderboard-nav', 'build has no leaderboard');
  try {
    H.openMenu();
    tap('down');                                  // carousel -> scores
    const opened = H.S.screen === 'board';
    const titled = H.el.title.textContent === 'SCORES';
    tap('action');                                // scores -> back to carousel
    const back = H.S.screen === 'menu';
    const before = H.Menu.sel;                    // Menu.init() remembers your place
    tap('right');
    const carousel = H.Menu.sel === (before+1) % H.CATALOG.length;
    const ok = opened && titled && back && carousel;
    report('scripted:leaderboard-nav', ok,
      `down opens scores=${opened}, title becomes SCORES=${titled}, action returns=${back}, carousel still works=${carousel}`);
  } catch (e) {
    report('scripted:leaderboard-nav', false, e.stack || e.message);
  }
})();

(function testHudFormatting(){
  if (!HAS_SCORE) return skip('scripted:hud-format', 'build has no new HUD');
  try {
    const cases = [[0,'0:00'],[7,'0:07'],[59,'0:59'],[60,'1:00'],[125,'2:05']];
    const bad = cases.filter(([n,want]) => H.fmtTime(n) !== want);
    H.start('breakout'); H.S.score = 47; H.hud();
    const padded = H.el.score.textContent === '047';
    const ok = bad.length === 0 && padded;
    report('scripted:hud-format', ok,
      `time M:SS ok=${bad.length===0}${bad.length?' ('+bad.map(b=>b[0]+'->'+H.fmtTime(b[0])).join(',')+')':''}, score zero-padded to 3 ("${H.el.score.textContent}")=${padded}`);
  } catch (e) {
    report('scripted:hud-format', false, e.stack || e.message);
  }
})();

(function testSoundDefaultsOffAndIsSilentWhenOff(){
  if (!HAS_SCORE) return skip('scripted:sound-toggle', 'build has no sound');
  try {
    // no AudioContext exists in the harness at all, so if sfx() tried to
    // make noise while off this would throw
    H.setSound(false);
    ['hit','brick','eat','shoot','rotate','line','level','life','over'].forEach(n=>H.sfx(n));
    report('scripted:sound-toggle', true,
      'every sfx() name is a no-op while sound is off (no AudioContext touched)');
  } catch (e) {
    report('scripted:sound-toggle', false, e.stack || e.message);
  }
})();

// =========================================================
// SCRIPTED: the grid must rule EVERY row boundary, including the
// closing line at the bottom edge. Without it the last row has no
// blue rule under it and reads as an open rectangle.
// =========================================================
(function testGridRulesEveryRow(){
  try {
    H.start('breakout');
    const ctx = H.ctx;
    ctx._rec = [];
    H.drawGrid();
    const rec = ctx._rec.slice();
    ctx._rec = null;

    // split the recorded segments into vertical and horizontal rules
    const vx = [], hy = [];
    for (let i = 0; i < rec.length - 1; i++) {
      const a = rec[i], b = rec[i+1];
      if (a[0] !== 'M' || b[0] !== 'L') continue;
      if (Math.abs(a[1]-b[1]) < 0.01 && Math.abs(b[2]-a[2]) > 1) vx.push({x:a[1], y0:a[2], y1:b[2]});
      if (Math.abs(a[2]-b[2]) < 0.01 && Math.abs(b[1]-a[1]) > 1) hy.push(a[2]);
    }
    hy.sort((p,q)=>p-q);
    // vertical rules run the full height, so they give us the board height;
    // their spacing gives the cell size — no app-side helpers needed
    const boardH = Math.max(...vx.map(v => Math.max(v.y0, v.y1)));
    const xs = vx.map(v=>v.x).sort((p,q)=>p-q);
    const cell = xs.length > 1 ? xs[1] - xs[0] : boardH / H.ROWS;

    const bands = []; let prev = 0;
    hy.forEach(y => { bands.push(y - prev); prev = y; });
    const lastGap = boardH - hy[hy.length-1];

    const closedAtBottom = lastGap <= 1.5;                        // a rule sits on the bottom edge
    // 1px rules snap to whole pixels, so bands wobble ~1px when CELL isn't integral
    const squareRows     = bands.every(b => Math.abs(b - cell) <= 2.0);
    const ok = closedAtBottom && squareRows && hy.length >= H.ROWS;

    report('scripted:grid-rules-every-row', ok,
      `${hy.length} horizontal rules; bottom row ${closedAtBottom ? 'closed' : 'OPEN — ' + lastGap.toFixed(1) + 'px unruled'}; ` +
      `row heights ${Math.min(...bands).toFixed(1)}-${Math.max(...bands).toFixed(1)} vs cell ${cell.toFixed(1)}`);
  } catch (e) {
    report('scripted:grid-rules-every-row', false, e.stack || e.message);
  }
})();

(function testMenuCarousel(){
  try {
    H.openMenu();
    // Menu.init() deliberately preserves the last selection (coming back
    // from a game lands you on that game), so pin it explicitly here
    // rather than depending on whatever ran before.
    H.Menu.show(0);
    const seen = [H.Menu.sel];
    for (let i = 0; i < H.CATALOG.length; i++) { H.Menu.press('right'); seen.push(H.Menu.sel); }
    const forwardWrapsToStart = seen[0] === 0 && seen[seen.length-1] === 0;
    const visitedAllForward = new Set(seen.slice(0, H.CATALOG.length)).size === H.CATALOG.length;

    H.Menu.show(0);
    H.Menu.press('left');
    const backWrapsToLast = H.Menu.sel === H.CATALOG.length - 1;

    H.Menu.init();
    H.Menu.show(2);
    H.Menu.press('action');
    const startedCorrectGame = H.S.screen === 'play' && H.S.key === H.CATALOG[2].key;

    const ok = forwardWrapsToStart && visitedAllForward && backWrapsToLast && startedCorrectGame;
    report('scripted:menu-carousel', ok,
      `forward cycle visits all 6 and wraps to start=${forwardWrapsToStart && visitedAllForward}, left from 0 wraps to last=${backWrapsToLast}, action starts selected game=${startedCorrectGame}`);
  } catch (e) {
    report('scripted:menu-carousel', false, e.stack || e.message);
  }
})();

// =========================================================
// Print report
// =========================================================
console.log('\n=== BASE ARCADE — headless verification ===\n');
let allOk = true;
for (const r of results) {
  if (!r.ok) allOk = false;
  console.log(`[${r.skipped ? 'SKIP' : (r.ok ? 'PASS' : 'FAIL')}] ${r.name}`);
  console.log(`       ${r.detail}`);
}
const skipped = results.filter(r => r.skipped).length;
const ran = results.length - skipped;
console.log(`\n${results.filter(r=>r.ok).length - skipped}/${ran} checks passed` +
            (skipped ? ` (${skipped} skipped — feature not in this build).` : '.'));
process.exit(allOk ? 0 : 1);
