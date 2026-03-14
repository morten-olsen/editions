import { createFileRoute } from '@tanstack/react-router';

import { useCreateFocus, confidenceHint } from '../hooks/focuses/focuses.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Textarea } from '../components/textarea.tsx';
import { Button } from '../components/button.tsx';
import { Separator } from '../components/separator.tsx';
import { IconPicker } from '../components/icon-picker.tsx';
import { SourceSelectionList } from '../views/focuses/source-selection.tsx';

const NewFocusPage = (): React.ReactNode => {
  const hook = useCreateFocus();
  const { sourceSelection } = hook;

  if (!hook.headers) {
    return null;
  }

  if (sourceSelection.loadingSources) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading…</div>;
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    hook.submit();
  };

  return (
    <>
      <PageHeader title="New topic" subtitle="A topic that shapes what appears in your editions" />

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
        <NewFocusFields hook={hook} />
        <Separator soft />
        <SourceSelectionList
          allSources={sourceSelection.allSources}
          selectedSources={sourceSelection.selectedSources}
          selectedIds={sourceSelection.selectedIds}
          onToggle={sourceSelection.toggleSource}
          onChangeMode={sourceSelection.changeMode}
          onChangeWeight={sourceSelection.changeWeight}
          onChangeMinConfidence={sourceSelection.changeMinConfidence}
          idPrefix="focus"
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
    </>
  );
};

type FocusHook = ReturnType<typeof useCreateFocus>;

const NewFocusFields = ({ hook }: { hook: FocusHook }): React.ReactNode => (
  <div className="flex flex-col gap-5">
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
      description="Helps the app recognise which articles belong here — the more specific, the better."
      placeholder="News about software, startups, and the tech industry"
      rows={2}
      value={hook.description}
      onChange={(e) => hook.setDescription(e.target.value)}
      data-ai-id="focus-description"
      data-ai-role="input"
      data-ai-label="Focus description"
      data-ai-value={hook.description}
    />
    <IconPicker value={hook.icon} onChange={hook.setIcon} />

    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">How closely articles must match</label>
      <p className="text-xs text-ink-tertiary -mt-0.5">
        Raise this to only include articles that are clearly a strong match. At 0%, anything potentially relevant is
        included.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={hook.minConfidence}
          onChange={(e) => hook.setMinConfidence(Number(e.target.value))}
          className="flex-1 accent-accent"
        />
        <span className="text-sm text-ink-secondary tabular-nums w-24 text-right">
          {hook.minConfidence === 0 ? 'All articles' : `${hook.minConfidence}% — ${confidenceHint(hook.minConfidence)}`}
        </span>
      </div>
    </div>

    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">Reading time</label>
      <p className="text-xs text-ink-tertiary -mt-0.5">
        Only include articles within this length. Leave blank for any length.
      </p>
      <div className="flex items-center gap-3">
        <Input
          placeholder="Min"
          type="number"
          min={0}
          value={hook.minReadingTime}
          onChange={(e) => hook.setMinReadingTime(e.target.value)}
          className="flex-1"
        />
        <span className="text-xs text-ink-tertiary">to</span>
        <Input
          placeholder="Max"
          type="number"
          min={0}
          value={hook.maxReadingTime}
          onChange={(e) => hook.setMaxReadingTime(e.target.value)}
          className="flex-1"
        />
        <span className="text-xs text-ink-tertiary whitespace-nowrap">minutes</span>
      </div>
    </div>
  </div>
);

const Route = createFileRoute('/focuses/new')({
  component: NewFocusPage,
});

export { Route };
