import { createFileRoute } from '@tanstack/react-router';

import { useCreateEditionConfig } from '../hooks/editions/editions.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';

const NewEditionConfigPage = (): React.ReactNode => {
  const hook = useCreateEditionConfig();

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="New edition" subtitle="Give it a name — you'll configure schedule, topics, and budgets next" />

      {hook.error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="edition-error"
          data-ai-role="error"
          data-ai-error={hook.error}
        >
          {hook.error}
        </div>
      )}

      <form
        onSubmit={hook.handleSubmit}
        className="max-w-lg flex flex-col gap-6"
        data-ai-id="edition-form"
        data-ai-role="form"
        data-ai-label="New edition form"
      >
        <Input
          label="Name"
          placeholder="Morning Briefing"
          required
          value={hook.name}
          onChange={(e) => hook.setName(e.target.value)}
          data-ai-id="edition-name"
          data-ai-role="input"
          data-ai-label="Edition name"
          data-ai-value={hook.name}
        />

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            type="submit"
            disabled={hook.isPending}
            data-ai-id="edition-submit"
            data-ai-role="button"
            data-ai-label="Create edition"
            data-ai-state={hook.isPending ? 'loading' : 'idle'}
          >
            {hook.isPending ? 'Creating…' : 'Create edition'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={hook.handleCancel}
            data-ai-id="edition-cancel"
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

const Route = createFileRoute('/editions/new')({
  component: NewEditionConfigPage,
});

export { Route };
