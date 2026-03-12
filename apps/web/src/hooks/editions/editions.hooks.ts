import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { useFormPopulation } from '../utilities/use-form-population.ts';

import { mapFocusesToPayload } from './editions.utils.ts';
import type { EditionConfig, EditionSummary, FocusConfig, Focus } from './editions.types.ts';

/* ── useEditionConfigs ────────────────────────────────────────────── */

type UseEditionConfigsReturn = {
  configs: EditionConfig[];
  loading: boolean;
  deletingId: string | null;
  handleDelete: (id: string, name: string) => void;
};

const useEditionConfigs = (): UseEditionConfigsReturn => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDelete = (id: string, name: string): void => {
    if (!confirm(`Delete "${name}"? This will also delete all generated editions.`)) {
      return;
    }
    setDeletingId(id);
    deleteMutation.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  return {
    configs: configsQuery.data ?? [],
    loading: configsQuery.isLoading,
    deletingId,
    handleDelete,
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
    mutationFn: async (): Promise<void> => {
      const { error: err } = await client.POST('/api/editions/configs', {
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
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: '/editions' });
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

/* ── useEditEditionConfig helpers ─────────────────────────────────── */

type EditConfigFields = {
  name: string;
  icon: string | null;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
};

const buildEditConfigPatch = (
  config: EditionConfig,
  fields: EditConfigFields,
  selectedFocuses: FocusConfig[],
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (fields.name !== config.name) {
    body.name = fields.name;
  }
  if (fields.icon !== config.icon) {
    body.icon = fields.icon;
  }
  if (fields.schedule !== config.schedule) {
    body.schedule = fields.schedule;
  }
  if (fields.lookbackHours !== config.lookbackHours) {
    body.lookbackHours = fields.lookbackHours;
  }
  if (fields.excludePriorEditions !== config.excludePriorEditions) {
    body.excludePriorEditions = fields.excludePriorEditions;
  }
  if (fields.enabled !== config.enabled) {
    body.enabled = fields.enabled;
  }

  const focusesChanged = JSON.stringify(selectedFocuses) !== JSON.stringify(mapFocusesToPayload(config.focuses));

  if (focusesChanged) {
    body.focuses = mapFocusesToPayload(selectedFocuses);
  }

  return body;
};

/* ── useEditEditionConfig ─────────────────────────────────────────── */

type UseEditEditionConfigReturn = {
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
  enabled: boolean;
  setEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  loading: boolean;
  config: EditionConfig | null;
  focusSelection: UseEditionFocusSelectionReturn;
  isPending: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleCancel: () => void;
};

const useEditEditionConfig = (configId: string): UseEditEditionConfigReturn => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [schedule, setSchedule] = useState('');
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const focusSelection = useEditionFocusSelection();

  const configQuery = useQuery({
    queryKey: queryKeys.editions.config(configId),
    queryFn: async (): Promise<EditionConfig> => {
      const { data, error: err } = await client.GET('/api/editions/configs/{configId}', {
        params: { path: { configId } },
        headers,
      });
      if (err) {
        throw new Error('Edition config not found');
      }
      return data as unknown as EditionConfig;
    },
    enabled: !!headers,
  });

  useFormPopulation(
    configQuery.data,
    useCallback((c: EditionConfig): void => {
      setName(c.name);
      setIcon(c.icon);
      setSchedule(c.schedule);
      setLookbackHours(c.lookbackHours);
      setExcludePriorEditions(c.excludePriorEditions);
      setEnabled(c.enabled);
      focusSelection.setSelectedFocuses(mapFocusesToPayload(c.focuses));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<void> => {
      const { error: err } = await client.PATCH('/api/editions/configs/{configId}', {
        params: { path: { configId } },
        body,
        headers,
      });
      if (err) {
        throw new Error('Failed to update edition config');
      }
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.config(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: '/editions/$configId', params: { configId } });
    },
    onError: (err: Error): void => setError(err.message),
  });

  const config = configQuery.data ?? null;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    if (!config) {
      return;
    }
    const body = buildEditConfigPatch(
      config,
      { name, icon, schedule, lookbackHours, excludePriorEditions, enabled },
      focusSelection.selectedFocuses,
    );
    if (Object.keys(body).length === 0) {
      void navigate({ to: '/editions/$configId', params: { configId } });
      return;
    }
    updateMutation.mutate(body);
  };

  const handleCancel = (): void => {
    void navigate({ to: '/editions/$configId', params: { configId } });
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
    enabled,
    setEnabled,
    error,
    loading: configQuery.isLoading || focusSelection.focusesLoading,
    config,
    focusSelection,
    isPending: updateMutation.isPending,
    handleSubmit,
    handleCancel,
  };
};

/* ── useEditionConfigDetail ───────────────────────────────────────── */

type UseEditionConfigDetailReturn = {
  config: EditionConfig | null;
  editions: EditionSummary[];
  filtered: EditionSummary[];
  loading: boolean;
  error: string | null;
  readFilter: 'unread' | 'all' | 'read';
  setReadFilter: React.Dispatch<React.SetStateAction<'unread' | 'all' | 'read'>>;
  generatePending: boolean;
  handleGenerate: () => void;
  handleDeleteEdition: (editionId: string, title: string) => void;
  configError: Error | null;
};

const filterEditions = (editions: EditionSummary[], readFilter: 'unread' | 'all' | 'read'): EditionSummary[] =>
  editions.filter((e) => {
    if (readFilter === 'unread') {
      return !e.readAt;
    }
    if (readFilter === 'read') {
      return !!e.readAt;
    }
    return true;
  });

const useEditionConfigDetail = (configId: string): UseEditionConfigDetailReturn => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<'unread' | 'all' | 'read'>('unread');

  const configQuery = useQuery({
    queryKey: queryKeys.editions.config(configId),
    queryFn: async (): Promise<EditionConfig> => {
      const { data, error: err } = await client.GET('/api/editions/configs/{configId}', {
        params: { path: { configId } },
        headers,
      });
      if (err) {
        throw new Error('Edition config not found');
      }
      return data as EditionConfig;
    },
    enabled: !!headers,
  });

  const editionsQuery = useQuery({
    queryKey: queryKeys.editions.forConfig(configId),
    queryFn: async (): Promise<EditionSummary[]> => {
      const { data } = await client.GET('/api/editions/configs/{configId}/editions', {
        params: { path: { configId } },
        headers,
      });
      return (data ?? []) as EditionSummary[];
    },
    enabled: !!headers,
  });

  const generateMutation = useMutation({
    mutationFn: async (): Promise<{ id: string }> => {
      const { data, error: err } = await client.POST('/api/editions/configs/{configId}/generate', {
        params: { path: { configId } },
        headers,
      });
      if (err) {
        throw new Error('error' in err ? (err as { error: string }).error : 'Failed to generate edition');
      }
      return data as { id: string };
    },
    onSuccess: (data): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({
        to: '/editions/$configId/issues/$editionId',
        params: { configId, editionId: data.id },
      });
    },
    onError: (err: Error): void => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (editionId: string): Promise<string> => {
      await client.DELETE('/api/editions/{editionId}', {
        params: { path: { editionId } },
        headers,
      });
      return editionId;
    },
    onMutate: async (editionId): Promise<{ previous: EditionSummary[] | undefined }> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      const previous = queryClient.getQueryData<EditionSummary[]>(queryKeys.editions.forConfig(configId));
      queryClient.setQueryData<EditionSummary[]>(
        queryKeys.editions.forConfig(configId),
        (old) => old?.filter((e) => e.id !== editionId) ?? [],
      );
      return { previous };
    },
    onError: (
      _err: unknown,
      _editionId: string,
      context: { previous: EditionSummary[] | undefined } | undefined,
    ): void => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.editions.forConfig(configId), context.previous);
      }
    },
    onSettled: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
    },
  });

  const editions = editionsQuery.data ?? [];

  return {
    config: configQuery.data ?? null,
    editions,
    filtered: filterEditions(editions, readFilter),
    loading: configQuery.isLoading || editionsQuery.isLoading,
    error,
    readFilter,
    setReadFilter,
    generatePending: generateMutation.isPending,
    handleGenerate: (): void => {
      setError(null);
      generateMutation.mutate();
    },
    handleDeleteEdition: (editionId: string, title: string): void => {
      if (confirm(`Delete "${title}"?`)) {
        deleteMutation.mutate(editionId);
      }
    },
    configError: configQuery.error as Error | null,
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

export {
  useEditionConfigs,
  useEditionFocusSelection,
  useCreateEditionConfig,
  useEditEditionConfig,
  useEditionConfigDetail,
};
