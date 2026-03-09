import * as React from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

const EmptyState = ({
  title,
  description,
  action,
}: EmptyStateProps): React.ReactElement => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="text-lg font-medium text-ink-secondary mb-1">{title}</div>
    {description && (
      <div className="text-sm text-ink-tertiary max-w-sm leading-relaxed">
        {description}
      </div>
    )}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export type { EmptyStateProps };
export { EmptyState };
