import { useQuery } from '@tanstack/react-query';

import { useAuthHeaders } from '../../api/api.hooks.ts';

/* ── Types ───────────────────────────────────────────────────────── */

type PreviewArticle = {
  id: string;
  title: string;
  sourceName: string;
  consumptionTimeSeconds: number | null;
};

type PreviewSection = {
  focusName: string;
  articles: PreviewArticle[];
};

type EditionPreviewConfig = {
  lookbackHours: number;
  excludePriorEditions: boolean;
  focuses: {
    focusId: string;
    focusName: string;
    position: number;
    budgetType: 'time' | 'count';
    budgetValue: number;
    lookbackHours: number | null;
    excludePriorEditions: boolean | null;
    weight: number;
  }[];
};

type EditionPreviewPage = {
  sections: PreviewSection[];
  totalArticles: number;
  totalReadingMinutes: number;
};

type UseEditionPreviewResult = {
  sections: PreviewSection[];
  totalArticles: number;
  totalMinutes: number;
  isLoading: boolean;
  error: Error | null;
};

/* ── Hook ────────────────────────────────────────────────────────── */

const useEditionPreview = (configId: string, config?: EditionPreviewConfig): UseEditionPreviewResult => {
  const headers = useAuthHeaders();

  const { data, isLoading, error } = useQuery({
    queryKey: ['editions', configId, 'preview', config],
    queryFn: async (): Promise<EditionPreviewPage> => {
      const body = config
        ? {
            lookbackHours: config.lookbackHours,
            excludePriorEditions: config.excludePriorEditions,
            focuses: config.focuses,
          }
        : {};

      const res = await fetch(`/api/editions/configs/${configId}/preview`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error((errorBody as { error?: string }).error ?? `Preview failed (${res.status})`);
      }

      return (await res.json()) as EditionPreviewPage;
    },
    enabled: !!headers && !!configId,
    staleTime: 10_000,
  });

  return {
    sections: data?.sections ?? [],
    totalArticles: data?.totalArticles ?? 0,
    totalMinutes: data?.totalReadingMinutes ?? 0,
    isLoading,
    error: error as Error | null,
  };
};

export type { PreviewSection, EditionPreviewConfig, UseEditionPreviewResult };
export { useEditionPreview };
