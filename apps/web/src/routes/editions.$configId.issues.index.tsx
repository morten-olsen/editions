import { useState, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { client } from '../api/api.ts';
import { useAuthHeaders } from '../api/api.hooks.ts';
import { SlideIn, StaggerList, StaggerItem, FadeIn } from '../components/animate.tsx';

// --- Types ---

type EditionSummary = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  createdAt: string;
  configName: string;
};

// --- Data hooks ---

const useConfigEditions = (
  configId: string,
  readFilter: 'unread' | 'all',
): { data: EditionSummary[] | undefined; isLoading: boolean } => {
  const headers = useAuthHeaders();

  return useQuery({
    queryKey: ['config-editions', configId, readFilter],
    queryFn: async (): Promise<EditionSummary[]> => {
      const res = await client.GET('/api/editions/configs/{configId}/editions', {
        params: { path: { configId }, query: readFilter === 'unread' ? { read: 'false' } : undefined },
        headers,
      });
      return (res.data ?? []) as unknown as EditionSummary[];
    },
    enabled: !!headers,
  });
};

// --- Components ---

const ReadIndicator = ({ readAt }: { readAt: string | null }): React.ReactElement | null => {
  if (!readAt) return null;
  return (
    <span className="font-mono text-xs tracking-wide text-accent">read</span>
  );
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
  edition: EditionSummary;
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
      >
        <div className="flex items-baseline gap-3 mb-1">
          <span className="font-mono text-xs tracking-wide text-ink-faint">
            {formatFullDate(edition.publishedAt)}
          </span>
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
  value: 'unread' | 'all';
  onChange: (v: 'unread' | 'all') => void;
}): React.ReactElement => (
  <div className="flex gap-1 bg-surface-sunken rounded-md p-0.5">
    {(['unread', 'all'] as const).map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={`font-mono text-xs tracking-wide px-3 py-1 rounded transition-colors duration-fast capitalize ${
          value === opt
            ? 'bg-surface text-ink shadow-xs'
            : 'text-ink-tertiary hover:text-ink'
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const EmptyState = ({ filter }: { filter: 'unread' | 'all' }): React.ReactElement => (
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

/* ---------- Page ---------- */

const AllIssuesPage = (): React.ReactNode => {
  const { configId } = Route.useParams();
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: editions, isLoading } = useConfigEditions(configId, filter);

  const deleteMutation = useMutation({
    mutationFn: async (editionId: string): Promise<void> => {
      await client.DELETE('/api/editions/{editionId}', {
        params: { path: { editionId } },
        headers,
      });
    },
    onMutate: (editionId) => setDeletingId(editionId),
    onSettled: () => {
      setDeletingId(null);
      void queryClient.invalidateQueries({ queryKey: ['config-editions', configId] });
    },
  });

  const handleDelete = useCallback(
    (editionId: string): void => {
      deleteMutation.mutate(editionId);
    },
    [deleteMutation],
  );

  const configName = editions?.[0]?.configName;

  return (
    <SlideIn from="up" distance={12}>
      <div className="mb-8">
        <Link
          to="/"
          className="font-mono text-xs tracking-wide text-ink-faint hover:text-ink transition-colors duration-fast mb-4 inline-block"
        >
          ← Back
        </Link>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-ink">
            {configName ?? 'Issues'}
          </h1>
          <FilterToggle value={filter} onChange={setFilter} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : !editions || editions.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <StaggerList>
          {editions.map((edition) => (
            <StaggerItem key={edition.id}>
              <IssueRow
                edition={edition}
                configId={configId}
                onDelete={handleDelete}
                isDeleting={deletingId === edition.id}
              />
            </StaggerItem>
          ))}
          <div className="h-px bg-border" />
        </StaggerList>
      )}

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
