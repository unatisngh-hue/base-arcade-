'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Header } from './Header';
import { HUD } from './HUD';
import { Controls } from './Controls';
import { GameBoard, GameBoardRef } from './GameBoard';
import { DPadContainer } from './DPad';
import { Overlay } from './Overlay';
import { SettingsPanel } from './SettingsPanel';
import { Splash } from './Splash';

import { COLS, ROWS, BEZEL, MAX_LIVES, LIVES_GAMES, Direction } from '@/lib/constants';
import { HeldKeys } from '@/lib/state';
import {
  clearBoard,
  drawGrid,
  fitCanvas,
  buildPixFrame,
  getColors,
} from '@/lib/canvas';
import {
  getSavedHand,
  saveHand,
  getSavedSound,
  saveSound,
  submitScore,
} from '@/lib/storage';

import { Game, GameContext } from '@/games/types';
import { createMenu } from '@/games/Menu';
import { createLeaderboard } from '@/games/Leaderboard';
import { createBreakout } from '@/games/Breakout';
import { createBrickShooter } from '@/games/BrickShooter';
import { createPacMan } from '@/games/PacMan';
import { createSnake } from '@/games/Snake';
import { createTetris } from '@/games/Tetris';
import { createFrogger } from '@/games/Frogger';

import { useSound } from '@/hooks/useSound';
import { useFocus } from '@/hooks/useFocus';

interface CatalogEntry {
  key: string;
  game: Game;
  short: string;
}

/* The single mutable game-state object, mirroring `const S` in the original.
   Every game mutates this exact object by reference; React renders a copy. */
type GameS = GameContext['S'];

