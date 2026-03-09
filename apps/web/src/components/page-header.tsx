import * as React from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  serif?: boolean;
};

const PageHeader = ({
  title,
  subtitle,
  meta,
  actions,
  serif = false,
}: PageHeaderProps): React.ReactElement => (
  <div className="flex items-start justify-between gap-6 mb-8">
    <div className="min-w-0">
      {meta && (
        <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-2">
          {meta}
        </div>
      )}
      <h1 className={`text-2xl font-medium tracking-tight text-ink ${serif ? "font-serif" : ""}`}>
        {title}
      </h1>
      {subtitle && (
        <div className="text-sm text-ink-secondary mt-1 leading-relaxed">
          {subtitle}
        </div>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export type { PageHeaderProps };
export { PageHeader };
