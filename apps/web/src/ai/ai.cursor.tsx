/* ── Virtual cursor ───────────────────────────────────────
 * An animated pointer visible while the agent is
 * performing actions. Moves smoothly to target elements.
 *
 * Rendered via portal to document.body to avoid transform
 * contexts from parent components breaking fixed positioning.
 * ──────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

import { transitions } from "../components/animate.tsx";

type AiCursorProps = {
  visible: boolean;
  targetId: string | null;
  onArrived?: () => void;
};

type Position = { x: number; y: number; w: number; h: number };

const CURSOR_SIZE = 20;

const measureElement = (id: string): Position | null => {
  const el = document.querySelector(`[data-ai-id="${CSS.escape(id)}"]`);
  if (!el) return null;

  // Scroll into view if needed so the user can see the action
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
};

const AiCursor = ({ visible, targetId, onArrived }: AiCursorProps): React.ReactNode => {
  const [pos, setPos] = useState<Position | null>(null);
  const arrivedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!targetId) {
      setPos(null);
      return;
    }

    // Small delay to let scrollIntoView settle before measuring
    const measure = (): void => {
      const p = measureElement(targetId);
      if (p) setPos(p);
    };

    // Measure immediately, then again after scroll settles
    measure();
    const timer = setTimeout(measure, 150);
    return () => clearTimeout(timer);
  }, [targetId]);

  const handleAnimationComplete = (): void => {
    if (targetId && arrivedRef.current !== targetId) {
      arrivedRef.current = targetId;
      onArrived?.();
    }
  };

  const content = (
    <AnimatePresence>
      {visible && pos && (
        <>
          {/* Highlight ring around target element */}
          <motion.div
            key="highlight"
            className="fixed pointer-events-none rounded-md ring-2 ring-accent/40 motion-reduce:!transition-none"
            style={{ zIndex: 9998 }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              left: pos.x - 4,
              top: pos.y - 4,
              width: pos.w + 8,
              height: pos.h + 8,
            }}
            exit={{ opacity: 0 }}
            transition={transitions.normal}
          />

          {/* Cursor pointer */}
          <motion.div
            key="cursor"
            className="fixed pointer-events-none motion-reduce:!transition-none"
            style={{ zIndex: 9999 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              left: pos.x + pos.w / 2 - CURSOR_SIZE / 2,
              top: pos.y + pos.h / 2 - CURSOR_SIZE / 2,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={transitions.normal}
            onAnimationComplete={handleAnimationComplete}
          >
            <svg
              width={CURSOR_SIZE}
              height={CURSOR_SIZE}
              viewBox="0 0 20 20"
              fill="none"
              className="drop-shadow-sm"
            >
              <path
                d="M4 2L4 16L8.5 12L14 18L17 15L11 9L16 5L4 2Z"
                className="fill-accent stroke-surface"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Portal to body to escape any transform contexts
  return createPortal(content, document.body);
};

export type { AiCursorProps };
export { AiCursor };
