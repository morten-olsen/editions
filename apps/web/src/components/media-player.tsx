import * as React from 'react';
import { motion } from 'motion/react';

import { client } from '../api/api.ts';

/* ── Playback progress persistence ───────────────────────────────── */

const PROGRESS_PREFIX = 'editions:media-progress:';
const SAVE_INTERVAL_MS = 3000;

/**
 * Persists and restores playback position for a media element.
 *
 * Two layers:
 * - **localStorage** — fast cache keyed by media URL, written every
 *   ~3 seconds. Provides instant restore without a network round-trip.
 * - **Server API** — `PATCH /api/articles/:articleId/progress` with
 *   a 0.0–1.0 ratio. Written at the same throttle interval. Syncs
 *   across devices. The server-side `progress` value is used as the
 *   initial restore source when `initialProgress` is provided.
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

    const restore = (): void => {
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

      try {
        localStorage.setItem(localKey, String(el.currentTime));
      } catch {
        /* ignore */
      }

      if (articleId && el.duration > 0) {
        const ratio = Math.min(1, el.currentTime / el.duration);
        client
          .PATCH('/api/articles/{articleId}/progress', {
            params: { path: { articleId } },
            body: { progress: ratio },
          })
          .catch(() => {});
      }
    };

    const onEnded = (): void => {
      try {
        localStorage.removeItem(localKey);
      } catch {
        /* ignore */
      }
      if (articleId) {
        client
          .PATCH('/api/articles/{articleId}/progress', {
            params: { path: { articleId } },
            body: { progress: 1 },
          })
          .catch(() => {});
      }
    };

    el.addEventListener('timeupdate', save);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', save);
      el.removeEventListener('ended', onEnded);
      if (el.currentTime > 0 && !el.ended) {
        try {
          localStorage.setItem(localKey, String(el.currentTime));
        } catch {
          /* ignore */
        }
        if (articleId && el.duration > 0) {
          const ratio = Math.min(1, el.currentTime / el.duration);
          client
            .PATCH('/api/articles/{articleId}/progress', {
              params: { path: { articleId } },
              body: { progress: ratio },
            })
            .catch(() => {});
        }
      }
    };
  }, [localKey, articleId, mediaRef]);
};

/* ── Helpers ──────────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

const formatTimestamp = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/* ── Waveform constants ──────────────────────────────────────────── */

const WAVEFORM_BAR_COUNT = 48;
const WAVEFORM_MAX_HEIGHT = 36;

const waveformHeights: number[] = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, i) => {
  const t = i / (WAVEFORM_BAR_COUNT - 1);
  const envelope = Math.sin(t * Math.PI);
  const variation = Math.sin(t * 11.3) * 0.3 + Math.sin(t * 7.1) * 0.2;
  return Math.max(4, Math.round(WAVEFORM_MAX_HEIGHT * envelope * (0.5 + variation)));
});

/* ── AudioPlayer ─────────────────────────────────────────────────── */

type AudioPlayerProps = {
  src: string;
  articleId?: string | null;
  initialProgress?: number | null;
  delay?: number;
};

/**
 * Waveform-integrated audio player. The decorative soundwave doubles
 * as the seek bar — bars to the left of the playhead fill with accent,
 * bars to the right stay muted. A seek handle sits at the boundary.
 */
