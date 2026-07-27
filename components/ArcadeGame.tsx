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

import { COLS, ROWS, BEZEL, Direction } from '@/lib/constants';
import { GameState, HeldKeys } from '@/lib/state';
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
  fetchBoard,
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

const MAX_LIVES = 3;
const LIVES_GAMES: Record<string, boolean> = {
  breakout: true,
  pacman: true,
  snake: true,
  frogger: true,
};

interface CatalogEntry {
  key: string;
  game: Game;
  short: string;
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

  // Canvas dimensions
  const canvasDims = useRef({ CELL: 0, W: 0, H: 0 });
  const colorsRef = useRef<Record<string, string>>({});

  const [state, setState] = useState<GameState>({
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
    hand: 'default',
  });

  const [showSettings, setShowSettings] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [overlayConfig, setOverlayConfig] = useState<{
    show: boolean;
    title: string;
    sub?: string;
    buttons: { label: string; ghost?: boolean; onClick: () => void }[];
  }>({ show: false, title: '', buttons: [] });

  const stateRef = useRef(state);
  stateRef.current = state;

  const gameRef = useRef<Game | null>(null);
  const catalogRef = useRef<CatalogEntry[]>([]);
  const menuRef = useRef<ReturnType<typeof createMenu> | null>(null);
  const leaderboardRef = useRef<Game | null>(null);

  const { sfx } = useSound(soundOn, state.key);

  // Memoize handlers to avoid recreating them
  const handleGameOverRef = useRef<(reason: string) => void>(() => {});
  const handleLevelUpRef = useRef<(reason: string) => void>(() => {});

  // Create game context getter
  const getContext = useCallback((): GameContext => {
    const ctx = ctxRef.current;
    const { CELL, W, H } = canvasDims.current;
    return {
      ctx: ctx!,
      CELL,
      W,
      H,
      COL: colorsRef.current,
      held: heldRef.current,
      S: {
        screen: stateRef.current.screen,
        key: stateRef.current.key,
        paused: stateRef.current.paused,
        over: stateRef.current.over,
        coins: stateRef.current.coins,
        score: stateRef.current.score,
        time: stateRef.current.time,
        level: stateRef.current.level,
        lives: stateRef.current.lives,
        livesApply: stateRef.current.livesApply,
      },
      sfx,
      gameOver: (reason: string) => handleGameOverRef.current(reason),
      levelUp: (reason: string) => handleLevelUpRef.current(reason),
    };
  }, [sfx]);

