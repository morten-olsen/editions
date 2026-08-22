import * as React from 'react';

const isEditableTarget = (e: KeyboardEvent): boolean => {
  const tag = (e.target as HTMLElement).tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

type KeyNav = {
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
};

/** Simple single-key navigation. Returns true when the key was handled. */
const handleNavKey = (e: KeyboardEvent, nav: KeyNav): boolean => {
  switch (e.key) {
    case 'ArrowRight':
    case 'l':
    case 'j':
      e.preventDefault();
      nav.next();
      return true;
    case 'ArrowLeft':
    case 'h':
    case 'k':
      e.preventDefault();
      nav.prev();
      return true;
    case ' ':
      e.preventDefault();
      if (e.shiftKey) {
        nav.prev();
      } else {
        nav.next();
      }
      return true;
    case 'Home':
      e.preventDefault();
      nav.first();
      return true;
    case 'End':
      e.preventDefault();
      nav.last();
      return true;
    default:
      return false;
  }
};

/** Keyboard navigation: arrows, vim keys, space, home/end, gg/G, escape */
const useKeyboardNav = (page: number, total: number, onPageChange: (page: number) => void): void => {
  React.useEffect(() => {
    let pendingG = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;

    const handleKey = (e: KeyboardEvent): void => {
      if (isEditableTarget(e)) {
        return;
      }

      const nav: KeyNav = {
        next: (): void => onPageChange(Math.min(total - 1, page + 1)),
        prev: (): void => onPageChange(Math.max(0, page - 1)),
        first: (): void => onPageChange(0),
        last: (): void => onPageChange(total - 1),
      };

      if (handleNavKey(e, nav)) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          // Bubble up — the parent exit button handler will catch this
          return;
        case 'g':
          if (pendingG) {
            // gg → go to first page
            e.preventDefault();
            clearTimeout(gTimer);
            pendingG = false;
            onPageChange(0);
          } else {
            pendingG = true;
            gTimer = setTimeout(() => {
              pendingG = false;
            }, 400);
          }
          return;
        case 'G':
          e.preventDefault();
          clearTimeout(gTimer);
          pendingG = false;
          onPageChange(total - 1);
          return;
        default:
          pendingG = false;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      clearTimeout(gTimer);
    };
  }, [page, total, onPageChange]);
};

export { useKeyboardNav };
