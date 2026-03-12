import * as React from 'react';
import { motion } from 'motion/react';

import { usePlaybackProgress } from './media-player.progress.ts';

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

/* ── Play/pause button ────────────────────────────────────────────── */

const PlayPauseButton = ({ playing, onToggle }: { playing: boolean; onToggle: () => void }): React.ReactElement => (
  <button
    onClick={onToggle}
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
);

/* ── Waveform bar color ──────────────────────────────────────────── */

const barClass = (played: boolean, inHoverZone: boolean): string => {
  if (played) {
    return inHoverZone ? 'bg-accent/40' : 'bg-accent';
  }
  return inHoverZone ? 'bg-accent/55' : 'bg-accent/15';
};

/* ── Waveform seek bar ───────────────────────────────────────────── */

type WaveformSeekProps = {
  waveRef: React.RefObject<HTMLDivElement | null>;
  progress: number;
  duration: number;
  currentTime: number;
  hoverRatio: number | null;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
};

const WaveformSeek = ({
  waveRef,
  progress,
  duration,
  currentTime,
  hoverRatio,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}: WaveformSeekProps): React.ReactElement => {
  const activeBar = Math.floor(progress * WAVEFORM_BAR_COUNT);
  const hoverBar = hoverRatio !== null ? Math.floor(hoverRatio * WAVEFORM_BAR_COUNT) : null;
  const isHovering = hoverRatio !== null;

  return (
    <div className="w-full">
      <div
        ref={waveRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
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
              className={`w-[3px] rounded-full transition-colors duration-fast ${barClass(played, inHoverZone)}`}
              style={{ height: h }}
            />
          );
        })}
        {duration > 0 && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-accent shadow-sm pointer-events-none ring-2 ring-surface transition-[left,width,height,opacity] duration-fast ${isHovering || dragging ? 'w-4 h-4 opacity-100' : 'w-2.5 h-2.5 opacity-70'}`}
            style={{ left: `${progress * 100}%` }}
          />
        )}
        {isHovering && duration > 0 && (
          <div
            className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded bg-ink text-surface text-xs font-mono tracking-wide pointer-events-none"
            style={{ left: `${hoverRatio * 100}%` }}
          >
            {formatTimestamp(hoverRatio * duration)}
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs font-mono tracking-wide text-ink-faint mt-1">
        <span>{formatTimestamp(currentTime)}</span>
        <span>{duration > 0 ? formatTimestamp(duration) : '—'}</span>
      </div>
    </div>
  );
};

/* ── Audio player state hook ──────────────────────────────────────── */

type AudioPlayerState = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  waveRef: React.RefObject<HTMLDivElement | null>;
  playing: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  hoverRatio: number | null;
  dragging: boolean;
  toggle: () => void;
  setPlaying: (v: boolean) => void;
  setCurrentTime: (v: number) => void;
  setDuration: (v: number) => void;
  setHoverRatio: (v: number | null) => void;
  setDragging: (v: boolean) => void;
  ratioFromEvent: (e: { clientX: number }) => number;
  seekTo: (ratio: number) => void;
};

const useAudioPlayerState = (
  src: string,
  articleId?: string | null,
  initialProgress?: number | null,
): AudioPlayerState => {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const waveRef = React.useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [hoverRatio, setHoverRatio] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);

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

  return {
    audioRef,
    waveRef,
    playing,
    currentTime,
    duration,
    progress,
    hoverRatio,
    dragging,
    toggle,
    setPlaying,
    setCurrentTime,
    setDuration,
    setHoverRatio,
    setDragging,
    ratioFromEvent,
    seekTo,
  };
};

/* ── Audio player seek handlers ──────────────────────────────────── */

type SeekHandlers = {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
};

const buildSeekHandlers = (state: AudioPlayerState): SeekHandlers => ({
  onPointerDown: (e) => {
    if (!state.duration) {
      return;
    }
    state.setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    state.seekTo(state.ratioFromEvent(e));
  },
  onPointerMove: (e) => {
    const ratio = state.ratioFromEvent(e);
    state.setHoverRatio(ratio);
    if (state.dragging) {
      state.seekTo(ratio);
    }
  },
  onPointerUp: () => state.setDragging(false),
  onPointerLeave: () => {
    if (!state.dragging) {
      state.setHoverRatio(null);
    }
  },
});

/* ── AudioPlayer ─────────────────────────────────────────────────── */

const AudioPlayer = ({ src, articleId, initialProgress, delay = 0.35 }: AudioPlayerProps): React.ReactElement => {
  const state = useAudioPlayerState(src, articleId, initialProgress);
  const handlers = buildSeekHandlers(state);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut, delay }}
    >
      <audio
        ref={state.audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => state.setDuration(state.audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => state.setCurrentTime(state.audioRef.current?.currentTime ?? 0)}
        onPlay={() => state.setPlaying(true)}
        onPause={() => state.setPlaying(false)}
        onEnded={() => state.setPlaying(false)}
      />
      <div className="flex flex-col items-center gap-5">
        <PlayPauseButton playing={state.playing} onToggle={state.toggle} />
        <WaveformSeek
          waveRef={state.waveRef}
          progress={state.progress}
          duration={state.duration}
          currentTime={state.currentTime}
          hoverRatio={state.hoverRatio}
          dragging={state.dragging}
          {...handlers}
        />
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
