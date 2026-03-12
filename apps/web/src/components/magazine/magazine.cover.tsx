import * as React from 'react';
import { motion } from 'motion/react';

import { MagazinePage, useMagazineNav } from './magazine.layout.tsx';

/* ── Types ────────────────────────────────────────────────────────── */

type CoverArticle = {
  title: string;
  sourceName: string;
  consumptionTimeSeconds?: number | null;
  imageUrl?: string | null;
  sourceType?: string | null;
};

type MagazineCoverProps = {
  editionTitle: string;
  date: string;
  totalReadingMinutes: number;
  articleCount: number;
  focusCount: number;
  /** The lead story — displayed largest */
  lead: CoverArticle;
  /** 2-3 secondary highlights */
  highlights?: CoverArticle[];
};

/* ── Helpers ──────────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

const formatCoverDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/* ── Cover top bar ────────────────────────────────────────────────── */

type CoverTopBarProps = {
  editionTitle: string;
  date: string;
  hasImage: boolean;
};

const CoverTopBar = ({ editionTitle, date, hasImage }: CoverTopBarProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
    className={`flex items-baseline justify-between pb-4 mb-8 ${hasImage ? 'border-b border-white/20' : 'border-b border-border'}`}
  >
    <div className="flex items-baseline gap-3">
      <span className={`text-xs font-mono tracking-wide uppercase ${hasImage ? 'text-white/90' : 'text-accent'}`}>
        Editions
      </span>
      <span className={`text-xs ${hasImage ? 'text-white/40' : 'text-ink-faint'}`}>/</span>
      <span className={`text-xs tracking-wide uppercase ${hasImage ? 'text-white/70' : 'text-ink-tertiary'}`}>
        {editionTitle}
      </span>
    </div>
    <span className={`text-xs font-mono tracking-wide ${hasImage ? 'text-white/60' : 'text-ink-tertiary'}`}>
      {formatCoverDate(date)}
    </span>
  </motion.div>
);

/* ── Cover lead story ────────────────────────────────────────────── */

type CoverLeadProps = {
  lead: CoverArticle;
  hasImage: boolean;
  onStart: () => void;
};

const CoverLead = ({ lead, hasImage, onStart }: CoverLeadProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: easeOut, delay: 0.5 }}
    className="flex-1 flex flex-col justify-center max-w-wide"
  >
    <div className={`text-xs font-mono tracking-wide mb-4 ${hasImage ? 'text-white/70' : 'text-accent'}`}>
      {lead.sourceName}
    </div>
    <h1
      className={`font-serif text-5xl md:text-[4rem] lg:text-[5rem] leading-none tracking-tight mb-6 ${hasImage ? 'text-white' : 'text-ink'}`}
    >
      {lead.title}
    </h1>
    {lead.consumptionTimeSeconds && (
      <div className={`text-sm ${hasImage ? 'text-white/60' : 'text-ink-tertiary'}`}>
        {Math.round(lead.consumptionTimeSeconds / 60)} min {lead.sourceType === 'podcast' ? 'listen' : 'read'}
      </div>
    )}
    <button
      onClick={onStart}
      className={`mt-8 inline-flex items-center gap-2 text-sm font-medium tracking-wide px-6 py-3 rounded-full transition-all duration-normal self-start cursor-pointer
      ${hasImage ? 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm border border-white/20' : 'bg-accent text-accent-ink hover:bg-accent-hover'}`}
    >
      {lead.sourceType === 'podcast' ? 'Start listening' : 'Start reading'}
      <span aria-hidden="true">→</span>
    </button>
  </motion.div>
);

/* ── Cover bottom bar ────────────────────────────────────────────── */

type CoverBottomProps = {
  highlights: CoverArticle[];
  articleCount: number;
  focusCount: number;
  totalReadingMinutes: number;
  hasImage: boolean;
};

const CoverBottom = ({
  highlights,
  articleCount,
  focusCount,
  totalReadingMinutes,
  hasImage,
}: CoverBottomProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: easeOut, delay: 0.7 }}
    className={`pt-6 mt-8 ${hasImage ? 'border-t border-white/20' : 'border-t border-border'}`}
  >
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
      {highlights.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
          {highlights.map((h, i) => (
            <CoverHighlight key={i} highlight={h} hasImage={hasImage} />
          ))}
        </div>
      )}
      <div
        className={`flex gap-6 text-xs font-mono tracking-wide shrink-0 ${hasImage ? 'text-white/50' : 'text-ink-tertiary'}`}
      >
        <span>{articleCount} articles</span>
        <span>{focusCount} sections</span>
        <span>{totalReadingMinutes} min</span>
      </div>
    </div>
  </motion.div>
);

/* ── Cover highlight teaser ──────────────────────────────────────── */

const CoverHighlight = ({
  highlight,
  hasImage,
}: {
  highlight: CoverArticle;
  hasImage: boolean;
}): React.ReactElement => (
  <div className="flex gap-3 max-w-80">
    {highlight.imageUrl && (
      <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-white/10">
        <img src={highlight.imageUrl} alt="" className="w-full h-full object-cover" />
      </div>
    )}
    <div className="min-w-0">
      <div className={`text-xs font-mono tracking-wide mb-1 ${hasImage ? 'text-white/50' : 'text-ink-faint'}`}>
        {highlight.sourceName}
      </div>
      <div className={`font-serif text-sm leading-snug line-clamp-2 ${hasImage ? 'text-white/90' : 'text-ink'}`}>
        {highlight.title}
      </div>
    </div>
  </div>
);

/* ── MagazineCover ────────────────────────────────────────────────── */

const MagazineCover = ({
  editionTitle,
  date,
  totalReadingMinutes,
  articleCount,
  focusCount,
  lead,
  highlights = [],
}: MagazineCoverProps): React.ReactElement => {
  const nav = useMagazineNav();
  const hasImage = !!lead.imageUrl;
  const handleStart = (): void => {
    if (nav) {
      nav.onPageChange(nav.page + 1);
    }
  };

  return (
    <MagazinePage className="relative justify-between min-h-screen !p-0 overflow-hidden">
      {lead.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: easeOut }}
          className="absolute inset-0 z-0"
        >
          <img src={lead.imageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/30 to-black/80" />
        </motion.div>
      )}
      <div
        className={`relative z-10 flex flex-col justify-between min-h-screen px-6 py-12 md:px-12 lg:px-20 ${hasImage ? 'text-white' : ''}`}
      >
        <CoverTopBar editionTitle={editionTitle} date={date} hasImage={hasImage} />
        <CoverLead lead={lead} hasImage={hasImage} onStart={handleStart} />
        <CoverBottom
          highlights={highlights}
          articleCount={articleCount}
          focusCount={focusCount}
          totalReadingMinutes={totalReadingMinutes}
          hasImage={hasImage}
        />
      </div>
    </MagazinePage>
  );
};

/* ── Exports ──────────────────────────────────────────────────────── */

export type { MagazineCoverProps, CoverArticle };
export { MagazineCover };
