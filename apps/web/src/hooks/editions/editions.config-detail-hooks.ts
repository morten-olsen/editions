import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { queryKeys } from '../../api/api.hooks.ts';

/* ── Types ────────────────────────────────────────────────────────── */

type EditionConfig = {
  id: string;
  name: string;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: {
    focusId: string;
    focusName: string;
    position: number;
    budgetType: 'time' | 'count';
    budgetValue: number;
  }[];
  createdAt: string;
  updatedAt: string;
};

type EditionSummary = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  configName: string;
};

/* ── Data hook ────────────────────────────────────────────────────── */

const useConfigDetailData = (
  configId: string,
  headers: Record<string, string> | undefined,
): {
  configQuery: ReturnType<typeof useQuery<EditionConfig>>;
  editionsQuery: ReturnType<typeof useQuery<EditionSummary[]>>;
} => {
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

  return { configQuery, editionsQuery };
};

/* ── Mutations hook ──────────────────────────────────────────────── */

const useConfigDetailMutations = (
  configId: string,
  headers: Record<string, string> | undefined,
): {
  error: string | null;
  isGenerating: boolean;
  handleGenerate: () => void;
  handleDeleteEdition: (editionId: string, title: string) => void;
} => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

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
    onSuccess: (data: { id: string }): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: '/editions/$configId/issues/$editionId', params: { configId, editionId: data.id } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (editionId: string): Promise<string> => {
      await client.DELETE('/api/editions/{editionId}', { params: { path: { editionId } }, headers });
      return editionId;
    },
    onMutate: async (editionId: string): Promise<{ previous: EditionSummary[] | undefined }> => {
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

  const handleGenerate = (): void => {
    setError(null);
    generateMutation.mutate();
  };

  const handleDeleteEdition = (editionId: string, title: string): void => {
    if (!confirm(`Delete "${title}"?`)) {
      return;
    }
    deleteMutation.mutate(editionId);
  };

  return { error, isGenerating: generateMutation.isPending, handleGenerate, handleDeleteEdition };
};

/* ── Helpers ──────────────────────────────────────────────────────── */

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

/* ── Exports ─────────────────────────────────────────────────────── */

export type { EditionConfig, EditionSummary };
export { useConfigDetailData, useConfigDetailMutations, filterEditions };
