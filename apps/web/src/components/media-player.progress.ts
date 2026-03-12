/* ── Playback progress persistence ───────────────────────────────── */

import * as React from 'react';

import { client } from '../api/api.ts';

const PROGRESS_PREFIX = 'editions:media-progress:';
const SAVE_INTERVAL_MS = 3000;

/** Save progress to server -- fire-and-forget. */
const saveProgressToServer = (articleId: string, ratio: number): void => {
  client
    .PATCH('/api/articles/{articleId}/progress', {
      params: { path: { articleId } },
      body: { progress: ratio },
    })
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .catch(() => {});
};

/** Save current playback position to localStorage and optionally to the server. */
const persistPosition = (el: HTMLMediaElement, localKey: string, articleId?: string | null): void => {
  try {
    localStorage.setItem(localKey, String(el.currentTime));
  } catch {
    /* ignore */
  }
  if (articleId && el.duration > 0) {
    saveProgressToServer(articleId, Math.min(1, el.currentTime / el.duration));
  }
};

/** Restore playback position from localStorage or server progress. */
const restorePosition = (el: HTMLMediaElement, localKey: string, initialProgress?: number | null): void => {
  const saved = localStorage.getItem(localKey);
  if (saved) {
    const t = parseFloat(saved);
    if (Number.isFinite(t) && t > 0 && t < el.duration) {
      el.currentTime = t;
      return;
    }
  }
  if (initialProgress && initialProgress > 0 && initialProgress < 1) {
    el.currentTime = initialProgress * el.duration;
  }
};

/**
 * Persists and restores playback position for a media element.
 *
 * Two layers:
 * - **localStorage** -- fast cache keyed by media URL
 * - **Server API** -- `PATCH /api/articles/:articleId/progress`
 */
const usePlaybackProgress = (
  mediaRef: React.RefObject<HTMLMediaElement | null>,
  src: string,
  articleId?: string | null,
  initialProgress?: number | null,
): void => {
  const localKey = PROGRESS_PREFIX + src;
  const lastSave = React.useRef(0);

  React.useEffect(() => {
    const el = mediaRef.current;
    if (!el) {
      return;
    }

    const restore = (): void => restorePosition(el, localKey, initialProgress);

    el.addEventListener('loadedmetadata', restore, { once: true });
    if (el.readyState >= 1) {
      restore();
    }

    return () => el.removeEventListener('loadedmetadata', restore);
  }, [localKey, mediaRef, initialProgress]);

  React.useEffect(() => {
    const el = mediaRef.current;
    if (!el) {
      return;
    }

    const save = (): void => {
      const now = Date.now();
      if (now - lastSave.current < SAVE_INTERVAL_MS) {
        return;
      }
      lastSave.current = now;
      persistPosition(el, localKey, articleId);
    };

    const onEnded = (): void => {
      try {
        localStorage.removeItem(localKey);
      } catch {
        /* ignore */
      }
      if (articleId) {
        saveProgressToServer(articleId, 1);
      }
    };

    el.addEventListener('timeupdate', save);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', save);
      el.removeEventListener('ended', onEnded);
      if (el.currentTime > 0 && !el.ended) {
        persistPosition(el, localKey, articleId);
      }
    };
  }, [localKey, articleId, mediaRef]);
};

export { usePlaybackProgress };
