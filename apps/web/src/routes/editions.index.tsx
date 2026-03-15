import { createFileRoute, Link } from '@tanstack/react-router';

import { useEditionConfigs, formatLookback } from '../hooks/editions/editions.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { EntityIcon } from '../components/entity-icon.tsx';

type ConfigItem = ReturnType<typeof useEditionConfigs>['configs'][number];

const EditionsPage = (): React.ReactNode => {
  const { configs, loading, deletingId, generatingId, handleDelete, handleGenerate } = useEditionConfigs();

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Editions"
        subtitle="Curated digests built from your focuses"
        serif
        actions={
          <Link to="/editions/new" data-ai-id="edition-new" data-ai-role="link" data-ai-label="New edition">
            <Button variant="primary" size="sm">
              New edition
            </Button>
          </Link>
        }
      />
      {!loading && configs.length === 0 ? (
        <EmptyState
          title="No editions yet"
          description="Editions are scheduled digests built from your focuses. Create your first edition to start receiving briefings."
          action={
            <Link to="/editions/new">
              <Button variant="primary">New edition</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {configs.map((config) => (
            <EditionConfigCard key={config.id} config={config} deletingId={deletingId} generatingId={generatingId} onDelete={handleDelete} onGenerate={handleGenerate} />
          ))}
        </div>
      )}
    </div>
  );
};

const EditionConfigCard = ({
  config,
  deletingId,
  generatingId,
  onDelete,
  onGenerate,
}: {
  config: ConfigItem;
  deletingId: string | null;
  generatingId: string | null;
  onDelete: (id: string, name: string) => void;
  onGenerate: (id: string) => void;
}): React.ReactElement => (
  <div
    className="rounded-lg border border-border bg-surface-raised p-4 group"
    data-ai-id={`edition-config-${config.id}`}
    data-ai-role="section"
    data-ai-label={config.name}
  >
    <div className="flex items-start gap-3 mb-3">
      <div className="w-9 h-9 rounded-md bg-accent-subtle flex items-center justify-center shrink-0 mt-0.5">
        <EntityIcon icon={config.icon} fallback="newspaper" size={16} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to="/editions/$configId/edit"
            params={{ configId: config.id }}
            className="font-serif text-lg font-medium tracking-tight text-ink group-hover:text-accent transition-colors duration-fast"
            data-ai-id={`edition-config-${config.id}-link`}
            data-ai-role="link"
            data-ai-label={config.name}
          >
            {config.name}
          </Link>
          {!config.enabled && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-caution-subtle text-caution">paused</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onGenerate(config.id)}
          disabled={generatingId === config.id}
          className="text-xs text-accent hover:text-accent-hover transition-colors duration-fast cursor-pointer disabled:opacity-50"
          data-ai-id={`edition-config-${config.id}-generate`}
          data-ai-role="button"
          data-ai-label={`Generate ${config.name}`}
          data-ai-state={generatingId === config.id ? 'loading' : 'idle'}
        >
          {generatingId === config.id ? 'Generating...' : 'Generate'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(config.id, config.name)}
          className="text-xs text-ink-faint hover:text-critical transition-colors duration-fast cursor-pointer"
          data-ai-id={`edition-config-${config.id}-delete`}
          data-ai-role="button"
          data-ai-label={`Delete ${config.name}`}
        >
          {deletingId === config.id ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>

    {/* Config details */}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-tertiary mb-3">
      <span className="flex items-center gap-1">
        <EntityIcon icon="clock" size={11} className="text-ink-faint" />
        {formatLookback(config.lookbackHours)} window
      </span>
      <span className="flex items-center gap-1">
        <EntityIcon icon="target" size={11} className="text-ink-faint" />
        {config.focuses.length === 0
          ? 'No focuses'
          : `${config.focuses.length} focus${config.focuses.length === 1 ? '' : 'es'}`}
      </span>
    </div>

    {/* Focus pills */}
    {config.focuses.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {config.focuses.map((f) => (
          <span
            key={f.focusId}
            className="text-xs px-2 py-0.5 rounded-full bg-surface-sunken text-ink-tertiary"
          >
            {f.focusName}
          </span>
        ))}
      </div>
    )}
  </div>
);

const Route = createFileRoute('/editions/')({
  component: EditionsPage,
});

export { Route };
