import * as React from "react";
import { motion } from "motion/react";
import { MagazinePage, useMagazineNav } from "./magazine.layout.tsx";

/* ── Types ────────────────────────────────────────────────────────── */

type CoverArticle = {
  title: string;
  sourceName: string;
  consumptionTimeSeconds?: number | null;
  imageUrl?: string | null;
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
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

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
  const handleStart = (): void => {
    if (nav) nav.onPageChange(nav.page + 1);
  };

  return (
  <MagazinePage className="relative justify-between min-h-screen !p-0 overflow-hidden">
    {/* ── Lead image as full-bleed background ─────────────────────── */}
    {lead.imageUrl && (
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: easeOut }}
        className="absolute inset-0 z-0"
      >
        <img
          src={lead.imageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Gradient overlays for text legibility */}
        <div className="absolute inset-0 bg-linear-to-b from-ink/70 via-ink/30 to-ink/80" />
      </motion.div>
    )}

    {/* ── Content layer ───────────────────────────────────────────── */}
    <div className={`relative z-10 flex flex-col justify-between min-h-screen px-6 py-12 md:px-12 lg:px-20 ${lead.imageUrl ? "text-white" : ""}`}>

      {/* Top bar: edition branding */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
        className={`flex items-baseline justify-between pb-4 mb-8 ${lead.imageUrl ? "border-b border-white/20" : "border-b border-border"}`}
      >
        <div className="flex items-baseline gap-3">
          <span className={`text-xs font-mono tracking-wide uppercase ${lead.imageUrl ? "text-white/90" : "text-accent"}`}>
            Editions
          </span>
          <span className={`text-xs ${lead.imageUrl ? "text-white/40" : "text-ink-faint"}`}>/</span>
          <span className={`text-xs tracking-wide uppercase ${lead.imageUrl ? "text-white/70" : "text-ink-tertiary"}`}>
            {editionTitle}
          </span>
        </div>
        <span className={`text-xs font-mono tracking-wide ${lead.imageUrl ? "text-white/60" : "text-ink-tertiary"}`}>
          {formatCoverDate(date)}
        </span>
      </motion.div>

      {/* Lead story — the dominant visual element */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut, delay: 0.5 }}
        className="flex-1 flex flex-col justify-center max-w-wide"
      >
        <div className={`text-xs font-mono tracking-wide mb-4 ${lead.imageUrl ? "text-white/70" : "text-accent"}`}>
          {lead.sourceName}
        </div>
        <h1 className={`font-serif text-5xl md:text-[4rem] lg:text-[5rem] leading-none tracking-tight mb-6 ${lead.imageUrl ? "text-white" : "text-ink"}`}>
          {lead.title}
        </h1>
        {lead.consumptionTimeSeconds && (
          <div className={`text-sm ${lead.imageUrl ? "text-white/60" : "text-ink-tertiary"}`}>
            {Math.round(lead.consumptionTimeSeconds / 60)} min read
          </div>
        )}

        {/* Start reading CTA */}
        <button
          onClick={handleStart}
          className={`mt-8 inline-flex items-center gap-2 text-sm font-medium tracking-wide px-6 py-3 rounded-full transition-all duration-normal self-start cursor-pointer
            ${lead.imageUrl
              ? "bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm border border-white/20"
              : "bg-accent text-accent-ink hover:bg-accent-hover"
            }`}
        >
          Start reading
          <span aria-hidden="true">→</span>
        </button>
      </motion.div>

      {/* Bottom: highlight cards + edition meta */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.7 }}
        className={`pt-6 mt-8 ${lead.imageUrl ? "border-t border-white/20" : "border-t border-border"}`}
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          {/* Highlight teasers with thumbnails */}
          {highlights.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
              {highlights.map((h, i) => (
                <div key={i} className="flex gap-3 max-w-80">
                  {h.imageUrl && (
                    <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-white/10">
                      <img src={h.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className={`text-xs font-mono tracking-wide mb-1 ${lead.imageUrl ? "text-white/50" : "text-ink-faint"}`}>
                      {h.sourceName}
                    </div>
                    <div className={`font-serif text-sm leading-snug line-clamp-2 ${lead.imageUrl ? "text-white/90" : "text-ink"}`}>
                      {h.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edition stats */}
          <div className={`flex gap-6 text-xs font-mono tracking-wide shrink-0 ${lead.imageUrl ? "text-white/50" : "text-ink-tertiary"}`}>
            <span>{articleCount} articles</span>
            <span>{focusCount} sections</span>
            <span>{totalReadingMinutes} min</span>
          </div>
        </div>
      </motion.div>
    </div>
  </MagazinePage>
  );
};

/* ── Exports ──────────────────────────────────────────────────────── */

export type { MagazineCoverProps, CoverArticle };
export { MagazineCover };
