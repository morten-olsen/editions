import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { useFormPopulation } from '../utilities/use-form-population.ts';

import { mapFocusesToPayload } from './editions.utils.ts';
import type { EditionConfig, EditionSummary, FocusConfig } from './editions.types.ts';
import { useEditionFocusSelection } from './editions.hooks.ts';
import type { UseEditionFocusSelectionReturn } from './editions.hooks.ts';

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

type EditEditionConfigDeps = {
  headers: Record<string, string> | undefined;
  navigate: ReturnType<typeof useNavigate>;
  queryClient: ReturnType<typeof useQueryClient>;
  configId: string;
};

const useEditConfigQuery = (
  configId: string,
  headers: Record<string, string> | undefined,
): ReturnType<typeof useQuery<EditionConfig>> =>
  useQuery({
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

const useEditConfigMutation = (
  deps: EditEditionConfigDeps,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
): ReturnType<typeof useMutation<void, Error, Record<string, unknown>>> =>
  useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<void> => {
      const { error: err } = await client.PATCH('/api/editions/configs/{configId}', {
        params: { path: { configId: deps.configId } },
        body,
        headers: deps.headers,
      });
      if (err) {
        throw new Error('Failed to update edition config');
      }
    },
    onSuccess: (): void => {
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.editions.config(deps.configId) });
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void deps.navigate({ to: '/editions/$configId', params: { configId: deps.configId } });
    },
    onError: (err: Error): void => setError(err.message),
  });

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

  const configQuery = useEditConfigQuery(configId, headers);

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

  const deps: EditEditionConfigDeps = { headers, navigate, queryClient, configId };
  const updateMutation = useEditConfigMutation(deps, setError);

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

/* ── useEditionConfigDetail helpers ──────────────────────────────── */

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

type ConfigDetailDeps = {
  headers: Record<string, string> | undefined;
  navigate: ReturnType<typeof useNavigate>;
  queryClient: ReturnType<typeof useQueryClient>;
  configId: string;
};

const useGenerateMutation = (
  deps: ConfigDetailDeps,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
): ReturnType<typeof useMutation<{ id: string }, Error, void>> =>
  useMutation({
    mutationFn: async (): Promise<{ id: string }> => {
      const { data, error: err } = await client.POST('/api/editions/configs/{configId}/generate', {
        params: { path: { configId: deps.configId } },
        headers: deps.headers,
      });
      if (err) {
        throw new Error('error' in err ? (err as { error: string }).error : 'Failed to generate edition');
      }
      return data as { id: string };
    },
    onSuccess: (data): void => {
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(deps.configId) });
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void deps.navigate({
        to: '/editions/$configId/issues/$editionId',
        params: { configId: deps.configId, editionId: data.id },
      });
    },
    onError: (err: Error): void => setError(err.message),
  });

const useDeleteEditionMutation = (
  deps: ConfigDetailDeps,
): ReturnType<typeof useMutation<string, unknown, string, { previous: EditionSummary[] | undefined }>> =>
  useMutation({
    mutationFn: async (editionId: string): Promise<string> => {
      await client.DELETE('/api/editions/{editionId}', {
        params: { path: { editionId } },
        headers: deps.headers,
      });
      return editionId;
    },
    onMutate: async (editionId): Promise<{ previous: EditionSummary[] | undefined }> => {
      await deps.queryClient.cancelQueries({ queryKey: queryKeys.editions.forConfig(deps.configId) });
      const previous = deps.queryClient.getQueryData<EditionSummary[]>(queryKeys.editions.forConfig(deps.configId));
      deps.queryClient.setQueryData<EditionSummary[]>(
        queryKeys.editions.forConfig(deps.configId),
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
        deps.queryClient.setQueryData(queryKeys.editions.forConfig(deps.configId), context.previous);
      }
    },
    onSettled: (): void => {
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(deps.configId) });
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.nav });
    },
  });

/* ── useEditionConfigDetail ──────────────────────────────────────── */

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

  const deps: ConfigDetailDeps = { headers, navigate, queryClient, configId };
  const generateMutation = useGenerateMutation(deps, setError);
  const deleteMutation = useDeleteEditionMutation(deps);

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

export type { UseEditEditionConfigReturn, UseEditionConfigDetailReturn };

export { useEditEditionConfig, useEditionConfigDetail };
