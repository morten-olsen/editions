import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { useAuthHeaders, queryKeys } from '../api/api.hooks.ts';
import { client } from '../api/api.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Textarea } from '../components/textarea.tsx';
import { Button } from '../components/button.tsx';
import { Separator } from '../components/separator.tsx';
import { IconPicker } from '../components/icon-picker.tsx';
import { SourceSelectionList } from '../views/focuses/source-selection.tsx';
import type { FocusSource, Source } from '../views/focuses/source-selection.tsx';

type Focus = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  minConfidence: number;
  minConsumptionTimeSeconds: number | null;
  maxConsumptionTimeSeconds: number | null;
  sources: FocusSource[];
};

const confidenceHint = (v: number): string => {
  if (v === 0) {
    return 'All articles';
  }
  if (v <= 30) {
    return 'Loose match';
  }
  if (v <= 60) {
    return 'Moderate';
  }
  if (v <= 80) {
    return 'Strong match';
  }
  return 'Exact match';
};

const EditFocusPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { focusId } = Route.useParams();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [minReadingTime, setMinReadingTime] = useState('');
  const [maxReadingTime, setMaxReadingTime] = useState('');
  const [selectedSources, setSelectedSources] = useState<FocusSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formPopulated, setFormPopulated] = useState(false);

  const {
    data: focus,
    isLoading: loadingFocus,
    isError: focusError,
  } = useQuery({
    queryKey: queryKeys.focuses.detail(focusId),
    queryFn: async (): Promise<Focus> => {
      const { data, error: err } = await client.GET('/api/focuses/{id}', {
        params: { path: { id: focusId } },
        headers,
      });
      if (err) {
        throw new Error('Focus not found');
      }
      return data as unknown as Focus;
    },
    enabled: !!headers,
  });

  const { data: allSources = [], isLoading: loadingSources } = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: async (): Promise<Source[]> => {
      const { data } = await client.GET('/api/sources', { headers });
      return (data as Source[]) ?? [];
    },
    enabled: !!headers,
  });

  useEffect(() => {
    if (focus && !formPopulated) {
      setName(focus.name);
      setDescription(focus.description ?? '');
      setIcon(focus.icon);
      setMinConfidence(Math.round(focus.minConfidence * 100));
      setMinReadingTime(focus.minConsumptionTimeSeconds !== null ? String(focus.minConsumptionTimeSeconds / 60) : '');
      setMaxReadingTime(focus.maxConsumptionTimeSeconds !== null ? String(focus.maxConsumptionTimeSeconds / 60) : '');
      setSelectedSources(focus.sources);
      setFormPopulated(true);
    }
  }, [focus, formPopulated]);

  const updateFocus = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!focus) {
        return;
      }
      await applyFocusUpdates({
        focus,
        focusId,
        name,
        description,
        icon,
        minConfidence,
        minReadingTime,
        maxReadingTime,
        selectedSources,
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

  const toggleSource = (sourceId: string): void => {
    setSelectedSources((prev) => {
      const existing = prev.find((s) => s.sourceId === sourceId);
      if (existing) {
        return prev.filter((s) => s.sourceId !== sourceId);
      }
      return [...prev, { sourceId, mode: 'always', weight: 1 }];
    });
  };

  const changeMode = (sourceId: string, mode: 'always' | 'match'): void => {
    setSelectedSources((prev) => prev.map((s) => (s.sourceId === sourceId ? { ...s, mode } : s)));
  };

  const changeWeight = (sourceId: string, weight: number): void => {
    setSelectedSources((prev) => prev.map((s) => (s.sourceId === sourceId ? { ...s, weight } : s)));
  };

  const selectedIds = new Set(selectedSources.map((s) => s.sourceId));

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    updateFocus.mutate();
  };

  return (
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
        onSubmit={handleSubmit}
        className="max-w-lg flex flex-col gap-6"
        data-ai-id="edit-focus-form"
        data-ai-role="form"
        data-ai-label="Edit focus form"
      >
        <EditFocusFields
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          icon={icon}
          setIcon={setIcon}
          minConfidence={minConfidence}
          setMinConfidence={setMinConfidence}
          minReadingTime={minReadingTime}
          setMinReadingTime={setMinReadingTime}
          maxReadingTime={maxReadingTime}
          setMaxReadingTime={setMaxReadingTime}
        />

        <Separator soft />

        <SourceSelectionList
          allSources={allSources}
          selectedSources={selectedSources}
          selectedIds={selectedIds}
          onToggle={toggleSource}
          onChangeMode={changeMode}
          onChangeWeight={changeWeight}
          idPrefix="edit-focus"
        />

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            type="submit"
            disabled={updateFocus.isPending}
            data-ai-id="edit-focus-submit"
            data-ai-role="button"
            data-ai-label="Save changes"
            data-ai-state={updateFocus.isPending ? 'loading' : 'idle'}
          >
            {updateFocus.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void navigate({ to: '/focuses/$focusId', params: { focusId } })}
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
};

/* ---- Form fields ---- */

const EditFocusFields = ({
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
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  icon: string | null;
  setIcon: (v: string | null) => void;
  minConfidence: number;
  setMinConfidence: (v: number) => void;
  minReadingTime: string;
  setMinReadingTime: (v: string) => void;
  maxReadingTime: string;
  setMaxReadingTime: (v: string) => void;
}): React.ReactNode => (
  <div className="flex flex-col gap-5">
    <Input
      label="Name"
      required
      value={name}
      onChange={(e) => setName(e.target.value)}
      data-ai-id="edit-focus-name"
      data-ai-role="input"
      data-ai-label="Focus name"
      data-ai-value={name}
    />
    <Textarea
      label="Description"
      description="Helps the app recognise which articles belong here — the more specific, the better."
      rows={2}
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      data-ai-id="edit-focus-description"
      data-ai-role="input"
      data-ai-label="Focus description"
      data-ai-value={description}
    />
    <IconPicker value={icon} onChange={setIcon} />

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
          value={minConfidence}
          onChange={(e) => setMinConfidence(Number(e.target.value))}
          className="flex-1 accent-accent"
        />
        <span className="text-sm text-ink-secondary tabular-nums w-24 text-right">
          {minConfidence === 0 ? 'All articles' : `${minConfidence}% — ${confidenceHint(minConfidence)}`}
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
);

/* ---- Apply focus updates (extracted to reduce mutation complexity) ---- */

const applyFocusUpdates = async ({
  focus,
  focusId,
  name,
  description,
  icon,
  minConfidence,
  minReadingTime,
  maxReadingTime,
  selectedSources,
  headers,
}: {
  focus: Focus;
  focusId: string;
  name: string;
  description: string;
  icon: string | null;
  minConfidence: number;
  minReadingTime: string;
  maxReadingTime: string;
  selectedSources: FocusSource[];
  headers: Record<string, string> | undefined;
}): Promise<void> => {
  const patchBody = buildFocusPatch(focus, { name, description, icon, minConfidence, minReadingTime, maxReadingTime });
  const sourcesChanged = checkSourcesChanged(selectedSources, focus.sources);

  if (Object.keys(patchBody).length === 0 && !sourcesChanged) {
    return;
  }

  if (Object.keys(patchBody).length > 0) {
    const { error: err } = await client.PATCH('/api/focuses/{id}', {
      params: { path: { id: focusId } },
      body: patchBody,
      headers,
    });
    if (err) {
      throw new Error('Failed to update focus');
    }
  }

  if (sourcesChanged) {
    const { error: err } = await client.PUT('/api/focuses/{id}/sources', {
      params: { path: { id: focusId } },
      body: { sources: selectedSources },
      headers,
    });
    if (err) {
      throw new Error('Failed to update sources');
    }
  }
};

const buildFocusPatch = (
  focus: Focus,
  state: {
    name: string;
    description: string;
    icon: string | null;
    minConfidence: number;
    minReadingTime: string;
    maxReadingTime: string;
  },
): Record<string, string | number | null> => {
  const patch: Record<string, string | number | null> = {};
  if (state.name !== focus.name) {
    patch.name = state.name;
  }
  const newDesc = state.description.trim() || null;
  if (newDesc !== focus.description) {
    patch.description = newDesc;
  }
  if (state.icon !== focus.icon) {
    patch.icon = state.icon;
  }
  const newMinConfidence = state.minConfidence / 100;
  if (newMinConfidence !== focus.minConfidence) {
    patch.minConfidence = newMinConfidence;
  }
  const newMinReading = state.minReadingTime ? Number(state.minReadingTime) * 60 : null;
  if (newMinReading !== focus.minConsumptionTimeSeconds) {
    patch.minConsumptionTimeSeconds = newMinReading;
  }
  const newMaxReading = state.maxReadingTime ? Number(state.maxReadingTime) * 60 : null;
  if (newMaxReading !== focus.maxConsumptionTimeSeconds) {
    patch.maxConsumptionTimeSeconds = newMaxReading;
  }
  return patch;
};

const checkSourcesChanged = (selected: FocusSource[], original: FocusSource[]): boolean =>
  JSON.stringify(selected.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId))) !==
  JSON.stringify(original.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId)));

const Route = createFileRoute('/focuses/$focusId/edit')({
  component: EditFocusPage,
});

export { Route };
