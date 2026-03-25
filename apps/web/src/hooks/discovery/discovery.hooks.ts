import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import type { ApiResponse } from '../../api/api.ts';

// --- Types derived from API schema ---

type DiscoverySourcePage = ApiResponse<'/api/discovery/sources', 'get'>;
type DiscoverySource = DiscoverySourcePage['items'][number];

type DiscoveryFocusPage = ApiResponse<'/api/discovery/focuses', 'get'>;
type DiscoveryFocus = DiscoveryFocusPage['items'][number];

type DiscoveryEditionConfigPage = ApiResponse<'/api/discovery/edition-configs', 'get'>;
type DiscoveryEditionConfig = DiscoveryEditionConfigPage['items'][number];

// --- Query params ---

type DiscoveryQuery = {
  search?: string;
  tag?: string;
  offset?: number;
  limit?: number;
};

// --- Hooks ---

type UseDiscoveryResult<T> = {
  items: T[];
  total: number;
  isLoading: boolean;
};

const useDiscoverySources = (query: DiscoveryQuery = {}): UseDiscoveryResult<DiscoverySource> => {
  const headers = useAuthHeaders();

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.discovery.sources, query] as const,
    queryFn: async (): Promise<DiscoverySourcePage> => {
      const { data } = await client.GET('/api/discovery/sources', {
        headers,
        params: { query },
      });
      return (data as DiscoverySourcePage) ?? { items: [], total: 0, offset: 0, limit: 50 };
    },
    enabled: !!headers,
  });

  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading };
};

const useDiscoveryFocuses = (query: DiscoveryQuery = {}): UseDiscoveryResult<DiscoveryFocus> => {
  const headers = useAuthHeaders();

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.discovery.focuses, query] as const,
    queryFn: async (): Promise<DiscoveryFocusPage> => {
      const { data } = await client.GET('/api/discovery/focuses', {
        headers,
        params: { query },
      });
      return (data as DiscoveryFocusPage) ?? { items: [], total: 0, offset: 0, limit: 50 };
    },
    enabled: !!headers,
  });

  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading };
};

const useDiscoveryEditionConfigs = (query: DiscoveryQuery = {}): UseDiscoveryResult<DiscoveryEditionConfig> => {
  const headers = useAuthHeaders();

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.discovery.editionConfigs, query] as const,
    queryFn: async (): Promise<DiscoveryEditionConfigPage> => {
      const { data } = await client.GET('/api/discovery/edition-configs', {
        headers,
        params: { query },
      });
      return (data as DiscoveryEditionConfigPage) ?? { items: [], total: 0, offset: 0, limit: 50 };
    },
    enabled: !!headers,
  });

  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading };
};

const useDiscoveryTags = (): { tags: string[]; isLoading: boolean } => {
  const headers = useAuthHeaders();

  const { data: tags = [], isLoading } = useQuery({
    queryKey: queryKeys.discovery.tags,
    queryFn: async (): Promise<string[]> => {
      const { data } = await client.GET('/api/discovery/tags', { headers });
      return (data as string[]) ?? [];
    },
    enabled: !!headers,
  });

  return { tags, isLoading };
};

// --- Adoption mutations ---

const useAdoptSource = (): { adopt: (id: string) => void; isPending: boolean } => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await client.POST('/api/discovery/sources/{id}/adopt', {
        params: { path: { id } },
        headers,
      });
    },
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.discovery.sources }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sources.all }),
      ]);
    },
  });

  return { adopt: mutation.mutate, isPending: mutation.isPending };
};

const useAdoptFocus = (): { adopt: (id: string) => void; isPending: boolean } => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await client.POST('/api/discovery/focuses/{id}/adopt', {
        params: { path: { id } },
        headers,
      });
    },
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.discovery.focuses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sources.all }),
      ]);
    },
  });

  return { adopt: mutation.mutate, isPending: mutation.isPending };
};

const useAdoptEditionConfig = (): { adopt: (id: string) => void; isPending: boolean } => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await client.POST('/api/discovery/edition-configs/{id}/adopt', {
        params: { path: { id } },
        headers,
      });
    },
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.discovery.editionConfigs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.discovery.focuses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.discovery.sources }),
        queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sources.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.nav }),
      ]);
    },
  });

  return { adopt: mutation.mutate, isPending: mutation.isPending };
};

export type {
  DiscoverySource,
  DiscoveryFocus,
  DiscoveryEditionConfig,
  DiscoveryQuery,
};
export {
  useDiscoverySources,
  useDiscoveryFocuses,
  useDiscoveryEditionConfigs,
  useDiscoveryTags,
  useAdoptSource,
  useAdoptFocus,
  useAdoptEditionConfig,
};
