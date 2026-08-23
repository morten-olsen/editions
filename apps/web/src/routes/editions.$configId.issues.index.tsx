import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { useIssues } from '../hooks/editions/editions.issues-hooks.ts';
import type { Issue, ReadFilter, SweepAction } from '../hooks/editions/editions.issues-hooks.ts';
import { SlideIn, StaggerList, StaggerItem, FadeIn } from '../components/animate.tsx';
import { Button } from '../components/button.tsx';
import { Pager } from '../components/pager.tsx';
import { ACTION_LABELS, CleanUpDialog } from '../views/editions/issues-cleanup-dialog.tsx';

// --- Components ---

const ReadIndicator = ({ readAt }: { readAt: string | null }): React.ReactElement | null => {
  if (!readAt) {
    return null;
  }
  return <span className="font-mono text-xs tracking-wide text-accent">read</span>;
};

const formatFullDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const IssueRow = ({
  edition,
  configId,
  onDelete,
  isDeleting,
}: {
  edition: Issue;
  configId: string;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}): React.ReactElement => (
  <div className="py-4 border-t border-border group">
    <div className="flex items-start justify-between gap-4">
      <Link
        to="/editions/$configId/issues/$editionId"
        params={{ configId, editionId: edition.id }}
        className="min-w-0 flex-1"
        data-ai-id={`edition-issue-${edition.id}-link`}
      >
        <div className="flex items-baseline gap-3 mb-1">
          <span className="font-mono text-xs tracking-wide text-ink-faint">{formatFullDate(edition.publishedAt)}</span>
          <ReadIndicator readAt={edition.readAt} />
        </div>
        <div className="font-serif text-lg font-medium tracking-tight text-ink hover:text-accent transition-colors duration-fast leading-snug">
          {edition.title}
        </div>
        <div className="font-mono text-xs text-ink-faint mt-1.5 tracking-wide">
          {edition.articleCount} articles
          {edition.totalReadingMinutes != null && ` · ${edition.totalReadingMinutes} min`}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onDelete(edition.id)}
        disabled={isDeleting}
        className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-fast font-mono text-xs tracking-wide text-ink-faint hover:text-critical"
        title="Delete this issue"
        data-ai-id={`edition-issue-${edition.id}-delete`}
        data-ai-role="button"
        data-ai-label="Delete issue"
      >
        Delete
      </button>
    </div>
  </div>
);

const FilterToggle = ({
  value,
  onChange,
}: {
  value: ReadFilter;
  onChange: (v: ReadFilter) => void;
}): React.ReactElement => (
  <div className="flex gap-1 bg-surface-sunken rounded-md p-0.5">
    {(['unread', 'all'] as const).map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={`font-mono text-xs tracking-wide px-3 py-1 rounded transition-colors duration-fast capitalize ${
          value === opt ? 'bg-surface text-ink shadow-xs' : 'text-ink-tertiary hover:text-ink'
        }`}
        data-ai-id={`issues-filter-${opt}`}
        data-ai-role="button"
        data-ai-label={`Show ${opt} issues`}
        data-ai-state={value === opt ? 'selected' : 'idle'}
      >
        {opt}
      </button>
    ))}
  </div>
);

const EmptyState = ({ filter }: { filter: ReadFilter }): React.ReactElement => (
  <FadeIn>
    <div className="py-12 text-center">
      <div className="text-4xl text-accent/20 mb-4 select-none" aria-hidden="true">
        ~
      </div>
      <p className="text-sm text-ink-tertiary leading-relaxed">
        {filter === 'unread'
          ? "No unread issues. You're all caught up."
          : 'No issues yet. Generate one from the edition settings.'}
      </p>
    </div>
  </FadeIn>
);

const IssuesHeader = ({
  configName,
  total,
  readFilter,
  onFilterChange,
  onCleanUp,
}: {
  configName: string | undefined;
  total: number;
  readFilter: ReadFilter;
  onFilterChange: (v: ReadFilter) => void;
  onCleanUp: () => void;
}): React.ReactElement => (
  <div className="mb-8">
    <Link
      to="/"
      className="font-mono text-xs tracking-wide text-ink-faint hover:text-ink transition-colors duration-fast mb-4 inline-block"
    >
      ← Back
    </Link>
    <div className="flex items-baseline justify-between gap-4">
      <h1 className="font-serif text-2xl font-medium tracking-tight text-ink">{configName ?? 'Issues'}</h1>
      <div className="flex items-center gap-3">
        <FilterToggle value={readFilter} onChange={onFilterChange} />
        <Button
          variant="secondary"
          size="sm"
          onClick={onCleanUp}
          data-ai-id="issues-sweep-open"
          data-ai-role="button"
          data-ai-label="Clean up issues"
        >
          Clean up
        </Button>
      </div>
    </div>
    <p className="font-mono text-xs tracking-wide text-ink-faint mt-2">
      {total} issue{total === 1 ? '' : 's'}
    </p>
  </div>
);

const SweepResultBanner = ({
  result,
  onDismiss,
}: {
  result: { action: SweepAction; affected: number };
  onDismiss: () => void;
}): React.ReactElement => (
  <div
    className="rounded-md border border-border bg-surface-sunken px-4 py-3 mb-4 flex items-center justify-between gap-4"
    data-ai-id="issues-sweep-result"
    data-ai-role="info"
    data-ai-label="Clean-up result"
  >
    <span className="text-sm text-ink-secondary">
      {ACTION_LABELS[result.action]}: {result.affected} issue{result.affected === 1 ? '' : 's'}.
    </span>
    <button type="button" onClick={onDismiss} className="font-mono text-xs tracking-wide text-ink-faint hover:text-ink">
      Dismiss
    </button>
  </div>
);

/* ---------- Page ---------- */

const AllIssuesPage = (): React.ReactNode => {
  const { configId } = Route.useParams();
  const issues = useIssues(configId);
  const [cleanUpOpen, setCleanUpOpen] = useState(false);

  return (
    <SlideIn from="up" distance={12}>
      <IssuesHeader
        configName={issues.configName}
        total={issues.total}
        readFilter={issues.readFilter}
        onFilterChange={issues.setReadFilter}
        onCleanUp={() => setCleanUpOpen(true)}
      />

      {issues.sweepResult && <SweepResultBanner result={issues.sweepResult} onDismiss={issues.clearSweepResult} />}

      {issues.isLoading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : issues.issues.length === 0 ? (
        <EmptyState filter={issues.readFilter} />
      ) : (
        <>
          <StaggerList>
            {issues.issues.map((edition) => (
              <StaggerItem key={edition.id}>
                <IssueRow
                  edition={edition}
                  configId={configId}
                  onDelete={issues.deleteIssue}
                  isDeleting={issues.deletingId === edition.id}
                />
              </StaggerItem>
            ))}
            <div className="h-px bg-border" />
          </StaggerList>
          <Pager pagination={issues.pagination} idPrefix="issues" />
        </>
      )}

      <CleanUpDialog
        configId={configId}
        open={cleanUpOpen}
        onOpenChange={setCleanUpOpen}
        pending={issues.sweepPending}
        onRun={(params) => {
          issues.runSweep(params);
          setCleanUpOpen(false);
        }}
      />

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          to="/editions/$configId/edit"
          params={{ configId }}
          className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast"
        >
          Edition settings
        </Link>
      </div>
    </SlideIn>
  );
};

const Route = createFileRoute('/editions/$configId/issues/')({
  component: AllIssuesPage,
});

export { Route };
