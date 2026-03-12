import { createFileRoute, Link } from '@tanstack/react-router';

import { useEditionConfigs, formatLookback } from '../hooks/editions/editions.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';

const EditionsPage = (): React.ReactNode => {
  const { configs, loading, deletingId, handleDelete } = useEditionConfigs();

  return (
    <>
      <PageHeader
        title="Editions"
        subtitle={loading ? 'Loading...' : `${configs.length} edition configurations`}
        actions={
          <Link to="/editions/new" data-ai-id="edition-new" data-ai-role="link" data-ai-label="New edition">
            <Button variant="primary" size="sm">
              New edition
            </Button>
          </Link>
        }
      />
      <EditionConfigsList configs={configs} loading={loading} deletingId={deletingId} onDelete={handleDelete} />
    </>
  );
};

type ConfigItem = { id: string; name: string; lookbackHours: number; enabled: boolean; focuses: { focusId: string }[] };

const EditionConfigsList = ({
  configs,
  loading,
  deletingId,
  onDelete,
}: {
  configs: ConfigItem[];
  loading: boolean;
  deletingId: string | null;
  onDelete: (id: string, name: string) => void;
}): React.ReactNode => {
  if (!loading && configs.length === 0) {
    return (
      <EmptyState
        title="No editions yet"
        description="Editions are curated digests built from your focuses. Create your first edition to start receiving briefings."
        action={
          <Link to="/editions/new">
            <Button variant="primary">New edition</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div
      className="grid gap-3"
      data-ai-id="edition-list"
      data-ai-role="list"
      data-ai-label={`${configs.length} edition configurations`}
    >
      {configs.map((config) => (
        <ConfigRow key={config.id} config={config} deletingId={deletingId} onDelete={onDelete} />
      ))}
    </div>
  );
};

const ConfigRow = ({
  config,
  deletingId,
  onDelete,
}: {
  config: ConfigItem;
  deletingId: string | null;
  onDelete: (id: string, name: string) => void;
}): React.ReactNode => (
  <div
    className="flex items-center justify-between py-4 border-b border-border last:border-b-0"
    data-ai-id={`edition-config-${config.id}`}
    data-ai-role="section"
    data-ai-label={config.name}
  >
    <div className="min-w-0 flex-1">
      <Link
        to="/editions/$configId"
        params={{ configId: config.id }}
        className="font-serif text-lg font-medium tracking-tight text-ink hover:text-accent transition-colors duration-fast"
        data-ai-id={`edition-config-${config.id}-link`}
        data-ai-role="link"
        data-ai-label={config.name}
      >
        {config.name}
      </Link>
      <div className="flex items-center gap-2 text-xs text-ink-tertiary mt-1">
        <span>{formatLookback(config.lookbackHours)} window</span>
        <span className="text-ink-faint">·</span>
        <span>
          {config.focuses.length === 0
            ? 'No focuses'
            : `${config.focuses.length} focus${config.focuses.length === 1 ? '' : 'es'}`}
        </span>
        {!config.enabled && (
          <>
            <span className="text-ink-faint">·</span>
            <span className="text-caution">disabled</span>
          </>
        )}
      </div>
    </div>
    <button
      type="button"
      onClick={() => onDelete(config.id, config.name)}
      className="text-xs text-ink-tertiary hover:text-critical transition-colors duration-fast cursor-pointer ml-4"
      data-ai-id={`edition-config-${config.id}-delete`}
      data-ai-role="button"
      data-ai-label={`Delete ${config.name}`}
    >
      {deletingId === config.id ? 'Deleting...' : 'Delete'}
    </button>
  </div>
);

const Route = createFileRoute('/editions/')({
  component: EditionsPage,
});

export { Route };
