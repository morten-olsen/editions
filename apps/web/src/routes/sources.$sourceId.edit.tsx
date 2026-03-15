import { createFileRoute } from '@tanstack/react-router';

import { useEditSource } from '../hooks/sources/sources.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';
import { Separator } from '../components/separator.tsx';

const EditSourcePage = (): React.ReactNode => {
  const { sourceId } = Route.useParams();
  const hook = useEditSource({ sourceId });

  if (!hook.ready) {
    return null;
  }
  if (hook.loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }
  if (!hook.source) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">
          {hook.form.error ?? hook.sourceQuery.error?.message ?? 'Source not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Edit source" />
      {hook.form.error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="edit-source-error"
          data-ai-role="error"
          data-ai-error={hook.form.error}
        >
          {hook.form.error}
        </div>
      )}
      <EditSourceForm hook={hook} />
      {hook.source.type !== 'bookmarks' && (
        <>
          <Separator soft className="my-8" />
          <DeleteSourceSection hook={hook} />
        </>
      )}
    </div>
  );
};

type EditHook = ReturnType<typeof useEditSource>;

const EditSourceForm = ({ hook }: { hook: EditHook }): React.ReactNode => (
  <form
    onSubmit={hook.handleSubmit}
    className="max-w-md flex flex-col gap-5"
    data-ai-id="edit-source-form"
    data-ai-role="form"
    data-ai-label="Edit source form"
  >
    <Input
      label="Name"
      required
      value={hook.form.name}
      onChange={(e) => hook.form.setName(e.target.value)}
      data-ai-id="edit-source-name"
      data-ai-role="input"
      data-ai-label="Source name"
      data-ai-value={hook.form.name}
    />
    <Input
      label="Feed URL"
      type="url"
      required
      value={hook.form.url}
      onChange={(e) => hook.form.setUrl(e.target.value)}
      data-ai-id="edit-source-url"
      data-ai-role="input"
      data-ai-label="Feed URL"
      data-ai-value={hook.form.url}
    />
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">Direction</label>
      <select
        value={hook.form.direction}
        onChange={(e) => hook.form.setDirection(e.target.value)}
        className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
        data-ai-id="edit-source-direction"
        data-ai-role="select"
        data-ai-label="Direction"
        data-ai-value={hook.form.direction}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first (series)</option>
      </select>
    </div>
    <div className="flex items-center gap-3 mt-2">
      <Button
        variant="primary"
        type="submit"
        disabled={hook.updateMutation.isPending}
        data-ai-id="edit-source-submit"
        data-ai-role="button"
        data-ai-label="Save changes"
        data-ai-state={hook.updateMutation.isPending ? 'loading' : 'idle'}
      >
        {hook.updateMutation.isPending ? 'Saving...' : 'Save changes'}
      </Button>
      <Button
        variant="ghost"
        type="button"
        onClick={hook.navigateToSource}
        data-ai-id="edit-source-cancel"
        data-ai-role="button"
        data-ai-label="Cancel"
      >
        Cancel
      </Button>
    </div>
  </form>
);

const DeleteSourceSection = ({ hook }: { hook: EditHook }): React.ReactNode => (
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
    {hook.confirmDelete ? (
      <div className="flex items-center gap-3">
        <Button
          variant="destructive"
          size="sm"
          disabled={hook.deleteMutation.isPending}
          onClick={() => hook.deleteMutation.mutate()}
          data-ai-id="edit-source-confirm-delete"
          data-ai-role="button"
          data-ai-label="Confirm delete"
          data-ai-state={hook.deleteMutation.isPending ? 'loading' : 'idle'}
        >
          {hook.deleteMutation.isPending ? 'Deleting...' : 'Yes, delete'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => hook.setConfirmDelete(false)}
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
        onClick={() => hook.setConfirmDelete(true)}
        data-ai-id="edit-source-delete"
        data-ai-role="button"
        data-ai-label="Delete source"
      >
        Delete source
      </Button>
    )}
  </div>
);

const Route = createFileRoute('/sources/$sourceId/edit')({
  component: EditSourcePage,
});

export { Route };