const AudioPlayer = ({ src, articleId, initialProgress, delay = 0.35 }: AudioPlayerProps): React.ReactElement => {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  usePlaybackProgress(audioRef, src, articleId, initialProgress);

  const progress = duration > 0 ? currentTime / duration : 0;

  const toggle = (): void => {
    const el = audioRef.current;
    if (!el) {
      return;
    }
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  };

  const waveRef = React.useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const ratioFromEvent = (e: { clientX: number }): number => {
    const rect = waveRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const seekTo = (ratio: number): void => {
    const el = audioRef.current;
    if (!el || !duration) {
      return;
    }
    el.currentTime = ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!duration) {
      return;
    }
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = ratioFromEvent(e);
    seekTo(ratio);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const ratio = ratioFromEvent(e);
    setHoverRatio(ratio);
    if (dragging) {
      seekTo(ratio);
    }
  };

  const handlePointerUp = (): void => {
    setDragging(false);
  };

  const activeBar = Math.floor(progress * WAVEFORM_BAR_COUNT);
  const hoverBar = hoverRatio !== null ? Math.floor(hoverRatio * WAVEFORM_BAR_COUNT) : null;
  const isHovering = hoverRatio !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut, delay }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex flex-col items-center gap-5">
        {/* Play / pause */}
        <button
          onClick={toggle}
          className="shrink-0 w-14 h-14 rounded-full bg-accent text-accent-ink flex items-center justify-center
            hover:bg-accent-hover hover:scale-105 active:scale-95
            transition-all duration-normal cursor-pointer shadow-md"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <rect x="3" y="2" width="4" height="14" rx="1.5" />
              <rect x="11" y="2" width="4" height="14" rx="1.5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M4.5 2v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Waveform seek bar */}
        <div className="w-full">
          <div
            ref={waveRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              if (!dragging) {
                setHoverRatio(null);
              }
            }}
            className="relative flex items-center justify-center gap-[2px] h-12 cursor-pointer select-none touch-none"
            role="slider"
            aria-label="Seek"
            aria-valuenow={Math.round(currentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
          >
            {waveformHeights.map((h, i) => {
              const played = i <= activeBar && duration > 0;
              const inHoverZone =
                hoverBar !== null &&
                duration > 0 &&
                (hoverBar >= activeBar ? i > activeBar && i <= hoverBar : i > hoverBar && i <= activeBar);

              return (
                <div
                  key={i}
                  className={`w-[3px] rounded-full transition-colors duration-fast ${
                    played
                      ? inHoverZone
                        ? 'bg-accent/40'
                        : 'bg-accent'
                      : inHoverZone
                        ? 'bg-accent/55'
                        : 'bg-accent/15'
                  }`}
                  style={{ height: h }}
                />
              );
            })}

            {/* Seek handle */}
            {duration > 0 && (
              <div
                className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-accent shadow-sm pointer-events-none
                  ring-2 ring-surface transition-[left,width,height,opacity] duration-fast
                  ${isHovering || dragging ? 'w-4 h-4 opacity-100' : 'w-2.5 h-2.5 opacity-70'}`}
                style={{ left: `${progress * 100}%` }}
              />
            )}

            {/* Hover timestamp tooltip */}
            {isHovering && duration > 0 && (
              <div
                className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded bg-ink text-surface text-xs font-mono tracking-wide pointer-events-none"
                style={{ left: `${hoverRatio * 100}%` }}
              >
                {formatTimestamp(hoverRatio * duration)}
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="flex justify-between text-xs font-mono tracking-wide text-ink-faint mt-1">
            <span>{formatTimestamp(currentTime)}</span>
            <span>{duration > 0 ? formatTimestamp(duration) : '—'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── VideoPlayer ─────────────────────────────────────────────────── */

type VideoPlayerProps = {
  src: string;
  articleId?: string | null;
  initialProgress?: number | null;
  delay?: number;
};

const VideoPlayer = ({ src, articleId, initialProgress, delay = 0.35 }: VideoPlayerProps): React.ReactElement => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  usePlaybackProgress(videoRef, src, articleId, initialProgress);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut, delay }}
      className="rounded-lg overflow-hidden bg-surface-sunken"
    >
      <video ref={videoRef} controls src={src} className="w-full" />
    </motion.div>
  );
};

/* ── MediaPlayer (selector) ──────────────────────────────────────── */

type MediaPlayerProps = {
  mediaUrl: string;
  mediaType?: string | null;
  articleId?: string | null;
  initialProgress?: number | null;
  delay?: number;
};

const MediaPlayer = ({
  mediaUrl,
  mediaType,
  articleId,
  initialProgress,
  delay = 0.35,
}: MediaPlayerProps): React.ReactElement =>
  mediaType?.startsWith('video/') ? (
    <VideoPlayer src={mediaUrl} articleId={articleId} initialProgress={initialProgress} delay={delay} />
  ) : (
    <AudioPlayer src={mediaUrl} articleId={articleId} initialProgress={initialProgress} delay={delay} />
  );

/* ── Exports ─────────────────────────────────────────────────────── */

export type { AudioPlayerProps, VideoPlayerProps, MediaPlayerProps };
export { AudioPlayer, VideoPlayer, MediaPlayer, waveformHeights, WAVEFORM_BAR_COUNT };
