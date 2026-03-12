import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { useAuthHeaders } from '../api/api.hooks.ts';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import {
  useConfigDetailData,
  useConfigDetailMutations,
  filterEditions,
} from '../hooks/editions/editions.config-detail-hooks.ts';
import type { EditionConfig, EditionSummary } from '../hooks/editions/editions.config-detail-hooks.ts';

/* ---- Icons ---- */

const CogIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path
      fillRule="evenodd"
      d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      clipRule="evenodd"
    />
  </svg>
);

/* ---- Page component ---- */

const EditionConfigDetailPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const { configId } = Route.useParams();
  const [readFilter, setReadFilter] = useState<'unread' | 'all' | 'read'>('unread');

  const { configQuery, editionsQuery } = useConfigDetailData(configId, headers);
  const { error, isGenerating, handleGenerate, handleDeleteEdition } = useConfigDetailMutations(configId, headers);

  if (!headers) {
    return null;
  }

  const loading = configQuery.isLoading || editionsQuery.isLoading;
  const config = configQuery.data ?? null;
  const editions = editionsQuery.data ?? [];

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }
  if (!config) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? configQuery.error?.message ?? 'Edition config not found'}</div>
      </div>
    );
  }

  const filtered = filterEditions(editions, readFilter);

  return (
    <>
      <ConfigHeader config={config} configId={configId} generating={isGenerating} onGenerate={handleGenerate} />
      {error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="edition-error"
          data-ai-role="error"
          data-ai-error={error}
        >
          {error}
        </div>
      )}
      {editions.length > 0 && <ReadFilterTabs readFilter={readFilter} onFilterChange={setReadFilter} />}
      <IssuesList
        editions={editions}
        filtered={filtered}
        readFilter={readFilter}
        configId={configId}
        generating={isGenerating}
        onGenerate={handleGenerate}
        onDelete={handleDeleteEdition}
      />
    </>
  );
};

/* ---- Config header ---- */

const ConfigHeader = ({
  config,
  configId,
  generating,
  onGenerate,
}: {
  config: EditionConfig;
  configId: string;
  generating: boolean;
  onGenerate: () => void;
}): React.ReactNode => (
  <div
    className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8"
    data-ai-id="edition-header"
    data-ai-role="heading"
    data-ai-label={config.name}
  >
    <h1 className="text-2xl font-serif font-medium tracking-tight text-ink">{config.name}</h1>
    <div className="flex items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        disabled={generating}
        onClick={onGenerate}
        data-ai-id="edition-generate"
        data-ai-role="button"
        data-ai-label="Generate issue"
        data-ai-state={generating ? 'loading' : 'idle'}
      >
        {generating ? 'Generating...' : 'Generate issue'}
      </Button>
      <Link
        to="/editions/$configId/edit"
        params={{ configId }}
        className="p-2 rounded-md text-ink-tertiary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast"
        aria-label="Edit edition settings"
        data-ai-id="edition-edit"
        data-ai-role="link"
        data-ai-label="Edit edition settings"
      >
        <CogIcon />
      </Link>
    </div>
  </div>
);

/* ---- Read filter tabs ---- */

const ReadFilterTabs = ({
  readFilter,
  onFilterChange,
}: {
  readFilter: string;
  onFilterChange: (f: 'unread' | 'all' | 'read') => void;
}): React.ReactNode => (
  <div className="flex gap-1 border-b border-border mb-6">
    {(['unread', 'all', 'read'] as const).map((f) => (
      <button
        key={f}
        type="button"
        onClick={() => onFilterChange(f)}
        className={`relative flex h-8 items-center justify-center px-3 text-xs font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${readFilter === f ? 'text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent' : 'text-ink-tertiary hover:text-ink-secondary'}`}
      >
        {f === 'unread' ? 'Unread' : f === 'all' ? 'All' : 'Read'}
      </button>
    ))}
  </div>
);

/* ---- Issues list ---- */

const IssuesList = ({
  editions,
  filtered,
  readFilter,
  configId,
  generating,
  onGenerate,
  onDelete,
}: {
  editions: EditionSummary[];
  filtered: EditionSummary[];
  readFilter: string;
  configId: string;
  generating: boolean;
  onGenerate: () => void;
  onDelete: (id: string, title: string) => void;
}): React.ReactNode => {
  if (editions.length === 0) {
    return (
      <EmptyState
        title="No issues yet"
        description="Generate your first issue to see it here."
        action={
          <Button variant="primary" disabled={generating} onClick={onGenerate}>
            {generating ? 'Generating...' : 'Generate issue'}
          </Button>
        }
      />
    );
  }
  if (filtered.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-ink-tertiary">
        {readFilter === 'unread' ? 'All caught up!' : 'No read issues yet.'}
      </div>
    );
  }
  return (
    <div
      className="divide-y divide-border"
      data-ai-id="edition-issues"
      data-ai-role="list"
      data-ai-label={`${filtered.length} issues`}
    >
      {filtered.map((edition) => (
        <EditionRow
          key={edition.id}
          edition={edition}
          configId={configId}
          onDelete={() => onDelete(edition.id, edition.title)}
        />
      ))}
    </div>
  );
};

/* ---- Single edition row ---- */

const formatEditionDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const EditionRowMeta = ({ edition }: { edition: EditionSummary }): React.ReactNode => (
  <div className={`flex items-center gap-2 text-xs mt-0.5 ${!edition.readAt ? 'ml-3.5' : ''} text-ink-tertiary`}>
    <span>{edition.articleCount} articles</span>
    {edition.totalReadingMinutes && (
      <>
        <span className="text-ink-faint">·</span>
        <span>{edition.totalReadingMinutes} min</span>
      </>
    )}
    <span className="text-ink-faint">·</span>
    <span>{formatEditionDate(edition.publishedAt)}</span>
    {edition.currentPosition > 0 && (
      <>
        <span className="text-ink-faint">·</span>
        <span className="text-accent">resumed</span>
      </>
    )}
  </div>
);

const EditionRow = ({
  edition,
  configId,
  onDelete,
}: {
  edition: EditionSummary;
  configId: string;
  onDelete: () => void;
}): React.ReactNode => (
  <div
    className="flex items-center justify-between py-4"
    data-ai-id={`edition-issue-${edition.id}`}
    data-ai-role="section"
    data-ai-label={edition.title}
  >
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        {!edition.readAt && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />}
        <Link
          to="/editions/$configId/issues/$editionId"
          params={{ configId, editionId: edition.id }}
          className={`font-serif font-medium hover:text-accent transition-colors duration-fast ${edition.readAt ? 'text-ink-secondary' : 'text-ink'}`}
          data-ai-id={`edition-issue-${edition.id}-link`}
          data-ai-role="link"
          data-ai-label={edition.title}
        >
          {edition.title}
        </Link>
      </div>
      <EditionRowMeta edition={edition} />
    </div>
    <button
      type="button"
      onClick={onDelete}
      className="text-xs text-ink-tertiary hover:text-critical transition-colors duration-fast cursor-pointer ml-4"
    >
      Delete
    </button>
  </div>
);

const Route = createFileRoute('/editions/$configId/')({
  component: EditionConfigDetailPage,
});

export { Route };
