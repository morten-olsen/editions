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
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-8" data-ai-id="page-header" data-ai-role="heading" data-ai-label={title}>
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
