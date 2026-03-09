import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

type AppShellProps = {
  nav: React.ReactNode;
  children: React.ReactNode;
};

/* ── Scroll restoration ────────────────────────────────────
 * Keyed by pathname. Saves position on scroll, restores on
 * revisit. Polls until async content is tall enough.
 * No popstate needed — if we have a saved position, restore it.
 * ────────────────────────────────────────────────────────── */

const scrollCache = new Map<string, number>();

const useScrollRestoration = (pathname: string): void => {
  const lastScrollY = useRef(0);

  // Track scroll position for the current pathname
  useEffect(() => {
    lastScrollY.current = window.scrollY;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = (): void => {
      lastScrollY.current = window.scrollY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        scrollCache.set(pathname, window.scrollY);
      }, 100);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
      scrollCache.set(pathname, lastScrollY.current);
    };
  }, [pathname]);

  // Restore or reset on route change
  useEffect(() => {
    const savedY = scrollCache.get(pathname);

    if (savedY != null && savedY > 0) {
      let attempts = 0;
      const tryRestore = (): void => {
        if (document.documentElement.scrollHeight > savedY || attempts >= 40) {
          window.scrollTo(0, savedY);
          return;
        }
        attempts++;
        setTimeout(tryRestore, 50);
      };
      requestAnimationFrame(tryRestore);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
};

/* ── Icons ─────────────────────────────────────────────── */

const MenuIcon = (): React.ReactElement => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M3 5h14M3 10h14M3 15h14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/* ── AppShell ──────────────────────────────────────────── */

const AppShell = ({ nav, children }: AppShellProps): React.ReactElement => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { location } = useRouterState();

  useScrollRestoration(location.pathname);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    if (!mobileNavOpen) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="flex min-h-dvh bg-surface">
      {/* Desktop sidebar — sticky so it stays while page scrolls */}
      <div className="hidden lg:block sticky top-0 h-dvh shrink-0">
        {nav}
      </div>

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/25 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-normal ease-gentle ${mobileNavOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />
      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-slow ease-gentle ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {nav}
      </div>

      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center h-14 px-4 border-b border-border bg-surface lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-1.5 -ml-1.5 rounded-md text-ink-secondary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast cursor-pointer"
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
          <span className="font-serif text-lg tracking-tight text-ink ml-3">
            Editions
          </span>
        </div>

        <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};

/* ── ReadingShell ──────────────────────────────────────── */

type ReadingShellProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
};

const ReadingShell = ({
  children,
  header,
}: ReadingShellProps): React.ReactElement => (
  <div className="min-h-dvh bg-surface">
    {header}
    <article className="max-w-prose mx-auto px-4 py-8 md:px-6 md:py-12">
      {children}
    </article>
  </div>
);

export type { AppShellProps, ReadingShellProps };
export { AppShell, ReadingShell };
