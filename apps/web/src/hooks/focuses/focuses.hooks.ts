import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';

import type { SourceMode, SourceSelection, Source, FocusListItem } from './focuses.types.ts';

// ---------------------------------------------------------------------------
// useFocusesList
// ---------------------------------------------------------------------------

type UseFocusesListResult = {
  focuses: FocusListItem[];
  isLoading: boolean;
  headers: Record<string, string> | undefined;
};

const useFocusesList = (): UseFocusesListResult => {
  const headers = useAuthHeaders();

  const { data: focuses = [], isLoading } = useQuery({
    queryKey: queryKeys.focuses.all,
    queryFn: async (): Promise<FocusListItem[]> => {
      const { data } = await client.GET('/api/focuses', { headers });
      return (data as FocusListItem[]) ?? [];
    },
    enabled: !!headers,
  });

  return { focuses, isLoading, headers };
};

// ---------------------------------------------------------------------------
// useFocusSourceSelection
// ---------------------------------------------------------------------------

type UseFocusSourceSelectionParams = {
  initialSources?: SourceSelection[];
};

type UseFocusSourceSelectionResult = {
  allSources: Source[];
  loadingSources: boolean;
  selectedSources: SourceSelection[];
  selectedIds: Set<string>;
  toggleSource: (sourceId: string) => void;
  changeMode: (sourceId: string, mode: SourceMode) => void;
  changeWeight: (sourceId: string, weight: number) => void;
  setSelectedSources: React.Dispatch<React.SetStateAction<SourceSelection[]>>;
};

const useFocusSourceSelection = (params?: UseFocusSourceSelectionParams): UseFocusSourceSelectionResult => {
  const headers = useAuthHeaders();
  const [selectedSources, setSelectedSources] = useState<SourceSelection[]>(params?.initialSources ?? []);

  const { data: allSources = [], isLoading: loadingSources } = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: async (): Promise<Source[]> => {
      const { data } = await client.GET('/api/sources', { headers });
      return (data as Source[]) ?? [];
    },
    enabled: !!headers,
  });

  const toggleSource = useCallback((sourceId: string): void => {
    setSelectedSources((prev) => {
      const existing = prev.find((s) => s.sourceId === sourceId);
      if (existing) {
        return prev.filter((s) => s.sourceId !== sourceId);
      }
      return [...prev, { sourceId, mode: 'always' as const, weight: 1 }];
    });
  }, []);

  const changeMode = useCallback((sourceId: string, mode: SourceMode): void => {
    setSelectedSources((prev) => prev.map((s) => (s.sourceId === sourceId ? { ...s, mode } : s)));
  }, []);

  const changeWeight = useCallback((sourceId: string, weight: number): void => {
    setSelectedSources((prev) => prev.map((s) => (s.sourceId === sourceId ? { ...s, weight } : s)));
  }, []);

  const selectedIds = new Set(selectedSources.map((s) => s.sourceId));

  return {
    allSources,
    loadingSources,
    selectedSources,
    selectedIds,
    toggleSource,
    changeMode,
    changeWeight,
    setSelectedSources,
  };
};

// ---------------------------------------------------------------------------
// useCreateFocus
// ---------------------------------------------------------------------------

type UseCreateFocusResult = {
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  description: string;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  icon: string | null;
  setIcon: React.Dispatch<React.SetStateAction<string | null>>;
  minConfidence: number;
  setMinConfidence: React.Dispatch<React.SetStateAction<number>>;
  minReadingTime: string;
  setMinReadingTime: React.Dispatch<React.SetStateAction<string>>;
  maxReadingTime: string;
  setMaxReadingTime: React.Dispatch<React.SetStateAction<string>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  sourceSelection: UseFocusSourceSelectionResult;
  isPending: boolean;
  submit: () => void;
  headers: Record<string, string> | undefined;
};

type CreateFocusFields = {
  name: string;
  description: string;
  icon: string | null;
  minConfidence: number;
  minReadingTime: string;
  maxReadingTime: string;
  sources: SourceSelection[];
};

const buildCreateFocusBody = (fields: CreateFocusFields): { name: string } & Record<string, unknown> => {
  const { name, description, icon, minConfidence, minReadingTime, maxReadingTime, sources } = fields;
  const body: { name: string } & Record<string, unknown> = { name };
  if (description.trim()) {
    body.description = description.trim();
  }
  if (icon) {
    body.icon = icon;
  }
  if (minConfidence > 0) {
    body.minConfidence = minConfidence / 100;
  }
  const parsedMin = minReadingTime ? Number(minReadingTime) : null;
  const parsedMax = maxReadingTime ? Number(maxReadingTime) : null;
  if (parsedMin !== null) {
    body.minConsumptionTimeSeconds = parsedMin * 60;
  }
  if (parsedMax !== null) {
    body.maxConsumptionTimeSeconds = parsedMax * 60;
  }
  if (sources.length > 0) {
    body.sources = sources;
  }
  return body;
};

const useCreateFocus = (): UseCreateFocusResult => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [minReadingTime, setMinReadingTime] = useState('');
  const [maxReadingTime, setMaxReadingTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sourceSelection = useFocusSourceSelection();

  const createMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const body = buildCreateFocusBody({
        name,
        description,
        icon,
        minConfidence,
        minReadingTime,
        maxReadingTime,
        sources: sourceSelection.selectedSources,
      });
      const { error: err } = await client.POST('/api/focuses', { body, headers });
      if (err) {
        throw new Error('error' in err ? (err as { error: string }).error : 'Failed to create focus');
      }
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all });
      await navigate({ to: '/focuses' });
    },
    onError: (err: Error): void => setError(err.message),
  });

  const submit = useCallback((): void => {
    setError(null);
    createMutation.mutate();
  }, [createMutation]);

  return {
    name,
    setName,
    description,
    setDescription,
    icon,
    setIcon,
    minConfidence,
    setMinConfidence,
    minReadingTime,
    setMinReadingTime,
    maxReadingTime,
    setMaxReadingTime,
    error,
    setError,
    sourceSelection,
    isPending: createMutation.isPending,
    submit,
    headers,
  };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  VoteValue,
  SourceMode,
  SourceSelection,
  Source,
  FocusListItem,
  FocusDetail,
  FocusEditable,
  FocusArticle,
  FocusArticlesPage,
  ArticlesWithBookmarks,
  SortMode,
  TimeWindow,
  ReadStatus,
  VoteOverride,
} from './focuses.types.ts';

export type {
  UseFocusesListResult,
  UseFocusSourceSelectionParams,
  UseFocusSourceSelectionResult,
  UseCreateFocusResult,
};

export type { UseFocusDetailResult } from './focuses.detail-hooks.ts';
export type { UseEditFocusResult } from './focuses.edit-hooks.ts';

export { selectClasses, priorityLabel, confidenceHint, PAGE_SIZE } from './focuses.utils.ts';

export { useFocusDetail } from './focuses.detail-hooks.ts';
export { useEditFocus } from './focuses.edit-hooks.ts';

export { useFocusesList, useFocusSourceSelection, useCreateFocus };
