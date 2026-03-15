import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { EntityIcon } from './entity-icon.tsx';

/* ── Types ───────────────────────────────────────────────────────── */

type BuilderSplitViewProps = {
  /** Configuration panel (left on desktop, main view on mobile) */
  config: React.ReactNode;
  /** Preview panel (right on desktop, drawer on mobile) */
  preview: React.ReactNode;
  /** Label for the mobile preview toggle */
  previewLabel?: string;
  /** Count badge shown on the mobile preview toggle */
  previewCount?: number;
};

/* ── BuilderSplitView ────────────────────────────────────────────── */

const BuilderSplitView = ({
  config,
  preview,
  previewLabel = 'Preview',
  previewCount,
}: BuilderSplitViewProps): React.ReactElement => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Desktop: side-by-side */}
      <div className="hidden lg:flex min-h-0 flex-1">
        {/* Config panel — scrollable */}
        <div
          className="w-1/2 max-w-xl border-r border-border overflow-y-auto"
          data-ai-id="builder-config"
          data-ai-role="section"
          data-ai-label="Configuration"
        >
          <div className="p-6 lg:p-8">{config}</div>
        </div>

        {/* Preview panel — scrollable */}
        <div
          className="flex-1 overflow-y-auto bg-surface-sunken/30"
          data-ai-id="builder-preview"
          data-ai-role="section"
          data-ai-label={previewLabel}
        >
          <div className="p-6 lg:p-8">{preview}</div>
        </div>
      </div>

      {/* Mobile: config with floating preview button */}
      <div className="lg:hidden flex-1 overflow-y-auto">
        <div className="px-4 py-6 md:px-8 md:py-8">{config}</div>

        {/* Floating preview toggle */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent text-accent-ink shadow-lg hover:bg-accent-hover transition-colors duration-fast cursor-pointer"
          data-ai-id="builder-preview-toggle"
          data-ai-role="button"
          data-ai-label={previewLabel}
        >
          <span className="text-sm font-medium">{previewLabel}</span>
          {previewCount != null && (
            <span className="text-xs bg-accent-ink/15 px-1.5 py-0.5 rounded-full">{previewCount}</span>
          )}
        </button>

        {/* Preview drawer */}
        <MobilePreviewDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label={previewLabel}>
          {preview}
        </MobilePreviewDrawer>
      </div>
    </div>
  );
};

/* ── Mobile preview drawer ───────────────────────────────────────── */

type MobilePreviewDrawerProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
};

const MobilePreviewDrawer = ({ open, onClose, label, children }: MobilePreviewDrawerProps): React.ReactElement => (
  <>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 bg-black/25 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.35, ease: [0, 0, 0.15, 1] }}
          className="fixed inset-x-0 bottom-0 z-50 lg:hidden bg-surface rounded-t-xl shadow-xl max-h-[85dvh] flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <span className="font-mono text-xs tracking-wide text-ink-faint uppercase">{label}</span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
              aria-label="Close preview"
            >
              <EntityIcon icon="x" size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);

export type { BuilderSplitViewProps };
export { BuilderSplitView };
