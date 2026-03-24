import * as React from 'react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { Components } from 'react-markdown';

import { VoteControls } from '../vote-controls.tsx';
import type { VoteValue } from '../vote-controls.tsx';
import { ArticleLink } from './article-link.tsx';

/* ── Constants ────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;
const remarkPlugins = [remarkGfm];

/* ── Formatting helpers ───────────────────────────────────────── */

const formatArticleDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatReadingTime = (seconds: number, sourceType?: string | null): string => {
  const min = Math.round(seconds / 60);
  if (min < 1) {
    return '< 1 min';
  }
  const suffix = sourceType === 'podcast' ? 'listen' : 'read';
  return `${min} min ${suffix}`;
};

/* ── Root ─────────────────────────────────────────────────────── */

type RootProps = {
  children: React.ReactNode;
  className?: string;
};

const Root = ({ children, className = '' }: RootProps): React.ReactElement => (
  <div className={className}>{children}</div>
);

/* ── Source badge ─────────────────────────────────────────────── */

type SourceProps = {
  name: string;
  publishedAt?: string | null;
  delay?: number;
  centered?: boolean;
  className?: string;
};

const Source = ({
  name,
  publishedAt,
  delay = 0,
  centered = false,
  className = '',
}: SourceProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, ease: easeOut, delay }}
    className={`flex items-center gap-2 text-xs font-mono tracking-wide text-accent mb-4 ${centered ? 'justify-center' : ''} ${className}`}
  >
    <span>{name}</span>
    {publishedAt && (
      <>
        <span className="text-ink-faint">·</span>
        <span className="text-ink-tertiary">{formatArticleDate(publishedAt)}</span>
      </>
    )}
  </motion.div>
);

/* ── Title ────────────────────────────────────────────────────── */

type TitleProps = {
  children: React.ReactNode;
  delay?: number;
  centered?: boolean;
  size?: 'base' | 'lg' | 'xl';
  className?: string;
};

const titleSizeClasses = {
  base: 'text-2xl md:text-3xl',
  lg: 'text-3xl md:text-4xl',
  xl: 'text-3xl md:text-4xl lg:text-5xl',
} as const;

const Title = ({
  children,
  delay = 0.1,
  centered = false,
  size = 'lg',
  className = '',
}: TitleProps): React.ReactElement => (
  <motion.h2
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: easeOut, delay }}
    className={`font-serif ${titleSizeClasses[size]} tracking-tight leading-tight text-ink mb-6 ${centered ? 'text-center' : ''} ${className}`}
  >
    {children}
  </motion.h2>
);

/* ── Divider ──────────────────────────────────────────────────── */

type DividerProps = {
  delay?: number;
  className?: string;
};

const Divider = ({ delay = 0.2, className = '' }: DividerProps): React.ReactElement => (
  <motion.div
    initial={{ scaleX: 0 }}
    animate={{ scaleX: 1 }}
    transition={{ duration: 0.5, ease: easeOut, delay }}
    className={`w-12 h-px bg-border-strong mx-auto mb-8 ${className}`}
  />
);

/* ── Image ────────────────────────────────────────────────────── */

type ImageProps = {
  src: string;
  delay?: number;
  aspect?: 'video' | 'photo' | 'square';
  className?: string;
};

const imageAspectClasses = {
  video: 'aspect-[16/9]',
  photo: 'aspect-[4/3]',
  square: 'aspect-square',
} as const;

const Image = ({ src, delay = 0.25, aspect = 'video', className = '' }: ImageProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0, scale: aspect === 'square' ? 0.95 : 1 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: aspect === 'square' ? 0.6 : 0.5, ease: easeOut, delay }}
    className={`${imageAspectClasses[aspect]} rounded-lg overflow-hidden bg-surface-sunken mb-8 ${className}`}
  >
    <img src={src} alt="" className="w-full h-full object-cover" />
  </motion.div>
);

/* ── Summary ──────────────────────────────────────────────────── */

type SummaryProps = {
  children?: string | null;
  hasContent?: boolean;
  delay?: number;
  centered?: boolean;
  size?: 'base' | 'lg';
  className?: string;
};

const Summary = ({
  children,
  hasContent = false,
  delay = 0.3,
  centered = false,
  size = 'lg',
  className = '',
}: SummaryProps): React.ReactElement | null => {
  if (!children || hasContent) {
    return null;
  }
  return (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut, delay }}
      className={`font-serif ${size === 'lg' ? 'text-lg' : 'text-base'} leading-relaxed text-ink-secondary mb-6 ${centered ? 'text-center' : ''} ${className}`}
    >
      {children}
    </motion.p>
  );
};