function createS(): GameS {
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
    livesApply: true,
  };
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function ArcadeGame() {
  const boardRef = useRef<GameBoardRef>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastRef = useRef(0);
  const animRef = useRef<number>(0);
  const heldRef = useRef<HeldKeys>({ left: false, right: false, up: false, down: false });

  const canvasDims = useRef({ CELL: 0, W: 0, H: 0 });
  const colorsRef = useRef<Record<string, string>>({});

  // Authoritative gameplay state, shared by reference with every game.
  const sRef = useRef<GameS>(createS());

  // Render mirror of sRef — updated only when a displayed value changes.
  const [view, setView] = useState<GameS>(() => createS());
  // The carousel's current selection lives on the Menu game instance (`sel`),
  // mutated imperatively by Menu.press()/hit() — same as `Menu.sel` in the
  // original. Mirrored into state so the gameLabel text actually re-renders
  // when you cycle left/right instead of staying stuck on the first game.
  const [menuSel, setMenuSel] = useState(0);
  const menuSelRef = useRef(0);
  const [hand, setHand] = useState('default');
  const handRef = useRef(hand);
  handRef.current = hand;

  const [showSettings, setShowSettings] = useState(false);
  // Off by default, exactly as the original: browsers block audio until the
  // first gesture, so an on-by-default toggle reads "ON" while silent.
  const [soundOn, setSoundOn] = useState(false);
  const [overlayConfig, setOverlayConfig] = useState<{
    show: boolean;
    title: string;
    sub?: string;
    buttons: { label: string; ghost?: boolean; onClick: () => void }[];
  }>({ show: false, title: '', buttons: [] });

  const gameRef = useRef<Game | null>(null);
  const catalogRef = useRef<CatalogEntry[]>([]);
  const menuRef = useRef<ReturnType<typeof createMenu> | null>(null);
  const leaderboardRef = useRef<Game | null>(null);
  const settingsAutoPaused = useRef(false);

  // Focus hosts
  const headerRef = useRef<HTMLDivElement>(null);
  const ovBtnsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const { sfx, playConfirmation } = useSound(soundOn, view.key);
  const {
    focusIn,
    clearFocus,
    moveFocus,
    activateFocus,
    focusActive,
    isHost,
    indexOf,
    paintFocus,
  } = useFocus();

  // Stable identity for sfx so getContext never changes and the games are
  // created exactly once instead of being rebuilt on every sound/key change.
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;

  // Late-bound handlers, referenced from callbacks defined above them.
  const handleGameOverRef = useRef<(reason: string) => void>(() => {});
  const handleLevelUpRef = useRef<(reason: string) => void>(() => {});
  const startGameRef = useRef<(key: string) => void>(() => {});
  const openMenuRef = useRef<() => void>(() => {});
  const handleResumeRef = useRef<() => void>(() => {});

  const hideOverlay = useCallback(() => {
    setOverlayConfig({ show: false, title: '', buttons: [] });
  }, []);

  // Push sRef into React state, but only when a rendered value actually
  // changed — the frame loop calls this 60x/second.
  const lastSig = useRef('');
  const syncView = useCallback(() => {
    const s = sRef.current;
    const sig = [
      s.screen, s.key, s.paused, s.over,
      s.coins, s.score, Math.floor(s.time), s.level, s.lives, s.livesApply,
    ].join('|');
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    setView({ ...s });
  }, []);

  const getContext = useCallback((): GameContext => {
    const { CELL, W, H } = canvasDims.current;
    return {
      ctx: ctxRef.current!,
      CELL,
      W,
      H,
      COL: colorsRef.current,
      held: heldRef.current,
      S: sRef.current, // shared by reference — mutations stick
      sfx: (name: string) => sfxRef.current(name),
      gameOver: (reason: string) => handleGameOverRef.current(reason),
      levelUp: (reason: string) => handleLevelUpRef.current(reason),
    };
  }, []);

  const handleResize = useCallback(() => {
    const canvas = boardRef.current?.canvas;
    const wrap = boardRef.current?.wrap;
    const pixFrame = boardRef.current?.pixFrame;
    const ctx = ctxRef.current;

    if (canvas && wrap && ctx) {
      const dims = fitCanvas(canvas, wrap, ctx, COLS, ROWS, BEZEL);
      canvasDims.current = dims;
      if (pixFrame && dims.W && dims.H) {
        buildPixFrame(pixFrame, wrap.clientWidth, dims.H + BEZEL * 2, BEZEL);
      }
    }
  }, []);

  // Initialize games — runs once.
  useEffect(() => {
    const canvas = boardRef.current?.canvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    const css = getComputedStyle(document.documentElement);
    colorsRef.current = getColors(css);

    catalogRef.current = [
      { key: 'breakout', game: createBreakout(getContext), short: 'BREAKOUT' },
      { key: 'snake', game: createSnake(getContext), short: 'SNAKE & BALL' },
      { key: 'brickshooter', game: createBrickShooter(getContext), short: 'BRICK SHOOTER' },
      { key: 'pacman', game: createPacMan(getContext), short: 'PAC MAN' },
      { key: 'tetris', game: createTetris(getContext), short: 'TETRIS' },
      { key: 'frogger', game: createFrogger(getContext), short: 'FROGGER' },
    ];

    menuRef.current = createMenu(getContext, catalogRef.current, (key: string) =>
      startGameRef.current(key)
    );
    leaderboardRef.current = createLeaderboard(getContext, () => openMenuRef.current());

    setHand(getSavedHand());
    setSoundOn(getSavedSound());

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animRef.current);
    };
  }, [getContext, handleResize]);

  const openMenu = useCallback(() => {
    const s = sRef.current;
    s.screen = 'menu';
    s.paused = false;
    s.over = false;
    s.coins = 0;
    s.score = 0;
    s.time = 0;
    s.level = 1;
    s.livesApply = true; // decorative on the menu, per the mock
    s.lives = MAX_LIVES;

    gameRef.current = menuRef.current;
    menuRef.current?.init();
    hideOverlay();
    syncView();
  }, [hideOverlay, syncView]);
  openMenuRef.current = openMenu;

  const startGame = useCallback(
    (key: string) => {
      const entry = catalogRef.current.find((g) => g.key === key);
      if (!entry) return;

      const s = sRef.current;
      s.screen = 'play';
      s.key = key;
      s.paused = false;
      s.over = false;
      s.coins = 0;
      s.score = 0;
      s.time = 0;
      s.level = 1;
      s.livesApply = !!LIVES_GAMES[key];
      s.lives = s.livesApply ? MAX_LIVES : 0;

      gameRef.current = entry.game;
      handleResize();
      entry.game.init(); // reads the freshly-reset level, not a stale snapshot
      hideOverlay();
      syncView();
    },
    [handleResize, hideOverlay, syncView]
  );
  startGameRef.current = startGame;

  const openLeaderboard = useCallback(() => {
    const s = sRef.current;
    s.screen = 'board';
    s.paused = false;
    s.over = false;
    s.livesApply = true; // ditto on the scores screen
    s.lives = MAX_LIVES;

    gameRef.current = leaderboardRef.current;
    handleResize();
    leaderboardRef.current?.init();
    hideOverlay();
    syncView();
  }, [handleResize, hideOverlay, syncView]);

  const handleGameOver = useCallback(
    (reason: string) => {
      const s = sRef.current;
      if (s.over) return;

      // In the games that use lives, a death costs a heart and drops you back
      // into the same level with your score intact.
      if (s.livesApply && s.lives > 1) {
        s.lives -= 1;
        s.paused = true;
        sfxRef.current('life');
        const left = s.lives;
        setOverlayConfig({
          show: true,
          title: 'LIFE LOST',
          sub: `${reason}<br><br>${left} ${left === 1 ? 'LIFE' : 'LIVES'} LEFT`,
          buttons: [
            {
              label: 'CONTINUE',
              onClick: () => {
                const game = gameRef.current;
                if (game?.respawn) game.respawn();
                else if (game?.initLevel) game.initLevel();
                else game?.init();
                sRef.current.paused = false;
                hideOverlay();
                syncView();
              },
            },
          ],
        });
        syncView();
        return;
      }

      if (s.livesApply) s.lives = 0;
      s.over = true;
      sfxRef.current('over');

      const key = s.key;
      const rank = key ? submitScore(key, s.score) : null;

      setOverlayConfig({
        show: true,
        title: 'GAME OVER',
        sub:
          `${reason}<br><br>LEVEL ${s.level}<br>SCORE ${s.score}<br>COINS ${s.coins}` +
          `<br>TIME ${fmtTime(s.time)}${rank ? `<br><br>NEW BEST — RANK ${rank}` : ''}`,
        buttons: [
          { label: 'PLAY AGAIN', onClick: () => key && startGame(key) },
          { label: 'SCORES', ghost: true, onClick: () => openLeaderboard() },
          { label: 'MENU', ghost: true, onClick: openMenu },
        ],
      });
      syncView();
    },
    [startGame, openMenu, openLeaderboard, hideOverlay, syncView]
  );

  const handleLevelUp = useCallback(
    (reason: string) => {
      const s = sRef.current;
      if (s.over) return;

      s.paused = true;
      sfxRef.current('level');
      setOverlayConfig({
        show: true,
        title: `LEVEL ${s.level}`,
        sub: reason,
        buttons: [
          {
            label: 'CONTINUE',
            onClick: () => {
              sRef.current.paused = false;
              hideOverlay();
              syncView();
            },
          },
        ],
      });
      syncView();
    },
    [hideOverlay, syncView]
  );

  handleGameOverRef.current = handleGameOver;
  handleLevelUpRef.current = handleLevelUp;

  // Game loop
  useEffect(() => {
    if (view.screen === 'splash') return;

    const frame = () => {
      const t = performance.now();
      const dt = Math.min((t - lastRef.current) / 1000, 0.05);
      lastRef.current = t;

      const s = sRef.current;
      const game = gameRef.current;

      if (s.screen === 'play' && !s.paused && !s.over && game) {
        s.time += dt;
        if (game.update(dt) === 'over') handleGameOverRef.current('');
      }

      const ctx = ctxRef.current;
      const { W, H, CELL } = canvasDims.current;
      const COL = colorsRef.current;

      if (ctx && W && H) {
        clearBoard(ctx, W, H, COL.board || '#0F172A');
        if (s.screen === 'play' || s.screen === 'menu') {
          drawGrid(ctx, W, H, CELL, COL.grid || '#2E4E82');
        }
        game?.draw?.(); // the leaderboard clears + grids itself
      }

      if (s.screen === 'menu') {
        const sel = menuRef.current?.sel ?? 0;
        if (sel !== menuSelRef.current) {
          menuSelRef.current = sel;
          setMenuSel(sel);
        }
      }

      syncView();
      animRef.current = requestAnimationFrame(frame);
    };

    lastRef.current = performance.now();
    animRef.current = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(animRef.current);
  }, [view.screen, syncView]);

  const handlePause = useCallback(() => {
    const s = sRef.current;
    if (s.screen !== 'play' || s.over) return;

    s.paused = true;
    setOverlayConfig({
      show: true,
      title: 'PAUSED',
      sub: `LEVEL ${s.level}`,
      buttons: [
        { label: 'RESUME', onClick: () => handleResumeRef.current() },
        { label: 'RESTART', ghost: true, onClick: () => s.key && startGame(s.key) },
        { label: 'MENU', ghost: true, onClick: openMenu },
      ],
    });
    syncView();
  }, [startGame, openMenu, syncView]);

  const handleResume = useCallback(() => {
    const s = sRef.current;
    if (s.screen !== 'play' || s.over) return;
    s.paused = false;
    hideOverlay();
    syncView();
  }, [hideOverlay, syncView]);
  handleResumeRef.current = handleResume;

  const handleContinue = useCallback(() => {
    // CONTINUE: starts the selected game on the menu, resumes in play.
    // On the Scores screen it's neither, so — deviating from the original,
    // where this was a dead click — it takes you back to the menu instead.
    const screen = sRef.current.screen;
    if (screen === 'menu') {
      const entry = catalogRef.current[menuRef.current?.sel ?? 0];
      if (entry) startGame(entry.key);
    } else if (screen === 'board') {
      openMenu();
    } else {
      handleResume();
    }
  }, [startGame, openMenu, handleResume]);

  const finishSplash = useCallback(() => {
    if (sRef.current.screen !== 'splash') return;
    openMenu();
  }, [openMenu]);

  const handlePress = useCallback(
    (dir: Direction) => {
      if (dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down') {
        heldRef.current[dir] = true;
      }

      const s = sRef.current;

      // splash: the centre button skips it
      if (s.screen === 'splash') {
        if (dir === 'action') finishSplash();
        return;
      }

      // a panel is open (pause / game over / level up / settings): the
      // controls drive that panel instead of the game
      if (focusActive()) {
        // in the header row left/right walk the buttons and up/down drops
        // back to the board; everywhere else it's a plain vertical list
        if (isHost(headerRef.current)) {
          if (dir === 'right') return moveFocus(1);
          if (dir === 'left') return moveFocus(-1);
          if (dir === 'down' || dir === 'up') return clearFocus();
          if (dir === 'action') return activateFocus();
          return;
        }
        if (dir === 'down' || dir === 'right') return moveFocus(1);
        if (dir === 'up' || dir === 'left') return moveFocus(-1);
        if (dir === 'action') return activateFocus();
        return;
      }

      // on the carousel the up/down axis is free (the carousel only uses
      // left/right): up reaches the header row, down opens the scores
      if (s.screen === 'menu' && dir === 'up') return focusIn(headerRef.current, 0);
      if (s.screen === 'menu' && dir === 'down') return openLeaderboard();

      if (s.paused || s.over) return;

      gameRef.current?.press?.(dir);
    },
    [finishSplash, focusActive, isHost, moveFocus, clearFocus, activateFocus, focusIn, openLeaderboard]
  );

  const handleRelease = useCallback((dir: Direction) => {
    if (dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down') {
      heldRef.current[dir] = false;
    }
  }, []);

  const handleHandChange = useCallback((h: string) => {
    setHand(h);
    saveHand(h);
  }, []);

  // Confirmation chirp fires only when sound is switched ON, and only from a
  // user toggle — never from the value restored out of localStorage.
  const pendingChirp = useRef(false);
  const handleSoundToggle = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      saveSound(next);
      pendingChirp.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (soundOn && pendingChirp.current) {
      pendingChirp.current = false;
      playConfirmation();
    }
  }, [soundOn, playConfirmation]);

  const handleOpenSettings = useCallback(() => {
    const s = sRef.current;
    if (s.screen === 'play' && !s.paused && !s.over) {
      s.paused = true;
      settingsAutoPaused.current = true;
      syncView();
    }
    setShowSettings(true);
  }, [syncView]);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
    // only resume if opening settings is what paused us
    if (settingsAutoPaused.current) {
      sRef.current.paused = false;
      settingsAutoPaused.current = false;
      syncView();
    }
  }, [syncView]);

  // Overlay owns the controls while it is up; on close the focus is released,
  // and closing settings over a still-open overlay hands them back to it.
  useEffect(() => {
    if (showSettings) return;
    if (overlayConfig.show) focusIn(ovBtnsRef.current, 0);
    else clearFocus();
  }, [overlayConfig, showSettings, focusIn, clearFocus]);

  // Settings opens on the currently-selected hand style.
  useEffect(() => {
    if (!showSettings) return;
    const at = indexOf(settingsRef.current, (b) => b.dataset.hand === handRef.current);
    focusIn(settingsRef.current, at < 0 ? 0 : at);
  }, [showSettings, focusIn, indexOf]);

  // Selecting a style or toggling sound re-renders those pills, which wipes
  // the imperative highlight — put it back.
  useEffect(() => {
    if (showSettings) paintFocus();
  }, [hand, soundOn, showSettings, paintFocus]);

  const handleCanvasClick = useCallback((x: number, y: number) => {
    if (sRef.current.screen !== 'menu') return;
    menuRef.current?.hit?.(x, y);
  }, []);

  // Keyboard input
  useEffect(() => {
    const KEYS: Record<string, Direction> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      a: 'left',
      d: 'right',
      w: 'up',
      s: 'down',
      ' ': 'action',
      Enter: 'action',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) {
        e.preventDefault();
        if (!e.repeat) handlePress(d);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) handleRelease(d);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handlePress, handleRelease]);

  const gameTitle =
    view.screen === 'menu' ? 'BASE ARCADE' : gameRef.current?.title ?? 'BASE ARCADE';
  const gameLabel = view.screen === 'menu' ? catalogRef.current[menuSel]?.short ?? '' : '';

  return (
    <div className="arcadeWrap">
      <Splash show={view.screen === 'splash'} onFinish={finishSplash} />

      <Header title={gameTitle} onTitleClick={openMenu} />

      <HUD
        coins={view.coins}
        score={view.score}
        time={view.time}
        lives={view.lives}
        livesApply={view.livesApply}
      />

      <Controls
        ref={headerRef}
        onPause={handlePause}
        onContinue={handleContinue}
        onSettings={handleOpenSettings}
        pauseDisabled={view.screen !== 'play'}
        continueDisabled={false}
      />

      <GameBoard
        ref={boardRef}
        gameLabel={gameLabel}
        showLabel={view.screen === 'menu'}
        onCanvasClick={handleCanvasClick}
      >
        <Overlay
          ref={ovBtnsRef}
          show={overlayConfig.show}
          title={overlayConfig.title}
          sub={overlayConfig.sub}
          buttons={overlayConfig.buttons}
          onHoverButton={(i) => focusIn(ovBtnsRef.current, i)}
        />
      </GameBoard>

      <DPadContainer
        hand={hand}
        onPress={handlePress}
        onRelease={handleRelease}
        onSelectPress={() => handlePress('action')}
      />

      <SettingsPanel
        ref={settingsRef}
        show={showSettings}
        hand={hand}
        soundOn={soundOn}
        onClose={handleCloseSettings}
        onHandChange={handleHandChange}
        onSoundToggle={handleSoundToggle}
      />
    </div>
  );
}
