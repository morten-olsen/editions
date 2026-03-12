import * as React from 'react';
import { motion, AnimatePresence, type Transition, type Variants } from 'motion/react';

/* ── Shared transitions (match design tokens) ────────────────────── */

const ease = [0.25, 0.1, 0.25, 1] as const;
const easeOut = [0, 0, 0.15, 1] as const;

const transitions = {
  fast: { duration: 0.12, ease } satisfies Transition,
  normal: { duration: 0.2, ease } satisfies Transition,
  slow: { duration: 0.35, ease } satisfies Transition,
  slower: { duration: 0.5, ease } satisfies Transition,
  enter: { duration: 0.35, ease: easeOut } satisfies Transition,
} as const;

/* ── FadeIn ───────────────────────────────────────────────────────── */

type FadeInProps = {
  children: React.ReactNode;
  duration?: keyof typeof transitions;
  delay?: number;
  className?: string;
};

const FadeIn = ({ children, duration = 'slow', delay = 0, className }: FadeInProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ ...transitions[duration], delay }}
    className={className}
  >
    {children}
  </motion.div>
);

/* ── SlideIn ──────────────────────────────────────────────────────── */

type SlideDirection = 'up' | 'down' | 'left' | 'right';

type SlideInProps = {
  children: React.ReactNode;
  from?: SlideDirection;
  distance?: number;
  duration?: keyof typeof transitions;
  delay?: number;
  className?: string;
};

const offsets: Record<SlideDirection, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

const SlideIn = ({
  children,
  from = 'up',
  distance = 12,
  duration = 'slow',
  delay = 0,
  className,
}: SlideInProps): React.ReactElement => {
  const offset = offsets[from];
  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x * distance, y: offset.y * distance }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ ...transitions[duration], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ── ScaleIn ──────────────────────────────────────────────────────── */

type ScaleInProps = {
  children: React.ReactNode;
  duration?: keyof typeof transitions;
  delay?: number;
  className?: string;
};

const ScaleIn = ({ children, duration = 'normal', delay = 0, className }: ScaleInProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ ...transitions[duration], delay }}
    className={className}
  >
    {children}
  </motion.div>
);

/* ── Collapse ─────────────────────────────────────────────────────── */

type CollapseProps = {
  show: boolean;
  children: React.ReactNode;
  duration?: keyof typeof transitions;
};

const Collapse = ({ show, children, duration = 'slow' }: CollapseProps): React.ReactElement => (
  <AnimatePresence initial={false}>
    {show && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={transitions[duration]}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

/* ── Presence ─────────────────────────────────────────────────────── */

type PresenceProps = {
  show: boolean;
  children: React.ReactNode;
  duration?: keyof typeof transitions;
  className?: string;
};

const Presence = ({ show, children, duration = 'normal', className }: PresenceProps): React.ReactElement => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transitions[duration]}
        className={className}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

/* ── StaggerList ──────────────────────────────────────────────────── */

type StaggerListProps = {
  children: React.ReactNode;
  stagger?: number;
  className?: string;
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const StaggerList = ({ children, stagger = 0.06, className }: StaggerListProps): React.ReactElement => {
  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: stagger },
    },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
};

const StaggerItem = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement => (
  <motion.div variants={staggerItemVariants} className={className}>
    {children}
  </motion.div>
);

/* ── PageTransition ───────────────────────────────────────────────── */

type PageTransitionProps = {
  locationKey: string;
  children: React.ReactNode;
};

const PageTransition = ({ locationKey, children }: PageTransitionProps): React.ReactElement => (
  <motion.div
    key={locationKey}
    initial={{ opacity: 0, y: 4 }}
    animate={{
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
    }}
  >
    {children}
  </motion.div>
);

/* ── Exports ──────────────────────────────────────────────────────── */

export type {
  FadeInProps,
  SlideInProps,
  SlideDirection,
  ScaleInProps,
  CollapseProps,
  PresenceProps,
  StaggerListProps,
  PageTransitionProps,
};
export { transitions, FadeIn, SlideIn, ScaleIn, Collapse, Presence, StaggerList, StaggerItem, PageTransition };