/* ── Byline ───────────────────────────────────────────────────── */

type BylineProps = {
  author?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  sourceType?: string | null;
  centered?: boolean;
  delay?: number;
};

const Byline = ({
  author,
  publishedAt,
  consumptionTimeSeconds,
  sourceType,
  centered = false,
  delay = 0.35,
}: BylineProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, ease: easeOut, delay }}
    className={`flex items-center gap-3 text-xs text-ink-tertiary ${centered ? 'justify-center' : ''}`}
  >
    {author && <span>By {author}</span>}
    {publishedAt && (
      <>
        {author && <span className="text-ink-faint">·</span>}
        <span>{formatArticleDate(publishedAt)}</span>
      </>
    )}
    {consumptionTimeSeconds && (
      <>
        {(author || publishedAt) && <span className="text-ink-faint">·</span>}
        <span>{formatReadingTime(consumptionTimeSeconds, sourceType)}</span>
      </>
    )}
  </motion.div>
);

/* ── Body ─────────────────────────────────────────────────────── */

type BodyProps = {
  content: string;
  onSaveUrl?: ((url: string) => Promise<void>) | null;
  delay?: number;
};

const buildMarkdownComponents = (onSaveUrl: (url: string) => Promise<void>): Components => ({
  a: ({ href, children, ...rest }) => (
    <ArticleLink href={href} onSaveUrl={onSaveUrl} {...rest}>
      {children}
    </ArticleLink>
  ),
});

const Body = ({ content, onSaveUrl, delay = 0.4 }: BodyProps): React.ReactElement => {
  const components = React.useMemo(
    () => (onSaveUrl ? buildMarkdownComponents(onSaveUrl) : undefined),
    [onSaveUrl],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut, delay }}
    >
      <div className="w-px h-8 bg-border-strong mx-auto mb-10" />
      <div
        className="prose prose-neutral max-w-none font-serif text-lg leading-relaxed text-ink
          prose-headings:font-serif prose-headings:tracking-tight prose-headings:text-ink
          prose-p:text-ink-secondary prose-p:leading-relaxed
          prose-a:text-accent prose-a:no-underline hover:prose-a:underline
          prose-strong:text-ink prose-strong:font-medium
          prose-blockquote:border-accent prose-blockquote:text-ink-secondary prose-blockquote:font-serif prose-blockquote:text-lg prose-blockquote:not-italic
          prose-figcaption:text-ink-tertiary prose-figcaption:text-xs
          prose-img:rounded-lg
          first-of-type:prose-p:text-lg first-of-type:prose-p:text-ink first-of-type:prose-p:leading-relaxed
          [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:text-5xl [&>p:first-of-type]:first-letter:font-serif [&>p:first-of-type]:first-letter:font-bold [&>p:first-of-type]:first-letter:leading-none [&>p:first-of-type]:first-letter:mr-2 [&>p:first-of-type]:first-letter:mt-1 [&>p:first-of-type]:first-letter:text-ink"
      >
        <Markdown remarkPlugins={remarkPlugins} components={components}>{content}</Markdown>
      </div>
    </motion.div>
  );
};

/* ── VoteRow ──────────────────────────────────────────────────── */

type VoteRowProps = {
  vote: VoteValue | null;
  onVote: (value: VoteValue) => void;
  label?: string;
  delay?: number;
};

const VoteRow = ({ vote, onVote, label = 'Quality', delay = 0.5 }: VoteRowProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, ease: easeOut, delay }}
    className="flex items-center justify-center pt-6 mt-6 border-t border-border"
  >
    <VoteControls value={vote} onVote={onVote} label={label} />
  </motion.div>
);

/* ── Footer ───────────────────────────────────────────────────── */

type FooterProps = {
  children: React.ReactNode;
  delay?: number;
};

const Footer = ({ children, delay = 0.5 }: FooterProps): React.ReactElement => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: easeOut, delay }}>
    {children}
  </motion.div>
);

/* ── Exports ──────────────────────────────────────────────────── */

export type {
  RootProps,
  SourceProps,
  TitleProps,
  DividerProps,
  ImageProps,
  SummaryProps,
  BylineProps,
  BodyProps,
  VoteRowProps,
  FooterProps,
  VoteValue,
};

export {
  Root,
  Source,
  Title,
  Divider,
  Image,
  Summary,
  Byline,
  Body,
  VoteRow,
  Footer,
  easeOut,
  formatArticleDate,
  formatReadingTime,
};
