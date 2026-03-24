import { createFileRoute, Link } from '@tanstack/react-router';

import { useSourcesList, useClassificationStats } from '../hooks/sources/sources.hooks.ts';
import { useOpml } from '../hooks/sources/sources.opml-hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { SourceCard } from '../components/source-card.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { Button } from '../components/button.tsx';
import { Menu } from '../components/menu.tsx';
import { Collapse } from '../components/animate.tsx';

const ImportResultBanner = ({
  result,
  error,
  onDismiss,
}: {
  result: {
    added: number;
    skipped: number;
    sources: { name: string; url: string; status: 'added' | 'skipped' }[];
  } | null;
  error: string | null;
  onDismiss: () => void;
}): React.ReactNode => {
  const show = result !== null || error !== null;

  return (
    <Collapse show={show}>
      <div
        className={`rounded-lg border px-4 py-3 mb-4 ${
          error
            ? 'bg-critical-subtle border-critical/20 text-critical'
            : 'bg-positive-subtle border-positive/20 text-ink'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {error ? (
              <p className="text-sm">{error}</p>
            ) : result ? (
              <>
                <p className="text-sm font-medium">
                  {result.added === 0
                    ? 'All feeds already exist — nothing new to add.'
                    : result.added === 1
                      ? '1 feed added.'
                      : `${result.added} feeds added.`}
                  {result.skipped > 0 &&
                    ` ${result.skipped} ${result.skipped === 1 ? 'duplicate' : 'duplicates'} skipped.`}
                </p>
                {result.sources.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-sm text-ink-secondary">
                    {result.sources.map((s) => (
                      <li key={s.url} className="flex items-center gap-1.5">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${s.status === 'added' ? 'bg-positive' : 'bg-ink-faint'}`}
                        />
                        <span className="truncate">{s.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 text-ink-tertiary hover:text-ink transition-colors duration-fast ease-gentle cursor-pointer p-1 -m-1"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>
    </Collapse>
  );
};

const SourcesPage = (): React.ReactNode => {
  const { sources, loading, reanalyseMutation, reExtractMutation } = useSourcesList();
  const { stats } = useClassificationStats();
  const { exportOpml, pickAndImport, importMutation, importResult, importError, clearImportResult } = useOpml();

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Sources"
        subtitle={loading ? 'Loading...' : `${sources.length} feeds configured`}
        actions={
          <div className="flex items-center gap-2">
            <Menu.Root>
              <Menu.Trigger
                render={
                  <Button variant="ghost" size="sm" aria-label="Import and export">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 3v7M5 7.5 8 10l3-2.5" />
                      <path d="M3 12.5h10" />
                    </svg>
                  </Button>
                }
              />
              <Menu.Content>
                <Menu.Label>OPML</Menu.Label>
                <Menu.Item onClick={exportOpml}>Export feeds</Menu.Item>
                <Menu.Item onClick={pickAndImport} disabled={importMutation.isPending}>
                  {importMutation.isPending ? 'Importing...' : 'Import feeds'}
                </Menu.Item>
              </Menu.Content>
            </Menu.Root>
            <Button
              variant="secondary"
              size="sm"
              disabled={reExtractMutation.isPending}
              onClick={() => reExtractMutation.mutate()}
            >
              {reExtractMutation.isPending ? 'Re-extracting...' : 'Re-extract all'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={reanalyseMutation.isPending}
              onClick={() => reanalyseMutation.mutate()}
            >
              {reanalyseMutation.isPending ? 'Reanalysing...' : 'Reanalyse all'}
            </Button>
            <Link to="/sources/new" data-ai-id="add-source-btn" data-ai-role="button" data-ai-label="Add source">
              <Button variant="primary" size="sm">
                Add source
              </Button>
            </Link>
          </div>
        }
      />

      <ImportResultBanner result={importResult} error={importError} onDismiss={clearImportResult} />

      {!loading && sources.length === 0 ? (
        <EmptyState
          title="No sources yet"
          description="Add your first RSS feed or import an OPML file to start building your reading experience."
          action={
            <div className="flex items-center gap-3">
              <Link to="/sources/new">
                <Button variant="primary">Add source</Button>
              </Link>
              <Button variant="secondary" onClick={pickAndImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? 'Importing...' : 'Import OPML'}
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3" data-ai-id="sources-list" data-ai-role="list" data-ai-label="Sources">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              id={source.id}
              name={source.name}
              url={source.url}
              lastFetchedAt={source.lastFetchedAt}
              fetchError={source.fetchError}
              href={`/sources/${source.id}`}
              focusStats={stats.get(source.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Route = createFileRoute('/sources/')({
  component: SourcesPage,
});

export { Route };
