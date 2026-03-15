import { useQuery } from '@tanstack/react-query';

import { useAuthHeaders } from '../../api/api.hooks.ts';

import type { SourceSelection } from './focuses.types.ts';

/* ── Types ───────────────────────────────────────────────────────── */

const PREVIEW_PAGE_SIZE = 20;

type PreviewTimeWindow = 'today' | 'week' | 'all';

type PreviewArticle = {
  id: string;
  title: string;
  sourceName: string;
  author: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  confidence: number;
};

type PreviewConfig = {
  minConfidence: number;
  minConsumptionTimeSeconds: number | null;
  maxConsumptionTimeSeconds: number | null;
  sources: SourceSelection[];
};

type PreviewPage = {
  articles: PreviewArticle[];
  total: number;
};

type UseFocusPreviewResult = {
  articles: PreviewArticle[];
  total: number;
  isLoading: boolean;
  error: Error | null;
};

/* ── Time window → date range ────────────────────────────────────── */

const windowToRange = (window: PreviewTimeWindow): { from?: string; to?: string } => {
  if (window === 'all') {
    return {};
  }
  const now = new Date();
  if (window === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString() };
  }
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: start.toISOString() };
};

/* ── Hook ────────────────────────────────────────────────────────── */

const useFocusPreview = (
  focusId: string,
  config?: PreviewConfig,
  timeWindow: PreviewTimeWindow = 'all',
): UseFocusPreviewResult => {
  const headers = useAuthHeaders();

  const { data, isLoading, error } = useQuery({
    queryKey: ['focuses', focusId, 'preview', config, timeWindow],
    queryFn: async (): Promise<PreviewPage> => {
      const body = config
        ? {
            minConfidence: config.minConfidence,
            minConsumptionTimeSeconds: config.minConsumptionTimeSeconds,
            maxConsumptionTimeSeconds: config.maxConsumptionTimeSeconds,
            sources: config.sources,
          }
        : {};

      const range = windowToRange(timeWindow);
      const params = new URLSearchParams({ limit: String(PREVIEW_PAGE_SIZE), sort: 'top' });
      if (range.from) {
        params.set('from', range.from);
      }
      if (range.to) {
        params.set('to', range.to);
      }

      const res = await fetch(`/api/focuses/${focusId}/preview?${params.toString()}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error((errorBody as { error?: string }).error ?? `Preview failed (${res.status})`);
      }

      return (await res.json()) as PreviewPage;
    },
    enabled: !!headers && !!focusId,
    staleTime: 10_000,
  });

  return {
    articles: data?.articles ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error as Error | null,
  };
};

export type { PreviewArticle, PreviewConfig, PreviewTimeWindow, UseFocusPreviewResult };
export { useFocusPreview };
