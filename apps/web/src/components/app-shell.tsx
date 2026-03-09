import * as React from "react";

type AppShellProps = {
  nav: React.ReactNode;
  children: React.ReactNode;
};

const AppShell = ({ nav, children }: AppShellProps): React.ReactElement => (
  <div className="flex h-dvh bg-surface">
    {nav}
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-prose mx-auto px-8 py-8">
        {children}
      </div>
    </main>
  </div>
);

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
    <article className="max-w-prose mx-auto px-6 py-12">
      {children}
    </article>
  </div>
);

export type { AppShellProps, ReadingShellProps };
export { AppShell, ReadingShell };
