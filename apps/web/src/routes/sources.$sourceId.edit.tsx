import { createFileRoute } from '@tanstack/react-router';

import { useEditSource } from '../hooks/sources/sources.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';
import { Separator } from '../components/separator.tsx';

const EditSourcePage = (): React.ReactNode => {
  const { sourceId } = Route.useParams();
  const {
    source,
    loading,
    sourceQuery,
    form,
    updateMutation,
    deleteMutation,
    confirmDelete,
    setConfirmDelete,
    handleSubmit,
    navigateToSource,
    ready,
  } = useEditSource({ sourceId });

  if (!ready) {
    return null;
  }

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!source) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{form.error ?? sourceQuery.error?.message ?? 'Source not found'}</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Edit source" />

      {form.error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="edit-source-error"
          data-ai-role="error"
          data-ai-error={form.error}
        >
          {form.error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-md flex flex-col gap-5"
        data-ai-id="edit-source-form"
        data-ai-role="form"
        data-ai-label="Edit source form"
      >
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          data-ai-id="edit-source-name"
          data-ai-role="input"
          data-ai-label="Source name"
          data-ai-value={form.name}
        />
        <Input
          label="Feed URL"
          type="url"
          required
          value={form.url}
          onChange={(e) => form.setUrl(e.target.value)}
          data-ai-id="edit-source-url"
          data-ai-role="input"
          data-ai-label="Feed URL"
          data-ai-value={form.url}
        />
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Direction</label>
          <select
            value={form.direction}
            onChange={(e) => form.setDirection(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            data-ai-id="edit-source-direction"
            data-ai-role="select"
            data-ai-label="Direction"
            data-ai-value={form.direction}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first (series)</option>
          </select>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Button
            variant="primary"
            type="submit"
            disabled={updateMutation.isPending}
            data-ai-id="edit-source-submit"
            data-ai-role="button"
            data-ai-label="Save changes"
            data-ai-state={updateMutation.isPending ? 'loading' : 'idle'}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={navigateToSource}
            data-ai-id="edit-source-cancel"
            data-ai-role="button"
            data-ai-label="Cancel"
          >
            Cancel
          </Button>
        </div>
      </form>

      {source.type !== 'bookmarks' && (
        <>
          <Separator soft className="my-8" />

          <div
            className="max-w-md"
            data-ai-id="edit-source-delete-section"
            data-ai-role="section"
            data-ai-label="Delete source"
          >
            <h3 className="text-sm font-medium text-critical mb-1">Delete source</h3>
            <p className="text-xs text-ink-tertiary mb-3">
              This will permanently delete this source and all its articles. This action cannot be undone.
            </p>
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                  data-ai-id="edit-source-confirm-delete"
                  data-ai-role="button"
                  data-ai-label="Confirm delete"
                  data-ai-state={deleteMutation.isPending ? 'loading' : 'idle'}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Yes, delete'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  data-ai-id="edit-source-cancel-delete"
                  data-ai-role="button"
                  data-ai-label="Cancel delete"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                data-ai-id="edit-source-delete"
                data-ai-role="button"
                data-ai-label="Delete source"
              >
                Delete source
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
};

const Route = createFileRoute('/sources/$sourceId/edit')({
  component: EditSourcePage,
});

export { Route };
