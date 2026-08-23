import { useQuery } from '@tanstack/react-query';

import { useAuthHeaders } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import type { Page } from '../../api/api.ts';
import { windowToRange } from '../utilities/time-window.ts';
import type { TimeWindow } from '../utilities/time-window.ts';

import type { SourceSelection } from './focuses.types.ts';

/* ── Types ───────────────────────────────────────────────────────── */

const PREVIEW_PAGE_SIZE = 20;

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

type PreviewPage = Page<PreviewArticle>;

type UseFocusPreviewResult = {
  articles: PreviewArticle[];
  total: number;
  isLoading: boolean;
  error: Error | null;
};

/* ── Hook ────────────────────────────────────────────────────────── */

/**
 * The preview defaults to the whole archive rather than `DEFAULT_TIME_WINDOW`:
 * it exists to show what a focus configuration would catch overall, which a
 * one-day slice can't answer.
 */
const useFocusPreview = (
  focusId: string,
  config?: PreviewConfig,
  timeWindow: TimeWindow = 'all',
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

      const { data, error: err } = await client.POST('/api/focuses/{id}/preview', {
        params: {
          path: { id: focusId },
          query: { limit: PREVIEW_PAGE_SIZE, sort: 'top', ...windowToRange(timeWindow) },
        },
        body,
        headers,
      });

      if (err || !data) {
        throw new Error((err as { error?: string } | undefined)?.error ?? 'Preview failed');
      }

      return data as PreviewPage;
    },
    enabled: !!headers && !!focusId,
    staleTime: 10_000,
  });

  return {
    articles: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error as Error | null,
  };
};

export type { PreviewArticle, PreviewConfig, UseFocusPreviewResult };
export { useFocusPreview };