  // Initialize games
  useEffect(() => {
    const canvas = boardRef.current?.canvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    // Get colors from CSS
    const css = getComputedStyle(document.documentElement);
    colorsRef.current = getColors(css);

    // Create all games
    const breakout = createBreakout(getContext);
    const brickShooter = createBrickShooter(getContext);
    const pacman = createPacMan(getContext);
    const snake = createSnake(getContext);
    const tetris = createTetris(getContext);
    const frogger = createFrogger(getContext);

    catalogRef.current = [
      { key: 'breakout', game: breakout, short: 'BREAKOUT' },
      { key: 'snake', game: snake, short: 'SNAKE & BALL' },
      { key: 'brickshooter', game: brickShooter, short: 'BRICK SHOOTER' },
      { key: 'pacman', game: pacman, short: 'PAC MAN' },
      { key: 'tetris', game: tetris, short: 'TETRIS' },
      { key: 'frogger', game: frogger, short: 'FROGGER' },
    ];

    menuRef.current = createMenu(getContext, catalogRef.current, (key: string) => startGame(key));
    leaderboardRef.current = createLeaderboard(getContext, () => openMenu());

    // Load preferences
    const savedHand = getSavedHand();
    const savedSound = getSavedSound();
    setState(prev => ({ ...prev, hand: savedHand }));
    setSoundOn(savedSound);

    // Fit canvas
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animRef.current);
    };
  }, [getContext]);

  // Start game loop
  useEffect(() => {
    if (state.screen === 'splash') return;

    const frame = (t: number) => {
      const dt = Math.min((t - lastRef.current) / 1000, 0.05);
      lastRef.current = t;

      const currentState = stateRef.current;
      const game = gameRef.current;

      if (currentState.screen === 'play' && !currentState.paused && !currentState.over && game) {
        setState(prev => ({ ...prev, time: prev.time + dt }));
        const result = game.update(dt);
        if (result === 'over') {
          handleGameOver('');
        }
      }

      // Draw
      const ctx = ctxRef.current;
      const { W, H, CELL } = canvasDims.current;
      const COL = colorsRef.current;

      if (ctx && W && H) {
        clearBoard(ctx, W, H, COL.board || '#0F172A');
        if (currentState.screen === 'play' || currentState.screen === 'menu') {
          drawGrid(ctx, W, H, CELL, COL.grid || '#2E4E82');
        }
        if (game && game.draw) {
          game.draw();
        }
      }

      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame((t) => {
      lastRef.current = t;
      frame(t);
    });

    return () => cancelAnimationFrame(animRef.current);
  }, [state.screen]);

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

  const openMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      screen: 'menu',
      paused: false,
      over: false,
      coins: 0,
      score: 0,
      time: 0,
      level: 1,
      livesApply: true,
      lives: MAX_LIVES,
    }));
    gameRef.current = menuRef.current;
    menuRef.current?.init();
    setOverlayConfig({ show: false, title: '', buttons: [] });
  }, []);

  const startGame = useCallback((key: string) => {
    const entry = catalogRef.current.find(g => g.key === key);
    if (!entry) return;

    gameRef.current = entry.game;
    setState(prev => ({
      ...prev,
      screen: 'play',
      key,
      paused: false,
      over: false,
      coins: 0,
      score: 0,
      time: 0,
      level: 1,
      livesApply: !!LIVES_GAMES[key],
      lives: LIVES_GAMES[key] ? MAX_LIVES : 0,
    }));
    handleResize();
    entry.game.init();
    setOverlayConfig({ show: false, title: '', buttons: [] });
  }, [handleResize]);

  const handleGameOver = useCallback((reason: string) => {
    const currentState = stateRef.current;
    if (currentState.over) return;

    if (currentState.livesApply && currentState.lives > 1) {
      setState(prev => ({ ...prev, lives: prev.lives - 1, paused: true }));
      sfx('life');
      const newLives = currentState.lives - 1;
      setOverlayConfig({
        show: true,
        title: 'LIFE LOST',
        sub: `${reason}<br><br>${newLives} ${newLives === 1 ? 'LIFE' : 'LIVES'} LEFT`,
        buttons: [
          {
            label: 'CONTINUE',
            onClick: () => {
              const game = gameRef.current;
              if (game?.respawn) game.respawn();
              else game?.init();
              setState(prev => ({ ...prev, paused: false }));
              setOverlayConfig({ show: false, title: '', buttons: [] });
            },
          },
        ],
      });
      return;
    }

    if (currentState.livesApply) {
      setState(prev => ({ ...prev, lives: 0 }));
    }
    setState(prev => ({ ...prev, over: true }));
    sfx('over');

    const key = currentState.key;
    const rank = key ? submitScore(key, currentState.score) : null;

    setOverlayConfig({
      show: true,
      title: 'GAME OVER',
      sub: `${reason}<br><br>LEVEL ${currentState.level}<br>SCORE ${currentState.score}<br>COINS ${currentState.coins}<br>TIME ${fmtTime(currentState.time)}${rank ? `<br><br>NEW BEST — RANK ${rank}` : ''}`,
      buttons: [
        { label: 'PLAY AGAIN', onClick: () => key && startGame(key) },
        { label: 'SCORES', ghost: true, onClick: () => openLeaderboard() },
        { label: 'MENU', ghost: true, onClick: openMenu },
      ],
    });
  }, [sfx, startGame, openMenu]);

  const handleLevelUp = useCallback((reason: string) => {
    const currentState = stateRef.current;
    if (currentState.over) return;

    setState(prev => ({ ...prev, paused: true }));
    sfx('level');
    setOverlayConfig({
      show: true,
      title: `LEVEL ${currentState.level}`,
      sub: reason,
      buttons: [
        {
          label: 'CONTINUE',
          onClick: () => {
            setState(prev => ({ ...prev, paused: false }));
            setOverlayConfig({ show: false, title: '', buttons: [] });
          },
        },
      ],
    });
  }, [sfx]);

  // Update refs after defining callbacks
  useEffect(() => {
    handleGameOverRef.current = handleGameOver;
    handleLevelUpRef.current = handleLevelUp;
  }, [handleGameOver, handleLevelUp]);

  const openLeaderboard = useCallback(() => {
    gameRef.current = leaderboardRef.current;
    setState(prev => ({
      ...prev,
      screen: 'board',
      paused: false,
      over: false,
    }));
    leaderboardRef.current?.init();
  }, []);

  const handlePause = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.screen !== 'play' || currentState.over) return;

    setState(prev => ({ ...prev, paused: true }));
    setOverlayConfig({
      show: true,
      title: 'PAUSED',
      sub: `LEVEL ${currentState.level}`,
      buttons: [
        { label: 'RESUME', onClick: handleResume },
        { label: 'RESTART', ghost: true, onClick: () => currentState.key && startGame(currentState.key) },
        { label: 'MENU', ghost: true, onClick: openMenu },
      ],
    });
  }, [startGame, openMenu]);

  const handleResume = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.screen !== 'play' || currentState.over) return;
    setState(prev => ({ ...prev, paused: false }));
    setOverlayConfig({ show: false, title: '', buttons: [] });
  }, []);

  const handleContinue = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.screen === 'menu') {
      const sel = menuRef.current?.sel ?? 0;
      const entry = catalogRef.current[sel];
      if (entry) startGame(entry.key);
    } else {
      handleResume();
    }
  }, [startGame, handleResume]);

  const handlePress = useCallback((dir: Direction) => {
    if (dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down') {
      heldRef.current[dir] = true;
    }

    const currentState = stateRef.current;

    // Splash: any button skips it
    if (currentState.screen === 'splash') {
      if (dir === 'action') finishSplash();
      return;
    }

    // Handle overlay focus navigation
    if (overlayConfig.show || showSettings) {
      // Let overlay/settings handle navigation
      return;
    }

    // Menu navigation
    if (currentState.screen === 'menu') {
      if (dir === 'down') {
        openLeaderboard();
        return;
      }
    }

    if (currentState.paused || currentState.over) return;

    const game = gameRef.current;
    if (game?.press) game.press(dir);
  }, [overlayConfig.show, showSettings, openLeaderboard]);

  const handleRelease = useCallback((dir: Direction) => {
    if (dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down') {
      heldRef.current[dir] = false;
    }
  }, []);

  const finishSplash = useCallback(() => {
    if (stateRef.current.screen !== 'splash') return;
    openMenu();
  }, [openMenu]);

  const handleHandChange = useCallback((hand: string) => {
    setState(prev => ({ ...prev, hand }));
    saveHand(hand);
  }, []);

  const handleSoundToggle = useCallback(() => {
    setSoundOn(prev => {
      const newVal = !prev;
      saveSound(newVal);
      return newVal;
    });
  }, []);

  const handleOpenSettings = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.screen === 'play' && !currentState.paused && !currentState.over) {
      setState(prev => ({ ...prev, paused: true }));
    }
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const handleCanvasClick = useCallback((x: number, y: number) => {
    if (stateRef.current.screen !== 'menu') return;
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

    const handleKeyDown = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) {
        e.preventDefault();
        if (!e.repeat) handlePress(d);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) handleRelease(d);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePress, handleRelease]);

  const gameTitle = state.screen === 'menu' ? 'BASE ARCADE' : (gameRef.current?.title ?? 'BASE ARCADE');
  const gameLabel = state.screen === 'menu' ? (catalogRef.current[menuRef.current?.sel ?? 0]?.short ?? '') : '';

  return (
    <div className="arcadeWrap">
      <Splash show={state.screen === 'splash'} onFinish={finishSplash} />

      <Header title={gameTitle} onTitleClick={openMenu} />

      <HUD
        coins={state.coins}
        score={state.score}
        time={state.time}
        lives={state.lives}
        livesApply={state.livesApply}
      />

      <Controls
        onPause={handlePause}
        onContinue={handleContinue}
        onSettings={handleOpenSettings}
        pauseDisabled={state.screen !== 'play'}
        continueDisabled={false}
      />

      <GameBoard
        ref={boardRef}
        gameLabel={gameLabel}
        showLabel={state.screen === 'menu'}
        onCanvasClick={handleCanvasClick}
      />

      <DPadContainer
        hand={state.hand}
        onPress={handlePress}
        onRelease={handleRelease}
        onSelectPress={() => handlePress('action')}
      />

      <Overlay
        show={overlayConfig.show}
        title={overlayConfig.title}
        sub={overlayConfig.sub}
        buttons={overlayConfig.buttons}
      />

      <SettingsPanel
        show={showSettings}
        hand={state.hand}
        soundOn={soundOn}
        onClose={handleCloseSettings}
        onHandChange={handleHandChange}
        onSoundToggle={handleSoundToggle}
      />
    </div>
  );
}
