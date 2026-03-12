import * as React from 'react';
import { motion } from 'motion/react';

import { MagazinePage } from './magazine.layout.tsx';

/* ── Types ────────────────────────────────────────────────────────── */

type MagazineSectionProps = {
  focusName: string;
  index: number;
  articleCount: number;
  totalReadingMinutes: number;
};

/* ── MagazineSection ──────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

const MagazineSection = ({
  focusName,
  index,
  articleCount,
  totalReadingMinutes,
}: MagazineSectionProps): React.ReactElement => (
  <MagazinePage className="items-center text-center">
    <div className="max-w-content mx-auto">
      {/* Large section number */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="text-[8rem] md:text-[12rem] font-mono leading-none text-accent/15 select-none mb-[-1rem]"
      >
        {String(index + 1).padStart(2, '0')}
      </motion.div>

      {/* Section name */}
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.15 }}
        className="font-serif text-4xl md:text-5xl tracking-tight text-ink mb-4"
      >
        {focusName}
      </motion.h2>

      {/* Meta line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.3 }}
        className="text-xs font-mono tracking-wide text-ink-tertiary"
      >
        {articleCount} {articleCount === 1 ? 'article' : 'articles'} · {totalReadingMinutes} min
      </motion.div>

      {/* Decorative rule */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: easeOut, delay: 0.2 }}
        className="w-16 h-px bg-accent mx-auto mt-8"
      />
    </div>
  </MagazinePage>
);

/* ── Exports ──────────────────────────────────────────────────────── */

export type { MagazineSectionProps };
export { MagazineSection };
