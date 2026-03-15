import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';

import { mapFocusesToPayload } from './editions.utils.ts';
import type { EditionConfig, FocusConfig, Focus } from './editions.types.ts';

/* ── useEditionConfigs ────────────────────────────────────────────── */

type UseEditionConfigsReturn = {
  configs: EditionConfig[];
  loading: boolean;
  deletingId: string | null;
  generatingId: string | null;
  handleDelete: (id: string, name: string) => void;
  handleGenerate: (id: string) => void;
};

const useEditionConfigs = (): UseEditionConfigsReturn => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const configsQuery = useQuery({
    queryKey: queryKeys.editions.configs,
    queryFn: async (): Promise<EditionConfig[]> => {
      const { data } = await client.GET('/api/editions/configs', { headers });
      return (data ?? []) as EditionConfig[];
    },
    enabled: !!headers,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await client.DELETE('/api/editions/configs/{configId}', {
        params: { path: { configId: id } },
        headers,
      });
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await client.POST('/api/editions/configs/{configId}/generate', {
        params: { path: { configId: id } },
        headers,
      });
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
    },
  });

  const handleDelete = (id: string, name: string): void => {
    if (!confirm(`Delete "${name}"? This will also delete all generated editions.`)) {
      return;
    }
    setDeletingId(id);
    deleteMutation.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  const handleGenerate = (id: string): void => {
    setGeneratingId(id);
    generateMutation.mutate(id, { onSettled: () => setGeneratingId(null) });
  };

  return {
    configs: configsQuery.data ?? [],
    loading: configsQuery.isLoading,
    deletingId,
    generatingId,
    handleDelete,
    handleGenerate,
  };
};

/* ── useEditionFocusSelection ─────────────────────────────────────── */

type UseEditionFocusSelectionReturn = {
  allFocuses: Focus[];
  focusesLoading: boolean;
  selectedFocuses: FocusConfig[];
  setSelectedFocuses: React.Dispatch<React.SetStateAction<FocusConfig[]>>;
  selectedIds: Set<string>;
  toggleFocus: (focusId: string) => void;
  updateFocusField: (
    focusId: string,
    field: 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight',
    value: string | number | boolean | null,
  ) => void;
  moveFocus: (focusId: string, direction: -1 | 1) => void;
};

const useEditionFocusSelection = (): UseEditionFocusSelectionReturn => {
  const headers = useAuthHeaders();
  const [selectedFocuses, setSelectedFocuses] = useState<FocusConfig[]>([]);

  const focusesQuery = useQuery({
    queryKey: queryKeys.focuses.all,
    queryFn: async (): Promise<Focus[]> => {
      const { data } = await client.GET('/api/focuses', { headers });
      return (data ?? []) as Focus[];
    },
    enabled: !!headers,
  });

  const selectedIds = new Set(selectedFocuses.map((f) => f.focusId));

  const toggleFocus = (focusId: string): void => {
    setSelectedFocuses((prev) => {
      const existing = prev.find((f) => f.focusId === focusId);
      if (existing) {
        return prev.filter((f) => f.focusId !== focusId);
      }
      return [
        ...prev,
        {
          focusId,
          position: prev.length,
          budgetType: 'count' as const,
          budgetValue: 5,
          lookbackHours: null,
          excludePriorEditions: null,
          weight: 1,
        },
      ];
    });
  };

  const updateFocusField = (
    focusId: string,
    field: 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight',
    value: string | number | boolean | null,
  ): void => {
    setSelectedFocuses((prev) => prev.map((f) => (f.focusId === focusId ? { ...f, [field]: value } : f)));
  };

  const moveFocus = (focusId: string, direction: -1 | 1): void => {
    setSelectedFocuses((prev) => {
      const idx = prev.findIndex((f) => f.focusId === focusId);
      if (idx < 0) {
        return prev;
      }
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) {
        return prev;
      }
      const arr = [...prev];
      const a = arr[idx];
      const b = arr[newIdx];
      if (!a || !b) {
        return prev;
      }
      arr[idx] = b;
      arr[newIdx] = a;
      return arr.map((f, i) => ({ ...f, position: i }));
    });
  };

  return {
    allFocuses: focusesQuery.data ?? [],
    focusesLoading: focusesQuery.isLoading,
    selectedFocuses,
    setSelectedFocuses,
    selectedIds,
    toggleFocus,
    updateFocusField,
    moveFocus,
  };
};

/* ── useCreateEditionConfig ───────────────────────────────────────── */

type UseCreateEditionConfigReturn = {
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  icon: string | null;
  setIcon: React.Dispatch<React.SetStateAction<string | null>>;
  schedule: string;
  setSchedule: React.Dispatch<React.SetStateAction<string>>;
  lookbackHours: number;
  setLookbackHours: React.Dispatch<React.SetStateAction<number>>;
  excludePriorEditions: boolean;
  setExcludePriorEditions: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  focusSelection: UseEditionFocusSelectionReturn;
  isPending: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleCancel: () => void;
};

const useCreateEditionConfig = (): UseCreateEditionConfigReturn => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [schedule, setSchedule] = useState('0 7 * * *');
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusSelection = useEditionFocusSelection();

  const createMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error: err } = await client.POST('/api/editions/configs', {
        body: {
          name,
          icon,
          schedule,
          lookbackHours,
          excludePriorEditions,
          focuses: mapFocusesToPayload(focusSelection.selectedFocuses),
        },
        headers,
      });
      if (err) {
        throw new Error('error' in err ? (err as { error: string }).error : 'Failed to create edition');
      }
      return (data as { id: string }).id;
    },
    onSuccess: (configId: string): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: '/editions/$configId/edit', params: { configId } });
    },
    onError: (err: Error): void => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  const handleCancel = (): void => {
    void navigate({ to: '/editions' });
  };

  return {
    name,
    setName,
    icon,
    setIcon,
    schedule,
    setSchedule,
    lookbackHours,
    setLookbackHours,
    excludePriorEditions,
    setExcludePriorEditions,
    error,
    focusSelection,
    isPending: createMutation.isPending,
    handleSubmit,
    handleCancel,
  };
};

/* ── Exports ──────────────────────────────────────────────────────── */

export type {
  VoteValue,
  EditionArticle,
  EditionDetail,
  FocusSection,
  EditionConfigFocus,
  EditionConfig,
  EditionSummary,
  FocusConfig,
  Focus,
  ViewMode,
} from './editions.types.ts';

export type { UseEditionFocusSelectionReturn };

export {
  SCHEDULE_PRESETS,
  selectClasses,
  priorityLabel,
  formatLookback,
  formatTime,
  groupByFocus,
  isPresetSchedule,
  scheduleSelectValue,
} from './editions.utils.ts';

export { useEditionView, useMagazineView } from './editions.view-hooks.ts';

export { useEditionConfigs, useEditionFocusSelection, useCreateEditionConfig };
