import { createFileRoute, Link } from '@tanstack/react-router';

import { useFocusesList } from '../hooks/focuses/focuses.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { EntityIcon } from '../components/entity-icon.tsx';

type FocusItem = ReturnType<typeof useFocusesList>['focuses'][number];

const confidenceLabel = (v: number): string => {
  if (v === 0) return 'All articles';
  const pct = Math.round(v * 100);
  if (pct >= 80) return `${pct}% — tight`;
  if (pct >= 50) return `${pct}% — moderate`;
  return `${pct}% — loose`;
};

const FocusesPage = (): React.ReactNode => {
  const { focuses, isLoading, headers } = useFocusesList();

  if (!headers) {
    return null;
  }

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Focuses"
        subtitle="Define topic areas — articles are scored against each focus automatically"
        serif
        actions={
          <Link to="/focuses/new">
            <Button variant="primary" size="sm">
              New focus
            </Button>
          </Link>
        }
      />

      {!isLoading && focuses.length === 0 ? (
        <EmptyState
          title="No focuses yet"
          description="Focuses are topic areas that organize your articles. Create one to start filtering your feed by interest."
          action={
            <Link to="/focuses/new">
              <Button variant="primary">Create your first focus</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {focuses.map((focus) => (
            <FocusCard key={focus.id} focus={focus} />
          ))}
        </div>
      )}
    </div>
  );
};

const FocusCard = ({ focus }: { focus: FocusItem }): React.ReactElement => (
  <div
    className="rounded-lg border border-border bg-surface-raised p-4 group"
    data-ai-id={`focus-${focus.id}`}
    data-ai-role="section"
    data-ai-label={focus.name}
  >
    <div className="flex items-start gap-3 mb-3">
      <div className="w-9 h-9 rounded-md bg-accent-subtle flex items-center justify-center shrink-0 mt-0.5">
        <EntityIcon icon={focus.icon} fallback="target" size={16} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <Link
          to="/focuses/$focusId/edit"
          params={{ focusId: focus.id }}
          className="font-serif text-lg font-medium tracking-tight text-ink group-hover:text-accent transition-colors duration-fast"
        >
          {focus.name}
        </Link>
        {focus.description && (
          <div className="text-sm text-ink-secondary mt-0.5 line-clamp-1">{focus.description}</div>
        )}
      </div>
    </div>

    {/* Config summary */}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-tertiary">
      <span className="flex items-center gap-1">
        <EntityIcon icon="rss" size={11} className="text-ink-faint" />
        {focus.sources.length === 0
          ? 'No sources'
          : `${focus.sources.length} source${focus.sources.length === 1 ? '' : 's'}`}
      </span>
      <span className="flex items-center gap-1">
        <EntityIcon icon="sliders-horizontal" size={11} className="text-ink-faint" />
        {confidenceLabel(focus.minConfidence)}
      </span>
    </div>
  </div>
);

const Route = createFileRoute('/focuses/')({
  component: FocusesPage,
});

export { Route };
