'use client';

import { useRef, useEffect, useCallback } from 'react';

export function useGameLoop(callback: (dt: number) => void) {
  const callbackRef = useRef(callback);
  const lastRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const frame = useCallback((t: number) => {
    const dt = Math.min((t - lastRef.current) / 1000, 0.05);
    lastRef.current = t;
    callbackRef.current(dt);
    rafRef.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame((t) => {
      lastRef.current = t;
      frame(t);
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [frame]);
}
