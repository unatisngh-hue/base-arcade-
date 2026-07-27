'use client';

import { useEffect, useCallback, useRef } from 'react';
import { KEYS, Direction } from '@/lib/constants';
import { HeldKeys } from '@/lib/state';

interface UseInputProps {
  onPress: (dir: Direction) => void;
  onRelease: (dir: Direction) => void;
  held: HeldKeys;
}

export function useInput({ onPress, onRelease, held }: UseInputProps) {
  const heldRef = useRef(held);
  heldRef.current = held;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const d = KEYS[e.key] as Direction;
      if (d) {
        e.preventDefault();
        if (!e.repeat) onPress(d);
      }
    },
    [onPress]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const d = KEYS[e.key] as Direction;
      if (d) onRelease(d);
    },
    [onRelease]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
