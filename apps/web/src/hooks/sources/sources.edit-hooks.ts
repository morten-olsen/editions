import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import { useFormPopulation } from '../utilities/use-form-population.ts';

import type { Source } from './sources.hooks.ts';

// -- Types --

type UseEditSourceParams = { sourceId: string };

type EditSourceForm = {
  name: string;
  setName: (value: string) => void;
  url: string;
  setUrl: (value: string) => void;
  direction: string;
  setDirection: (value: string) => void;
  error: string | null;
};

type UseEditSourceResult = {
  source: Source | undefined;
  loading: boolean;
  sourceQuery: UseQueryResult<Source, Error>;
  form: EditSourceForm;
  updateMutation: UseMutationResult<void, Error, Record<string, string>, unknown>;
  deleteMutation: UseMutationResult<void, Error, void, unknown>;
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  navigateToSource: () => void;
  ready: boolean;
};

// -- useEditSourceMutations --

type EditSourceDeps = {
  sourceId: string;
  headers: Record<string, string> | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  navigate: ReturnType<typeof useNavigate>;
};

const useUpdateSourceMutation = (
  deps: EditSourceDeps,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
): UseMutationResult<void, Error, Record<string, string>, unknown> =>
  useMutation({
    mutationFn: async (body: Record<string, string>): Promise<void> => {
      const { error: err } = await client.PATCH('/api/sources/{id}', {
        params: { path: { id: deps.sourceId } },
        body,
        headers: deps.headers,
      });
      if (err) {
        throw new Error('Failed to update source');
      }
    },
    onSuccess: async (): Promise<void> => {
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.sources.detail(deps.sourceId) });
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await deps.navigate({ to: '/sources/$sourceId', params: { sourceId: deps.sourceId } });
    },
    onError: (err: Error): void => setError(err.message),
  });

const useDeleteSourceMutation = (
  deps: EditSourceDeps,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
): UseMutationResult<void, Error, void, unknown> =>
  useMutation({
    mutationFn: async (): Promise<void> => {
      const { error: err } = await client.DELETE('/api/sources/{id}', {
        params: { path: { id: deps.sourceId } },
        headers: deps.headers,
      });
      if (err) {
        throw new Error('Failed to delete source');
      }
    },
    onSuccess: async (): Promise<void> => {
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      await deps.queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await deps.navigate({ to: '/sources' });
    },
    onError: (err: Error): void => setError(err.message),
  });

// -- useEditSource --

const useEditSource = ({ sourceId }: UseEditSourceParams): UseEditSourceResult => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [direction, setDirection] = useState('newest');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sourceQuery = useQuery({
    queryKey: queryKeys.sources.detail(sourceId),
    queryFn: async (): Promise<Source> => {
      const { data, error: err } = await client.GET('/api/sources/{id}', {
        params: { path: { id: sourceId } },
        headers,
      });
      if (err) {
        throw new Error('Source not found');
      }
      return data as Source;
    },
    enabled: !!headers,
  });

  useFormPopulation(sourceQuery.data, (data: Source): void => {
    setName(data.name);
    setUrl(data.url);
    setDirection(data.direction);
  });

  const deps: EditSourceDeps = { sourceId, headers, queryClient, navigate };
  const updateMutation = useUpdateSourceMutation(deps, setError);
  const deleteMutation = useDeleteSourceMutation(deps, setError);

  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setError(null);
      const source = sourceQuery.data;
      if (!source) {
        return;
      }
      const body: Record<string, string> = {};
      if (name !== source.name) {
        body.name = name;
      }
      if (url !== source.url) {
        body.url = url;
      }
      if (direction !== source.direction) {
        body.direction = direction;
      }
      if (Object.keys(body).length === 0) {
        await navigate({ to: '/sources/$sourceId', params: { sourceId } });
        return;
      }
      updateMutation.mutate(body);
    },
    [sourceQuery.data, name, url, direction, sourceId, navigate, updateMutation],
  );

  const navigateToSource = useCallback((): void => {
    void navigate({ to: '/sources/$sourceId', params: { sourceId } });
  }, [navigate, sourceId]);

  return {
    source: sourceQuery.data,
    loading: sourceQuery.isLoading,
    sourceQuery,
    form: { name, setName, url, setUrl, direction, setDirection, error },
    updateMutation,
    deleteMutation,
    confirmDelete,
    setConfirmDelete,
    handleSubmit,
    navigateToSource,
    ready: !!headers,
  };
};

// -- Exports --

export type { UseEditSourceParams, EditSourceForm, UseEditSourceResult };

export { useEditSource };
