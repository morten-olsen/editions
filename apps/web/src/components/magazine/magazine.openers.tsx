/**
 * Magazine Paged Article — Openers
 *
 * Article opener variants (standard, feature, minimal) rendered on the
 * first page of a paged article, plus the shared byline row.
 */

import * as React from 'react';
import { motion } from 'motion/react';

import type { ArticleOpener } from './magazine.paginate.ts';

/* ── Constants ────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

/* ── Article style (visual variety) ───────────────────────────── */

type ArticleStyle = 'standard' | 'feature' | 'minimal';

/* ── Article opener variants ──────────────────────────────────── */

type OpenerProps = {
  opener: ArticleOpener;
  style: ArticleStyle;
  imageHeight?: number;
};

const ArticlePageOpener = ({ opener, style, imageHeight }: OpenerProps): React.ReactElement => {
  if (style === 'feature') {
    return <FeatureOpener opener={opener} imageHeight={imageHeight} />;
  }
  if (style === 'minimal') {
    return <MinimalOpener opener={opener} />;
  }
  return <StandardOpener opener={opener} imageHeight={imageHeight} />;
};

/** Standard opener: source → title → byline → image → divider */
const StandardOpener = ({
  opener,
  imageHeight,
}: {
  opener: ArticleOpener;
  imageHeight?: number;
}): React.ReactElement => (
  <div className="mb-4">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="text-xs font-mono tracking-wide text-accent mb-2"
    >
      {opener.sourceName}
    </motion.div>
    <motion.h2
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
      className="font-serif text-2xl md:text-3xl tracking-tight leading-tight text-ink mb-2"
    >
      {opener.title}
    </motion.h2>
    <OpenerByline opener={opener} delay={0.2} />
    {opener.imageUrl && imageHeight && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.15 }}
        className="rounded-lg overflow-hidden bg-surface-sunken my-3"
        style={{ height: imageHeight }}
      >
        <img src={opener.imageUrl} alt="" className="w-full h-full object-cover" />
      </motion.div>
    )}
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.5, ease: easeOut, delay: 0.25 }}
      className="w-12 h-px bg-border-strong origin-left mb-3"
    />
  </div>
);

/** Feature opener: large title with accent treatment, image below */
const FeatureOpener = ({
  opener,
  imageHeight,
}: {
  opener: ArticleOpener;
  imageHeight?: number;
}): React.ReactElement => (
  <div className="mb-4">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="text-xs font-mono tracking-widest text-accent uppercase mb-3"
    >
      {opener.sourceName}
    </motion.div>
    <motion.h2
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOut, delay: 0.1 }}
      className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight leading-none text-ink mb-3"
    >
      {opener.title}
    </motion.h2>
    {opener.summary && (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.2 }}
        className="font-serif text-lg leading-relaxed text-ink-secondary mb-3 max-w-prose"
      >
        {opener.summary}
      </motion.p>
    )}
    <OpenerByline opener={opener} delay={0.25} />
    {opener.imageUrl && imageHeight && (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}
        className="rounded-lg overflow-hidden bg-surface-sunken my-3"
        style={{ height: imageHeight }}
      >
        <img src={opener.imageUrl} alt="" className="w-full h-full object-cover" />
      </motion.div>
    )}
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
      className="w-16 h-px bg-accent origin-left mb-3"
    />
  </div>
);

/** Minimal opener: subtle section rule, compact typography */
const MinimalOpener = ({ opener }: { opener: ArticleOpener }): React.ReactElement => (
  <div className="mb-4">
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="w-8 h-px bg-border-strong origin-left mb-3"
    />
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: easeOut, delay: 0.1 }}
      className="text-xs font-mono tracking-wide text-ink-tertiary mb-2"
    >
      {opener.sourceName}
    </motion.div>
    <motion.h2
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut, delay: 0.15 }}
      className="font-serif text-xl md:text-2xl tracking-tight leading-snug text-ink mb-2"
    >
      {opener.title}
    </motion.h2>
    <OpenerByline opener={opener} delay={0.2} />
  </div>
);

/** Shared byline row */
const OpenerByline = ({ opener, delay }: { opener: ArticleOpener; delay: number }): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3, ease: easeOut, delay }}
    className="flex items-center gap-3 text-xs text-ink-tertiary mb-2"
  >
    {opener.author && <span>By {opener.author}</span>}
    {opener.consumptionTimeSeconds && (
      <>
        {opener.author && <span className="text-ink-faint">·</span>}
        <span>
          {Math.round(opener.consumptionTimeSeconds / 60)} min {opener.sourceType === 'podcast' ? 'listen' : 'read'}
        </span>
      </>
    )}
  </motion.div>
);

/* ── Exports ──────────────────────────────────────────────────── */

export type { ArticleStyle, OpenerProps };
export { ArticlePageOpener };
