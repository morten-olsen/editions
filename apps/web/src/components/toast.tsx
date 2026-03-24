import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* ── Types ───────────────────────────────────────────────────── */

type ToastStatus = 'pending' | 'success' | 'error';

type ToastOptions = {
  title: string;
  description?: string;
  /** Async function to track — toast shows pending state until it resolves/rejects */
  action?: () => Promise<unknown>;
  /** Auto-dismiss timeout in ms (starts after action completes). Default 4000. Set 0 to disable. */
  timeout?: number;
};

type ToastEntry = {
  id: string;
  title: string;
  description?: string;
  status: ToastStatus;
  errorMessage?: string;
};

type ShowToast = (options: ToastOptions) => void;

/* ── Context ─────────────────────────────────────────────────── */

const ToastContext = React.createContext<ShowToast | null>(null);

const useShowToast = (): ShowToast => {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useShowToast must be used within a ToastProvider');
  }
  return ctx;
};

/* ── Icons ───────────────────────────────────────────────────── */

const Spinner = (): React.ReactElement => (
  <svg className="w-4 h-4 animate-spin text-ink-tertiary" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
  </svg>
);

const CheckIcon = (): React.ReactElement => (
  <svg className="w-4 h-4 text-positive" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
  </svg>
);

const ErrorIcon = (): React.ReactElement => (
  <svg className="w-4 h-4 text-critical" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3.5M8 10.5v.5" />
  </svg>
);

const DismissIcon = (): React.ReactElement => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 3l8 8M11 3l-8 8" />
  </svg>
);

const statusIcon: Record<ToastStatus, () => React.ReactElement> = {
  pending: Spinner,
  success: CheckIcon,
  error: ErrorIcon,
};

/* ── Toast item ──────────────────────────────────────────────── */

type ToastItemProps = {
  toast: ToastEntry;
  onDismiss: (id: string) => void;
};

const ToastItem = ({ toast, onDismiss }: ToastItemProps): React.ReactElement => {
  const Icon = statusIcon[toast.status];
  const description = toast.status === 'error' ? (toast.errorMessage ?? toast.description) : toast.description;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="pointer-events-auto flex items-start gap-3 rounded-lg bg-surface-overlay px-4 py-3 shadow-lg border border-border min-w-64 max-w-sm"
    >
      <div className="mt-0.5 shrink-0">
        <Icon />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink leading-snug">{toast.title}</div>
        {description && (
          <div className="text-xs text-ink-secondary mt-0.5 leading-relaxed">{description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 mt-0.5 p-0.5 rounded text-ink-faint hover:text-ink-secondary transition-colors duration-fast cursor-pointer"
        aria-label="Dismiss"
      >
        <DismissIcon />
      </button>
    </motion.div>
  );
};

/* ── Provider ────────────────────────────────────────────────── */

const DEFAULT_TIMEOUT = 4000;
let nextId = 0;

const ToastProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = React.useCallback((id: string): void => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startAutoDismiss = React.useCallback((id: string, timeout: number): void => {
    if (timeout <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      timers.current.delete(id);
      dismiss(id);
    }, timeout);
    timers.current.set(id, timer);
  }, [dismiss]);

  const showToast = React.useCallback(
    (options: ToastOptions): void => {
      const id = String(++nextId);
      const timeout = options.timeout ?? DEFAULT_TIMEOUT;
      const hasAction = !!options.action;

      const entry: ToastEntry = {
        id,
        title: options.title,
        description: options.description,
        status: hasAction ? 'pending' : 'success',
      };

      setToasts((prev) => [...prev, entry]);

      if (!hasAction) {
        startAutoDismiss(id, timeout);
        return;
      }

      options.action!().then(
        () => {
          setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: 'success' as const } : t)),
          );
          startAutoDismiss(id, timeout);
        },
        (err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
          setToasts((prev) =>
            prev.map((t) =>
              t.id === id ? { ...t, status: 'error' as const, errorMessage } : t,
            ),
          );
          startAutoDismiss(id, timeout);
        },
      );
    },
    [startAutoDismiss],
  );

  // Cleanup timers on unmount
  React.useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

/* ── Exports ─────────────────────────────────────────────────── */

export type { ToastOptions, ShowToast };
export { ToastProvider, useShowToast };
