import { createFileRoute } from '@tanstack/react-router';

import { useCreateFocus } from '../hooks/focuses/focuses.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Textarea } from '../components/textarea.tsx';
import { Button } from '../components/button.tsx';

const NewFocusPage = (): React.ReactNode => {
  const hook = useCreateFocus();

  if (!hook.headers) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    hook.submit();
  };

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="New topic"
        subtitle="Give it a name and description — you'll configure sources and thresholds next"
      />

      {hook.error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="focus-form-error"
          data-ai-role="error"
          data-ai-error={hook.error}
        >
          {hook.error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-lg flex flex-col gap-6"
        data-ai-id="focus-form"
        data-ai-role="form"
        data-ai-label="New focus form"
      >
        <Input
          label="Name"
          placeholder="Technology"
          required
          value={hook.name}
          onChange={(e) => hook.setName(e.target.value)}
          data-ai-id="focus-name"
          data-ai-role="input"
          data-ai-label="Focus name"
          data-ai-value={hook.name}
        />
        <Textarea
          label="Description"
          description="Helps the classifier recognise which articles belong here — the more specific, the better."
          placeholder="News about software, startups, and the tech industry"
          rows={2}
          value={hook.description}
          onChange={(e) => hook.setDescription(e.target.value)}
          data-ai-id="focus-description"
          data-ai-role="input"
          data-ai-label="Focus description"
          data-ai-value={hook.description}
        />

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            type="submit"
            disabled={hook.isPending}
            data-ai-id="focus-submit"
            data-ai-role="button"
            data-ai-label="Create topic"
            data-ai-state={hook.isPending ? 'loading' : 'idle'}
          >
            {hook.isPending ? 'Creating…' : 'Create topic'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void globalThis.history.back()}
            data-ai-id="focus-cancel"
            data-ai-role="button"
            data-ai-label="Cancel"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

const Route = createFileRoute('/focuses/new')({
  component: NewFocusPage,
});

export { Route };
