import { createFileRoute } from '@tanstack/react-router';

import { useCreateSource } from '../hooks/sources/sources.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';

const NewSourcePage = (): React.ReactNode => {
  const { form, createMutation, handleSubmit, navigateToSources, ready } = useCreateSource();

  if (!ready) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Add source"
        subtitle={form.sourceType === 'podcast' ? 'Add a podcast feed' : 'Add a new RSS feed to your collection'}
      />

      {form.error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="source-form-error"
          data-ai-role="error"
          data-ai-error={form.error}
        >
          {form.error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-md flex flex-col gap-5"
        data-ai-id="source-form"
        data-ai-role="form"
        data-ai-label="New source form"
      >
        <SourceTypeSelector sourceType={form.sourceType} onSelect={form.setSourceType} />
        <SourceFormFields form={form} />
        <div className="flex items-center gap-3 mt-2">
          <Button
            variant="primary"
            type="submit"
            disabled={createMutation.isPending}
            data-ai-id="source-submit"
            data-ai-role="button"
            data-ai-label="Add source"
            data-ai-state={createMutation.isPending ? 'loading' : 'idle'}
          >
            {createMutation.isPending ? 'Adding...' : 'Add source'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={navigateToSources}
            data-ai-id="source-cancel"
            data-ai-role="button"
            data-ai-label="Cancel"
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};

const SourceTypeSelector = ({
  sourceType,
  onSelect,
}: {
  sourceType: string;
  onSelect: (t: 'rss' | 'podcast') => void;
}): React.ReactNode => (
  <div>
    <label className="block text-sm font-medium text-ink mb-1.5">Type</label>
    <div className="flex gap-2">
      {(['rss', 'podcast'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onSelect(t)}
          data-ai-id={`source-type-${t}`}
          data-ai-role="button"
          data-ai-label={t === 'rss' ? 'RSS Feed' : 'Podcast'}
          data-ai-state={sourceType === t ? 'selected' : 'idle'}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors duration-fast cursor-pointer ${sourceType === t ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-ink-secondary hover:border-ink-faint'}`}
        >
          {t === 'rss' ? 'RSS Feed' : 'Podcast'}
        </button>
      ))}
    </div>
  </div>
);

type SourceForm = {
  sourceType: string;
  name: string;
  setName: (v: string) => void;
  url: string;
  setUrl: (v: string) => void;
  direction: string;
  setDirection: (v: string) => void;
};

const SourceFormFields = ({ form }: { form: SourceForm }): React.ReactNode => (
  <>
    <Input
      label="Name"
      placeholder={form.sourceType === 'podcast' ? 'My Favorite Podcast' : 'My Favorite Blog'}
      required
      value={form.name}
      onChange={(e) => form.setName(e.target.value)}
      data-ai-id="source-name"
      data-ai-role="input"
      data-ai-label="Source name"
      data-ai-value={form.name}
    />
    <Input
      label="Feed URL"
      type="url"
      placeholder="https://example.com/feed.xml"
      required
      value={form.url}
      onChange={(e) => form.setUrl(e.target.value)}
      data-ai-id="source-url"
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
        data-ai-id="source-direction"
        data-ai-role="input"
        data-ai-label="Direction"
        data-ai-value={form.direction}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first (series)</option>
      </select>
      <p className="text-xs text-ink-tertiary mt-1">
        Use "Oldest first" for serialized content that should be consumed in order.
      </p>
    </div>
  </>
);

const Route = createFileRoute('/sources/new')({
  component: NewSourcePage,
});

export { Route };
