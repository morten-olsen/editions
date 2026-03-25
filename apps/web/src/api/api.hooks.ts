import { useAuth } from '../auth/auth.tsx';

/**
 * Returns auth headers for API calls, or undefined if not authenticated.
 * For use with React Query's `queryFn` and mutation functions.
 */
const useAuthHeaders = (): Record<string, string> | undefined => {
  const auth = useAuth();
  if (auth.status !== 'authenticated') {
    return undefined;
  }
  return { Authorization: `Bearer ${auth.token}` };
};

// Query key factories for consistent cache invalidation
const queryKeys = {
  nav: ['nav'] as const,
  sources: {
    all: ['sources'] as const,
    detail: (id: string) => ['sources', id] as const,
    articles: (id: string, offset: number) => ['sources', id, 'articles', offset] as const,
  },
  editions: {
    configs: ['editions', 'configs'] as const,
    config: (id: string) => ['editions', 'configs', id] as const,
    forConfig: (configId: string) => ['editions', 'configs', configId, 'editions'] as const,
    detail: (id: string) => ['editions', id] as const,
  },
  focuses: {
    all: ['focuses'] as const,
    detail: (id: string) => ['focuses', id] as const,
    articles: (id: string) => ['focuses', id, 'articles'] as const,
  },
  feed: (params: Record<string, unknown>) => ['feed', params] as const,
  bookmarks: {
    all: ['bookmarks'] as const,
  },
  billing: {
    access: ['billing', 'access'] as const,
    subscription: ['billing', 'subscription'] as const,
    settings: ['billing', 'settings'] as const,
    adminUsers: ['billing', 'admin', 'users'] as const,
  },
  article: {
    vote: (id: string) => ['articles', id, 'vote'] as const,
    bookmark: (id: string) => ['articles', id, 'bookmark'] as const,
    focuses: (id: string) => ['articles', id, 'focuses'] as const,
  },
};

export { useAuthHeaders, queryKeys };
