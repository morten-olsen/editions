import * as React from "react";
import { motion } from "motion/react";
import { MagazinePage } from "./magazine.layout.tsx";

/* ── Types ────────────────────────────────────────────────────────── */

type TocArticle = {
  title: string;
  sourceName: string;
  consumptionTimeSeconds?: number | null;
};

type TocSection = {
  focusName: string;
  articles: TocArticle[];
  /** The page number where this section starts */
  startPage: number;
};

type MagazineTocProps = {
  editionTitle: string;
  sections: TocSection[];
  onNavigate?: (page: number) => void;
};

/* ── Helpers ──────────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

const formatMin = (seconds: number): string => {
  const m = Math.round(seconds / 60);
  return m < 1 ? "< 1m" : `${m}m`;
};

/* ── MagazineToc ──────────────────────────────────────────────────── */

const MagazineToc = ({
  editionTitle,
  sections,
  onNavigate,
}: MagazineTocProps): React.ReactElement => (
  <MagazinePage>
    <div className="max-w-wide mx-auto w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="mb-12"
      >
        <div className="text-xs font-mono tracking-wide text-accent uppercase mb-2">
          Contents
        </div>
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          {editionTitle}
        </h2>
      </motion.div>

      {/* Section list */}
      <div className="grid gap-10 md:gap-12">
        {sections.map((section, sIdx) => (
          <motion.div
            key={section.focusName}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.1 + sIdx * 0.08 }}
          >
            {/* Section heading row */}
            <div className="flex items-baseline gap-4 mb-4 border-b border-border pb-3">
              <span className="text-2xl font-mono text-accent leading-none">
                {String(sIdx + 1).padStart(2, "0")}
              </span>
              <h3 className="font-serif text-xl tracking-tight text-ink">
                {section.focusName}
              </h3>
              <span className="ml-auto text-xs font-mono text-ink-faint">
                p. {String(section.startPage).padStart(2, "0")}
              </span>
            </div>

            {/* Article list */}
            <div className="grid gap-2 pl-10 md:pl-12">
              {section.articles.map((article, aIdx) => (
                <button
                  key={aIdx}
                  onClick={() => onNavigate?.(section.startPage + aIdx + 1)}
                  className="group flex items-baseline gap-3 text-left transition-colors duration-fast hover:text-accent"
                >
                  <span className="font-serif text-sm leading-snug text-ink group-hover:text-accent transition-colors duration-fast">
                    {article.title}
                  </span>
                  <span className="flex-1 border-b border-dotted border-ink-faint/40 min-w-8 translate-y-[-3px]" />
                  <span className="text-xs font-mono text-ink-faint shrink-0">
                    {article.sourceName}
                    {article.consumptionTimeSeconds
                      ? ` · ${formatMin(article.consumptionTimeSeconds)}`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </MagazinePage>
);

/* ── Exports ──────────────────────────────────────────────────────── */

export type { MagazineTocProps, TocSection, TocArticle };
export { MagazineToc };
