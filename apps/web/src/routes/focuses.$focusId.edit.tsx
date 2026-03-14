import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { useAuthHeaders, queryKeys } from '../api/api.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Textarea } from '../components/textarea.tsx';
import { Button } from '../components/button.tsx';
import { Separator } from '../components/separator.tsx';
import { IconPicker } from '../components/icon-picker.tsx';
import { SourceSelectionList } from '../views/focuses/source-selection.tsx';
import type { Source } from '../views/focuses/source-selection.tsx';
import {
  useEditFocusData,
  useEditFocusForm,
  applyFocusUpdates,
  confidenceHint,
} from '../hooks/focuses/focuses.edit-route-hooks.ts';
import type { EditFocusFormResult } from '../hooks/focuses/focuses.edit-route-hooks.ts';

/* ---- Main page ---- */

const EditFocusPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { focusId } = Route.useParams();
  const [error, setError] = useState<string | null>(null);

  const { focus, loadingFocus, focusError, allSources, loadingSources } = useEditFocusData(focusId, headers);
  const form = useEditFocusForm(focus);

  const updateFocus = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!focus) {
        return;
      }
      await applyFocusUpdates({
        focus,
        focusId,
        name: form.name,
        description: form.description,
        icon: form.icon,
        minConfidence: form.minConfidence,
        minReadingTime: form.minReadingTime,
        maxReadingTime: form.maxReadingTime,
        selectedSources: form.selectedSources,
        headers,
      });
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.detail(focusId) });
      await navigate({ to: '/focuses/$focusId', params: { focusId } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  if (!headers) {
    return null;
  }
  if (loadingFocus || loadingSources) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading…</div>;
  }
  if (!focus || focusError) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? 'Focus not found'}</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    updateFocus.mutate();
  };

  return (
    <EditFocusFormLayout
      form={form}
      allSources={allSources}
      error={error}
      isPending={updateFocus.isPending}
      onSubmit={handleSubmit}
      onCancel={() => void navigate({ to: '/focuses/$focusId', params: { focusId } })}
    />
  );
};

/* ---- Form layout ---- */

const EditFocusFormLayout = ({
  form,
  allSources,
  error,
  isPending,
  onSubmit,
  onCancel,
}: {
  form: EditFocusFormResult;
  allSources: Source[];
  error: string | null;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
}): React.ReactNode => (
  <>
    <PageHeader title="Edit topic" />

    {error && (
      <div
        className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
        data-ai-id="edit-focus-error"
        data-ai-role="error"
        data-ai-error={error}
      >
        {error}
      </div>
    )}

    <form
      onSubmit={onSubmit}
      className="max-w-lg flex flex-col gap-6"
      data-ai-id="edit-focus-form"
      data-ai-role="form"
      data-ai-label="Edit focus form"
    >
      <EditFocusFields form={form} />
      <Separator soft />
      <SourceSelectionList
        allSources={allSources}
        selectedSources={form.selectedSources}
        selectedIds={form.selectedIds}
        onToggle={form.toggleSource}
        onChangeMode={form.changeMode}
        onChangeWeight={form.changeWeight}
        onChangeMinConfidence={form.changeMinConfidence}
        idPrefix="edit-focus"
      />
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          type="submit"
          disabled={isPending}
          data-ai-id="edit-focus-submit"
          data-ai-role="button"
          data-ai-label="Save changes"
          data-ai-state={isPending ? 'loading' : 'idle'}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={onCancel}
          data-ai-id="edit-focus-cancel"
          data-ai-role="button"
          data-ai-label="Cancel"
        >
          Cancel
        </Button>
      </div>
    </form>
  </>
);

/* ---- Form fields ---- */

const EditFocusFields = ({ form }: { form: EditFocusFormResult }): React.ReactNode => (
  <div className="flex flex-col gap-5">
    <Input
      label="Name"
      required
      value={form.name}
      onChange={(e) => form.setName(e.target.value)}
      data-ai-id="edit-focus-name"
      data-ai-role="input"
      data-ai-label="Focus name"
      data-ai-value={form.name}
    />
    <Textarea
      label="Description"
      description="Helps the app recognise which articles belong here — the more specific, the better."
      rows={2}
      value={form.description}
      onChange={(e) => form.setDescription(e.target.value)}
      data-ai-id="edit-focus-description"
      data-ai-role="input"
      data-ai-label="Focus description"
      data-ai-value={form.description}
    />
    <IconPicker value={form.icon} onChange={form.setIcon} />
    <ConfidenceSlider value={form.minConfidence} onChange={form.setMinConfidence} />
    <ReadingTimeRange
      min={form.minReadingTime}
      max={form.maxReadingTime}
      onMinChange={form.setMinReadingTime}
      onMaxChange={form.setMaxReadingTime}
    />
  </div>
);

/* ---- Confidence slider ---- */

const ConfidenceSlider = ({ value, onChange }: { value: number; onChange: (v: number) => void }): React.ReactNode => (
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
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="text-sm text-ink-secondary tabular-nums w-24 text-right">
        {value === 0 ? 'All articles' : `${value}% — ${confidenceHint(value)}`}
      </span>
    </div>
  </div>
);

/* ---- Reading time range ---- */

const ReadingTimeRange = ({
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}): React.ReactNode => (
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
        value={min}
        onChange={(e) => onMinChange(e.target.value)}
        className="flex-1"
      />
      <span className="text-xs text-ink-tertiary">to</span>
      <Input
        placeholder="Max"
        type="number"
        min={0}
        value={max}
        onChange={(e) => onMaxChange(e.target.value)}
        className="flex-1"
      />
      <span className="text-xs text-ink-tertiary whitespace-nowrap">minutes</span>
    </div>
  </div>
);

const Route = createFileRoute('/focuses/$focusId/edit')({
  component: EditFocusPage,
});

export { Route };
