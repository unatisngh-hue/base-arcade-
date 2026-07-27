'use client';

import { useRef, useCallback } from 'react';
import { GAME_PITCH } from '@/lib/constants';

export function useSound(soundOn: boolean, gameKey: string | null) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtxRef.current = new AC();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const blip = useCallback(
    (freq: number | number[], dur: number, type: OscillatorType, gain: number, delay?: number) => {
      if (!soundOn) return;
      const c = getAudioContext();
      if (!c) return;

      const t0 = c.currentTime + (delay || 0);
      const osc = c.createOscillator();
      const g = c.createGain();

      osc.type = type;
      if (Array.isArray(freq)) {
        osc.frequency.setValueAtTime(freq[0], t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq[1]), t0 + dur);
      } else {
        osc.frequency.setValueAtTime(freq, t0);
      }

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(g);
      g.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    [soundOn, getAudioContext]
  );

  const semitone = (n: number) => Math.pow(2, n / 12);

  const sfx = useCallback(
    (name: string) => {
      if (!soundOn) return;
      const k = semitone(GAME_PITCH[gameKey || ''] || 0);

      switch (name) {
        case 'hit':
          blip(420 * k, 0.05, 'square', 0.16);
          break;
        case 'brick':
          blip(720 * k, 0.05, 'square', 0.15);
          break;
        case 'eat':
          blip(560 * k, 0.06, 'triangle', 0.2);
          blip(840 * k, 0.07, 'triangle', 0.18, 0.05);
          break;
        case 'shoot':
          blip([900 * k, 300 * k], 0.09, 'square', 0.12);
          break;
        case 'rotate':
          blip(300 * k, 0.04, 'square', 0.1);
          break;
        case 'line':
          [0, 4, 7, 12].forEach((n, i) => blip(440 * semitone(n), 0.09, 'square', 0.16, i * 0.045));
          break;
        case 'level':
          [0, 5, 9, 14].forEach((n, i) => blip(392 * semitone(n), 0.11, 'triangle', 0.2, i * 0.07));
          break;
        case 'life':
          blip([500, 180], 0.28, 'triangle', 0.22);
          break;
        case 'over':
          [0, -3, -7, -12].forEach((n, i) => blip(392 * semitone(n), 0.16, 'square', 0.2, i * 0.12));
          break;
      }
    },
    [soundOn, gameKey, blip]
  );

  const playConfirmation = useCallback(() => {
    blip(660, 0.06, 'square', 0.16);
  }, [blip]);

  return { sfx, playConfirmation };
}
