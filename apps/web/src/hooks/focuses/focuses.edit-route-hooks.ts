import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { queryKeys } from '../../api/api.hooks.ts';
import type { FocusSource, Source } from '../../views/focuses/source-selection.tsx';

/* ── Types ────────────────────────────────────────────────────────── */

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

/* ── Data hook ────────────────────────────────────────────────────── */

const useEditFocusData = (
  focusId: string,
  headers: Record<string, string> | undefined,
): {
  focus: Focus | undefined;
  loadingFocus: boolean;
  focusError: boolean;
  allSources: Source[];
  loadingSources: boolean;
} => {
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

  return { focus, loadingFocus, focusError, allSources, loadingSources };
};

/* ── Form hook ────────────────────────────────────────────────────── */

type EditFocusFormResult = {
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
  selectedSources: FocusSource[];
  toggleSource: (sourceId: string) => void;
  changeMode: (sourceId: string, mode: 'always' | 'match') => void;
  changeWeight: (sourceId: string, weight: number) => void;
  selectedIds: Set<string>;
};

const useEditFocusForm = (focus: Focus | undefined): EditFocusFormResult => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [minReadingTime, setMinReadingTime] = useState('');
  const [maxReadingTime, setMaxReadingTime] = useState('');
  const [selectedSources, setSelectedSources] = useState<FocusSource[]>([]);
  const [formPopulated, setFormPopulated] = useState(false);

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

  return {
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
    selectedSources,
    toggleSource,
    changeMode,
    changeWeight,
    selectedIds,
  };
};

/* ── API helpers ──────────────────────────────────────────────────── */

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

/* ── Exports ──────────────────────────────────────────────────────── */

export type { Focus, EditFocusFormResult };
export { useEditFocusData, useEditFocusForm, applyFocusUpdates, confidenceHint };
