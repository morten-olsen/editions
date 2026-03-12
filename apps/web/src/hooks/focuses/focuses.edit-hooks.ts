import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import { useFormPopulation } from '../utilities/use-form-population.ts';

import { useFocusSourceSelection } from './focuses.hooks.ts';
import type { SourceSelection, FocusEditable } from './focuses.types.ts';
import type { UseFocusSourceSelectionResult } from './focuses.hooks.ts';

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

type EditFocusFields = {
  name: string;
  description: string;
  icon: string | null;
  minConfidence: number;
  minReadingTime: string;
  maxReadingTime: string;
};

const buildEditFocusPatch = (focus: FocusEditable, fields: EditFocusFields): Record<string, string | number | null> => {
  const patchBody: Record<string, string | number | null> = {};
  if (fields.name !== focus.name) {
    patchBody.name = fields.name;
  }
  const newDesc = fields.description.trim() || null;
  if (newDesc !== focus.description) {
    patchBody.description = newDesc;
  }
  if (fields.icon !== focus.icon) {
    patchBody.icon = fields.icon;
  }
  const newMinConfidence = fields.minConfidence / 100;
  if (newMinConfidence !== focus.minConfidence) {
    patchBody.minConfidence = newMinConfidence;
  }
  const newMinReading = fields.minReadingTime ? Number(fields.minReadingTime) * 60 : null;
  if (newMinReading !== focus.minConsumptionTimeSeconds) {
    patchBody.minConsumptionTimeSeconds = newMinReading;
  }
  const newMaxReading = fields.maxReadingTime ? Number(fields.maxReadingTime) * 60 : null;
  if (newMaxReading !== focus.maxConsumptionTimeSeconds) {
    patchBody.maxConsumptionTimeSeconds = newMaxReading;
  }
  return patchBody;
};

const haveSourcesChanged = (selected: SourceSelection[], original: SourceSelection[]): boolean =>
  JSON.stringify(selected.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId))) !==
  JSON.stringify(original.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId)));

// ---------------------------------------------------------------------------
// useEditFocusMutation
// ---------------------------------------------------------------------------

type EditFocusMutationDeps = {
  focusId: string;
  headers: Record<string, string> | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  navigate: ReturnType<typeof useNavigate>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  getFocus: () => FocusEditable | undefined;
  getFields: () => EditFocusFields;
  getSelectedSources: () => SourceSelection[];
};

const useEditFocusMutation = (deps: EditFocusMutationDeps): ReturnType<typeof useMutation<void, Error, void>> =>
  useMutation({
    mutationFn: async (): Promise<void> => {
      const focus = deps.getFocus();
      if (!focus) {
        return;
      }
      const patchBody = buildEditFocusPatch(focus, deps.getFields());
      const selectedSources = deps.getSelectedSources();
      const sourcesChanged = haveSourcesChanged(selectedSources, focus.sources);
      if (Object.keys(patchBody).length === 0 && !sourcesChanged) {
        return;
      }
      if (Object.keys(patchBody).length > 0) {
        const { error: err } = await client.PATCH('/api/focuses/{id}', {
          params: { path: { id: deps.focusId } },
          body: patchBody,
          headers: deps.headers,
        });
        if (err) {
          throw new Error('Failed to update focus');
        }
      }
      if (sourcesChanged) {
        const { error: err } = await client.PUT('/api/focuses/{id}/sources', {
          params: { path: { id: deps.focusId } },
          body: { sources: selectedSources },
          headers: deps.headers,
        });
        if (err) {
          throw new Error('Failed to update sources');
        }
      }
    },
    onSuccess: async (): Promise<void> => {
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all });
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.focuses.detail(deps.focusId) });
      await deps.navigate({ to: '/focuses/$focusId', params: { focusId: deps.focusId } });
    },
    onError: (err: Error): void => deps.setError(err.message),
  });

// ---------------------------------------------------------------------------
// useEditFocus
// ---------------------------------------------------------------------------

type UseEditFocusResult = {
  focus: FocusEditable | undefined;
  loadingFocus: boolean;
  focusError: boolean;
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  description: string;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  icon: string | null;
  setIcon: React.Dispatch<React.SetStateAction<string | null>>;
  minConfidence: number;
  setMinConfidence: React.Dispatch<React.SetStateAction<number>>;
  minReadingTime: string;
  setMinReadingTime: React.Dispatch<React.SetStateAction<string>>;
  maxReadingTime: string;
  setMaxReadingTime: React.Dispatch<React.SetStateAction<string>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  sourceSelection: UseFocusSourceSelectionResult;
  loading: boolean;
  isPending: boolean;
  submit: () => void;
  headers: Record<string, string> | undefined;
};

const useEditFocus = (focusId: string): UseEditFocusResult => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [minReadingTime, setMinReadingTime] = useState('');
  const [maxReadingTime, setMaxReadingTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sourceSelection = useFocusSourceSelection();

  const {
    data: focus,
    isLoading: loadingFocus,
    isError: focusError,
  } = useQuery({
    queryKey: queryKeys.focuses.detail(focusId),
    queryFn: async (): Promise<FocusEditable> => {
      const { data, error: err } = await client.GET('/api/focuses/{id}', {
        params: { path: { id: focusId } },
        headers,
      });
      if (err) {
        throw new Error('Focus not found');
      }
      return data as unknown as FocusEditable;
    },
    enabled: !!headers,
  });

  useFormPopulation(focus, (data) => {
    setName(data.name);
    setDescription(data.description ?? '');
    setIcon(data.icon);
    setMinConfidence(Math.round(data.minConfidence * 100));
    setMinReadingTime(data.minConsumptionTimeSeconds !== null ? String(data.minConsumptionTimeSeconds / 60) : '');
    setMaxReadingTime(data.maxConsumptionTimeSeconds !== null ? String(data.maxConsumptionTimeSeconds / 60) : '');
    sourceSelection.setSelectedSources(data.sources);
  });

  const updateMutation = useEditFocusMutation({
    focusId,
    headers,
    queryClient,
    navigate,
    setError,
    getFocus: () => focus,
    getFields: () => ({ name, description, icon, minConfidence, minReadingTime, maxReadingTime }),
    getSelectedSources: () => sourceSelection.selectedSources,
  });

  const submit = useCallback((): void => {
    setError(null);
    updateMutation.mutate();
  }, [updateMutation]);

  return {
    focus,
    loadingFocus,
    focusError,
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
    setError,
    sourceSelection,
    loading: loadingFocus || sourceSelection.loadingSources,
    isPending: updateMutation.isPending,
    submit,
    headers,
  };
};

export type { UseEditFocusResult };
export { useEditFocus };
