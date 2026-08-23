/**
 * Reader — Navigation
 *
 * Turning a page is the only interaction the reader has. Keyboard, swipe and
 * edge tap all resolve to the same two moves, so the reading surface never
 * asks to be scrolled, dragged or scrubbed.
 */

import { useEffect, useRef } from 'react';

/* ── Types ────────────────────────────────────────────────────── */

type TurnHandlers = {
  next: () => void;
  previous: () => void;
  first?: () => void;
  last?: () => void;
  exit?: () => void;
};

type TouchOrigin = {
  x: number;
  y: number;
  at: number;
};

/* ── Constants ────────────────────────────────────────────────── */

/** Horizontal travel that counts as a swipe. */
const SWIPE_THRESHOLD = 48;

/** Fraction of the width at each edge that turns the page when tapped. */
const TAP_ZONE = 0.28;

/** Longer than this and it's a considered gesture, not a tap. */
const TAP_MAX_MS = 300;

/** Movement above this and it's a drag, not a tap. */
const TAP_MAX_DRIFT = 10;

/** Anything the reader shouldn't hijack a tap from. */
const INTERACTIVE = "a, button, audio, video, input, textarea, select, [role='button']";

/* ── Private helpers ──────────────────────────────────────────── */

const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(INTERACTIVE) !== null;

/* ── Public functions ─────────────────────────────────────────── */

/** Which move each key makes. Vim keys included, since readers reach for them. */
const KEY_ACTIONS: Record<string, keyof TurnHandlers> = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  PageDown: 'next',
  ' ': 'next',
  j: 'next',
  l: 'next',
  ArrowLeft: 'previous',
  ArrowUp: 'previous',
  PageUp: 'previous',
  k: 'previous',
  h: 'previous',
  Home: 'first',
  End: 'last',
  Escape: 'exit',
};

/** Arrow keys, space, page keys, home/end, escape. */
const useKeyboardTurns = (handlers: TurnHandlers): void => {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || isInteractive(event.target)) {
        return;
      }

      const action = KEY_ACTIONS[event.key];
      if (action === undefined) {
        return;
      }

      // Escape leaves the reader; it isn't ours to swallow if nobody handles it.
      const handler = latest.current[action];
      if (handler === undefined) {
        return;
      }

      if (action !== 'exit') {
        event.preventDefault();
      }
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
};

/**
 * Swipe and edge tap.
 *
 * A tap near either edge turns the page; a tap in the middle does nothing, so
 * the reader can rest a thumb anywhere without losing their place.
 */
const useTouchTurns = (ref: React.RefObject<HTMLElement | null>, handlers: TurnHandlers): void => {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    let origin: TouchOrigin | null = null;

    const onTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch) {
        origin = null;
        return;
      }
      origin = { x: touch.clientX, y: touch.clientY, at: performance.now() };
    };

    const onTouchEnd = (event: TouchEvent): void => {
      const touch = event.changedTouches[0];
      const start = origin;
      origin = null;

      if (!start || !touch || event.changedTouches.length !== 1) {
        return;
      }

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX >= SWIPE_THRESHOLD && absX > absY * 1.2) {
        if (dx < 0) {
          latest.current.next();
        } else {
          latest.current.previous();
        }
        return;
      }

      const isTap = performance.now() - start.at < TAP_MAX_MS && absX < TAP_MAX_DRIFT && absY < TAP_MAX_DRIFT;
      if (!isTap || isInteractive(event.target)) {
        return;
      }

      const bounds = el.getBoundingClientRect();
      const position = (touch.clientX - bounds.left) / bounds.width;

      if (position < TAP_ZONE) {
        latest.current.previous();
      } else if (position > 1 - TAP_ZONE) {
        latest.current.next();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref]);
};

/** Click near either edge, for pointer devices. */
const useClickTurns = (ref: React.RefObject<HTMLElement | null>, handlers: TurnHandlers): void => {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const onClick = (event: MouseEvent): void => {
      if (isInteractive(event.target) || window.getSelection()?.toString()) {
        return;
      }

      const bounds = el.getBoundingClientRect();
      const position = (event.clientX - bounds.left) / bounds.width;

      if (position < TAP_ZONE) {
        latest.current.previous();
      } else if (position > 1 - TAP_ZONE) {
        latest.current.next();
      }
    };

    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [ref]);
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { TurnHandlers };
export { useKeyboardTurns, useTouchTurns, useClickTurns, TAP_ZONE };
