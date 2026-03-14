import { useQuery } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import type { FocusClassification } from '../../components/focus-insight.tsx';

type UseArticleFocusesResult = {
  classifications: FocusClassification[];
  isLoading: boolean;
};

const useArticleFocuses = (articleId: string): UseArticleFocusesResult => {
  const headers = useAuthHeaders();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.article.focuses(articleId),
    queryFn: async (): Promise<FocusClassification[]> => {
      const res = await client.GET('/api/articles/{articleId}/focuses', {
        params: { path: { articleId } },
        headers,
      });
      if (res.error) {
        return [];
      }
      return (res.data ?? []) as FocusClassification[];
    },
    enabled: !!headers,
  });

  return {
    classifications: data ?? [],
    isLoading: !headers || isLoading,
  };
};

export type { UseArticleFocusesResult };
export { useArticleFocuses };
