'use client';

import { useCallback, useRef } from 'react';

/* Port of the MENU FOCUS block in the original index.html.
   Whichever container is "active" (an overlay, the settings panel or the
   header row) owns a highlighted button; up/down (and left/right) move the
   highlight, the centre button activates it. Kept DOM-driven — same as the
   original — so any button rendered inside a host participates for free. */

function focusables(host: HTMLElement | null): HTMLButtonElement[] {
  if (!host) return [];
  return Array.from(host.querySelectorAll('button')).filter(
    (b) => !b.disabled && !b.hasAttribute('data-nofocus')
  );
}

export function useFocus() {
  const focus = useRef<{ host: HTMLElement | null; idx: number }>({ host: null, idx: 0 });

  const paintFocus = useCallback(() => {
    document.querySelectorAll('.kbFocus').forEach((n) => n.classList.remove('kbFocus'));
    const list = focusables(focus.current.host);
    list[focus.current.idx]?.classList.add('kbFocus');
  }, []);

  const focusIn = useCallback(
    (host: HTMLElement | null, idx = 0) => {
      focus.current.host = host;
      const list = focusables(host);
      if (!list.length) {
        focus.current.host = null;
        return;
      }
      focus.current.idx = Math.max(0, Math.min(idx, list.length - 1));
      paintFocus();
    },
    [paintFocus]
  );

  const clearFocus = useCallback(() => {
    focus.current.host = null;
    document.querySelectorAll('.kbFocus').forEach((n) => n.classList.remove('kbFocus'));
  }, []);

  const moveFocus = useCallback(
    (step: number) => {
      const list = focusables(focus.current.host);
      if (!list.length) return;
      focus.current.idx = (focus.current.idx + step + list.length) % list.length;
      paintFocus();
    },
    [paintFocus]
  );

  const activateFocus = useCallback(() => {
    const list = focusables(focus.current.host);
    list[focus.current.idx]?.click();
  }, []);

  /* true when a panel is up and should be consuming the controls */
  const focusActive = useCallback(
    () => !!focus.current.host && focus.current.host.isConnected,
    []
  );

  const isHost = useCallback((host: HTMLElement | null) => !!host && focus.current.host === host, []);

  /** index of the focusable matching a predicate, -1 when absent */
  const indexOf = useCallback(
    (host: HTMLElement | null, pred: (b: HTMLButtonElement) => boolean) =>
      focusables(host).findIndex(pred),
    []
  );

  return {
    focusIn,
    clearFocus,
    moveFocus,
    activateFocus,
    focusActive,
    isHost,
    indexOf,
    /* React rewrites className wholesale, so a re-render of a focused host
       (selecting a hand style, toggling sound) drops the imperative
       .kbFocus class — callers repaint after those renders. */
    paintFocus,
  };
}
