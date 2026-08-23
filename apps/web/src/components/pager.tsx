import type { PagerControls } from '../hooks/utilities/use-paged-query.ts';

import { Button } from './button.tsx';

type PagerProps = {
  pagination: PagerControls;
  /**
   * Prefix for the assistant annotations: `${idPrefix}-pagination`,
   * `-prev-page`, `-next-page`. These ids are referenced by the AI tutorials in
   * `src/ai/tutorials`, so they must stay stable per surface.
   */
  idPrefix: string;
};

/** Renders nothing for a single page — every call site relied on that. */
const Pager = ({ pagination, idPrefix }: PagerProps): React.ReactNode => {
  if (pagination.totalPages <= 1) {
    return null;
  }

  const label = `Page ${pagination.currentPage} of ${pagination.totalPages}`;

  return (
    <div
      className="flex items-center justify-between mt-4 pt-4 border-t border-border"
      data-ai-id={`${idPrefix}-pagination`}
      data-ai-role="info"
      data-ai-label={label}
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={!pagination.hasPrev}
        onClick={() => pagination.goPrev()}
        data-ai-id={`${idPrefix}-prev-page`}
        data-ai-role="button"
        data-ai-label="Previous page"
      >
        Previous
      </Button>
      <span className="text-xs text-ink-tertiary">{label}</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={!pagination.hasNext}
        onClick={() => pagination.goNext()}
        data-ai-id={`${idPrefix}-next-page`}
        data-ai-role="button"
        data-ai-label="Next page"
      >
        Next
      </Button>
    </div>
  );
};

export type { PagerProps };
export { Pager };
