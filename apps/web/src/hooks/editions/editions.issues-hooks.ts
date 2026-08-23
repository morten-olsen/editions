import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import type { ApiBody, ApiResponse, Page } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { usePagedQuery } from '../utilities/use-paged-query.ts';
import type { PagerControls } from '../utilities/use-paged-query.ts';

// --- Types ---

type IssuesPage = ApiResponse<'/api/editions/configs/{configId}/editions', 'get'>;
type Issue = IssuesPage['items'][number];

type SweepBody = ApiBody<'/api/editions/configs/{configId}/issues/sweep', 'post'>;
type SweepFilter = SweepBody['filter'];
type SweepAction = SweepBody['action'];

type ReadFilter = 'unread' | 'all';

type UseIssuesResult = {
  issues: Issue[];
  total: number;
  isLoading: boolean;
  configName: string | undefined;
  readFilter: ReadFilter;
  setReadFilter: (filter: ReadFilter) => void;
  pagination: PagerControls;
  runSweep: (params: { filter: SweepFilter; action: SweepAction }) => void;
  sweepPending: boolean;
  sweepResult: { action: SweepAction; affected: number } | null;
  clearSweepResult: () => void;
  deleteIssue: (editionId: string) => void;
  deletingId: string | null;
};

const PAGE_SIZE = 20;

// --- Mutations ---

const useSweepMutation = ({
  configId,
  headers,
  onDone,
}: {
  configId: string;
  headers: Record<string, string> | undefined;
  onDone: (result: { action: SweepAction; affected: number }) => void;
}): ReturnType<typeof useMutation<number, Error, { filter: SweepFilter; action: SweepAction }>> =>
  useMutation({
    mutationFn: async ({ filter, action }): Promise<number> => {
      const { data, error: err } = await client.POST('/api/editions/configs/{configId}/issues/sweep', {
        params: { path: { configId } },
        body: { filter, action },
        headers,
      });
      if (err || !data) {
        throw new Error((err as { error?: string } | undefined)?.error ?? 'Clean-up failed');
      }
      return data.affected;
    },
    onSuccess: (affected, { action }): void => onDone({ action, affected }),
  });

const useDeleteIssueMutation = ({
  headers,
  onSettled,
  setDeletingId,
}: {
  headers: Record<string, string> | undefined;
  onSettled: () => void;
  setDeletingId: (id: string | null) => void;
}): ReturnType<typeof useMutation<void, Error, string>> =>
  useMutation({
    mutationFn: async (editionId: string): Promise<void> => {
      await client.DELETE('/api/editions/{editionId}', { params: { path: { editionId } }, headers });
    },
    onMutate: (editionId: string) => setDeletingId(editionId),
    onSettled: (): void => {
      setDeletingId(null);
      onSettled();
    },
  });

// --- Hook ---

const useIssues = (configId: string): UseIssuesResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [readFilter, setReadFilterValue] = useState<ReadFilter>('unread');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sweepResult, setSweepResult] = useState<{ action: SweepAction; affected: number } | null>(null);

  // The heading comes from the config, not from the first row: a filtered or
  // out-of-range page can be empty while the config still has a name.
  const { data: config } = useQuery({
    queryKey: queryKeys.editions.config(configId),
    queryFn: async (): Promise<{ name: string } | undefined> => {
      const { data } = await client.GET('/api/editions/configs/{configId}', {
        params: { path: { configId } },
        headers,
      });
      return data;
    },
    enabled: !!headers,
  });

  const paged = usePagedQuery<Issue>({
    queryKey: (offset) => [...queryKeys.editions.forConfig(configId), { readFilter, offset }],
    fetchPage: async ({ offset, limit }): Promise<Page<Issue>> => {
      const { data } = await client.GET('/api/editions/configs/{configId}/editions', {
        params: {
          path: { configId },
          query: { offset, limit, ...(readFilter === 'unread' ? { read: 'false' as const } : {}) },
        },
        headers,
      });
      return data as Page<Issue>;
    },
    pageSize: PAGE_SIZE,
    enabled: !!headers,
  });

  const invalidate = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
  }, [queryClient, configId]);

  const setReadFilter = useCallback(
    (filter: ReadFilter): void => {
      setReadFilterValue(filter);
      paged.pagination.reset();
    },
    [paged.pagination],
  );

  const sweepMutation = useSweepMutation({
    configId,
    headers,
    onDone: (result): void => {
      setSweepResult(result);
      invalidate();
    },
  });

  const deleteMutation = useDeleteIssueMutation({ headers, onSettled: invalidate, setDeletingId });

  return {
    issues: paged.items,
    total: paged.total,
    isLoading: paged.isLoading,
    configName: config?.name,
    readFilter,
    setReadFilter,
    pagination: paged.pagination,
    runSweep: sweepMutation.mutate,
    sweepPending: sweepMutation.isPending,
    sweepResult,
    clearSweepResult: useCallback((): void => setSweepResult(null), []),
    deleteIssue: deleteMutation.mutate,
    deletingId,
  };
};

/**
 * How many issues the given filter would touch. Runs the same selection the
 * sweep runs, so the number the user confirms is the number that gets acted on.
 */
const useSweepPreview = (configId: string, filter: SweepFilter, enabled: boolean): number | undefined => {
  const headers = useAuthHeaders();

  const { data } = useQuery({
    queryKey: [...queryKeys.editions.forConfig(configId), 'sweep-preview', filter],
    queryFn: async (): Promise<number> => {
      const { data: result } = await client.POST('/api/editions/configs/{configId}/issues/sweep/preview', {
        params: { path: { configId } },
        // The action doesn't affect the count, but preview and sweep share one
        // body type — that shared shape is what keeps them in step.
        body: { filter, action: 'mark-read' },
        headers,
      });
      return result?.affected ?? 0;
    },
    enabled: !!headers && enabled,
  });

  return data;
};

export type { Issue, IssuesPage, ReadFilter, SweepAction, SweepFilter, UseIssuesResult };
export { useIssues, useSweepPreview, PAGE_SIZE };
