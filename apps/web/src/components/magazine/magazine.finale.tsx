import * as React from "react";
import { motion } from "motion/react";
import { MagazinePage } from "./magazine.layout.tsx";

/* ── Types ────────────────────────────────────────────────────────── */

type MagazineFinaleProps = {
  articleCount: number;
  totalReadingMinutes: number;
  editionTitle: string;
  /** Called when the reader marks the edition as done */
  onMarkDone?: () => void;
};

/* ── MagazineFinale ───────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

const MagazineFinale = ({
  articleCount,
  totalReadingMinutes,
  editionTitle,
  onMarkDone,
}: MagazineFinaleProps): React.ReactElement => (
  <MagazinePage className="items-center text-center">
    <div className="max-w-prose mx-auto">
      {/* Decorative end mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="text-6xl text-accent/20 mb-8 select-none"
      >
        ~
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
        className="font-serif text-3xl tracking-tight text-ink mb-3"
      >
        You're all caught up
      </motion.h2>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.25 }}
        className="text-sm text-ink-tertiary mb-10"
      >
        {articleCount} articles · {totalReadingMinutes} minutes well spent
      </motion.div>

      {/* Mark done button */}
      {onMarkDone && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.4 }}
          onClick={onMarkDone}
          className="inline-flex items-center gap-2 text-sm font-medium tracking-wide px-6 py-3 rounded-full
            bg-accent text-accent-ink hover:bg-accent-hover transition-colors duration-normal cursor-pointer"
        >
          Mark as read
        </motion.button>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut, delay: onMarkDone ? 0.55 : 0.4 }}
        className="text-xs font-mono tracking-wide text-ink-faint mt-8"
      >
        End of {editionTitle}
      </motion.div>
    </div>
  </MagazinePage>
);

/* ── Exports ──────────────────────────────────────────────────────── */

export type { MagazineFinaleProps };
export { MagazineFinale };
