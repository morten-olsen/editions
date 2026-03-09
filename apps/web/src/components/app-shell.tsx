import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

type AppShellProps = {
  nav: React.ReactNode;
  children: React.ReactNode;
};

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

const AppShell = ({ nav, children }: AppShellProps): React.ReactElement => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { location } = useRouterState();

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
    <div className="flex h-dvh bg-surface">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
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

      <main className="flex-1 overflow-y-auto">
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
