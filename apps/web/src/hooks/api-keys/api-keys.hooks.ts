import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { queryKeys, useAuthHeaders } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import type { ApiBody, ApiSchema } from '../../api/api.ts';

// --- Types ---

/** Derived from the OpenAPI document, so a server-side rename fails to compile here. */
type ApiKey = ApiSchema<'ApiKey'>;

/** Only ever returned from a create — the secret is not stored in plaintext. */
type CreatedApiKey = ApiSchema<'CreatedApiKey'>;

type ApiKeyScope = ApiKey['scope'];

type CreateApiKeyInput = ApiBody<'/api/api-keys', 'post'>;

// --- Helpers ---

const unwrap = <T>(result: { data?: T; error?: unknown }): T => {
  if (result.error !== undefined || result.data === undefined) {
    const message = (result.error as { error?: string } | undefined)?.error;
    throw new Error(message ?? 'Request failed');
  }
  return result.data;
};

// --- Hooks ---

const useApiKeys = (): UseQueryResult<ApiKey[]> => {
  const headers = useAuthHeaders();
  return useQuery({
    queryKey: queryKeys.apiKeys.all,
    queryFn: async (): Promise<ApiKey[]> => unwrap(await client.GET('/api/api-keys', { headers })) as ApiKey[],
    enabled: Boolean(headers),
  });
};

const useCreateApiKey = (): UseMutationResult<CreatedApiKey, Error, CreateApiKeyInput> => {
  const headers = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body): Promise<CreatedApiKey> =>
      unwrap(await client.POST('/api/api-keys', { body, headers })) as CreatedApiKey,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
};

const useRevokeApiKey = (): UseMutationResult<void, Error, string> => {
  const headers = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id): Promise<void> => {
      const result = await client.DELETE('/api/api-keys/{id}', { params: { path: { id } }, headers });
      if (result.error !== undefined) {
        throw new Error((result.error as { error?: string }).error ?? 'Failed to revoke key');
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
};

export type { ApiKey, ApiKeyScope, CreatedApiKey, CreateApiKeyInput };
export { useApiKeys, useCreateApiKey, useRevokeApiKey };
