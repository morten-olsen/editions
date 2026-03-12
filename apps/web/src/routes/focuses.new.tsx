import { createFileRoute } from '@tanstack/react-router';

import { useCreateFocus, selectClasses, priorityLabel, confidenceHint } from '../hooks/focuses/focuses.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Textarea } from '../components/textarea.tsx';
import { Button } from '../components/button.tsx';
import { Checkbox } from '../components/checkbox.tsx';
import { Separator } from '../components/separator.tsx';
import { IconPicker } from '../components/icon-picker.tsx';

const NewFocusPage = (): React.ReactNode => {
  const {
    name,
    setName,
    description,
    setDescription,
    icon,
    setIcon,
    minConfidence,
    setMinConfidence,
    minReadingTime,
    setMinReadingTime,
    maxReadingTime,
    setMaxReadingTime,
    error,
    sourceSelection,
    isPending,
    submit,
    headers,
  } = useCreateFocus();

  const { allSources, loadingSources, selectedSources, selectedIds, toggleSource, changeMode, changeWeight } =
    sourceSelection;

  if (!headers) {
    return null;
  }

  if (loadingSources) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading…</div>;
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    submit();
  };

  return (
    <>
      <PageHeader title="New topic" subtitle="A topic that shapes what appears in your editions" />

      {error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="focus-form-error"
          data-ai-role="error"
          data-ai-error={error}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-lg flex flex-col gap-6"
        data-ai-id="focus-form"
        data-ai-role="form"
        data-ai-label="New focus form"
      >
        <div className="flex flex-col gap-5">
          <Input
            label="Name"
            placeholder="Technology"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-ai-id="focus-name"
            data-ai-role="input"
            data-ai-label="Focus name"
            data-ai-value={name}
          />
          <Textarea
            label="Description"
            description="Helps the app recognise which articles belong here — the more specific, the better."
            placeholder="News about software, startups, and the tech industry"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-ai-id="focus-description"
            data-ai-role="input"
            data-ai-label="Focus description"
            data-ai-value={description}
          />
          <IconPicker value={icon} onChange={setIcon} />

          {/* Match strength */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">How closely articles must match</label>
            <p className="text-xs text-ink-tertiary -mt-0.5">
              Raise this to only include articles that are clearly a strong match. At 0%, anything potentially relevant
              is included.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="text-sm text-ink-secondary tabular-nums w-24 text-right">
                {minConfidence === 0 ? 'All articles' : `${minConfidence}% — ${confidenceHint(minConfidence)}`}
              </span>
            </div>
          </div>

          {/* Reading time */}
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
                value={minReadingTime}
                onChange={(e) => setMinReadingTime(e.target.value)}
                className="flex-1"
              />
              <span className="text-xs text-ink-tertiary">to</span>
              <Input
                placeholder="Max"
                type="number"
                min={0}
                value={maxReadingTime}
                onChange={(e) => setMaxReadingTime(e.target.value)}
                className="flex-1"
              />
              <span className="text-xs text-ink-tertiary whitespace-nowrap">minutes</span>
            </div>
          </div>
        </div>

        <Separator soft />

        {/* Sources */}
        <div data-ai-id="focus-sources" data-ai-role="list" data-ai-label="Source selection">
          <div className="text-sm font-medium text-ink mb-0.5">Sources</div>
          <p className="text-xs text-ink-tertiary mb-4">
            Choose which sources feed this topic and how articles from each are selected.
          </p>
          {allSources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center">
              <p className="text-sm text-ink-tertiary">No sources yet.</p>
              <p className="text-xs text-ink-faint mt-1">You can add sources later.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {allSources.map((source) => {
                const isSelected = selectedIds.has(source.id);
                const selection = selectedSources.find((s) => s.sourceId === source.id);

                return (
                  <div
                    key={source.id}
                    className={`rounded-md transition-colors duration-fast ${isSelected ? 'bg-surface-sunken/50 p-3' : 'px-3 py-2'}`}
                    data-ai-id={`focus-source-${source.id}`}
                    data-ai-role="checkbox"
                    data-ai-label={source.name}
                    data-ai-state={isSelected ? 'checked' : 'unchecked'}
                  >
                    <div className="flex items-center justify-between">
                      <Checkbox
                        label={source.name}
                        checked={isSelected}
                        onCheckedChange={() => toggleSource(source.id)}
                      />
                      {isSelected && selection && (
                        <select
                          value={selection.mode}
                          onChange={(e) => changeMode(source.id, e.target.value as 'always' | 'match')}
                          className={selectClasses}
                          data-ai-id={`focus-source-${source.id}-mode`}
                          data-ai-role="input"
                          data-ai-label={`${source.name} article selection mode`}
                          data-ai-value={selection.mode}
                        >
                          <option value="always">All articles</option>
                          <option value="match">Matching only</option>
                        </select>
                      )}
                    </div>
                    {isSelected && selection && (
                      <div className="mt-2 pl-7 flex items-center gap-3">
                        <span className="text-xs text-ink-tertiary shrink-0">Priority</span>
                        <input
                          type="range"
                          min={0}
                          max={3}
                          step={0.1}
                          value={selection.weight}
                          onChange={(e) => changeWeight(source.id, Number(e.target.value))}
                          className="flex-1 accent-accent"
                          data-ai-id={`focus-source-${source.id}-weight`}
                          data-ai-role="input"
                          data-ai-label={`${source.name} priority`}
                          data-ai-value={String(selection.weight)}
                        />
                        <span className="text-xs font-medium text-ink-secondary tabular-nums w-12 text-right">
                          {priorityLabel(selection.weight)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            type="submit"
            disabled={isPending}
            data-ai-id="focus-submit"
            data-ai-role="button"
            data-ai-label="Create topic"
            data-ai-state={isPending ? 'loading' : 'idle'}
          >
            {isPending ? 'Creating…' : 'Create topic'}
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

const Route = createFileRoute('/focuses/new')({
  component: NewFocusPage,
});

export { Route };
