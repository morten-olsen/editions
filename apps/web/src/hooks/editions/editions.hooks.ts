import { useState, useCallback, useRef } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../../api/api.ts";
import { useAuthHeaders, queryKeys } from "../../api/api.hooks.ts";
import { useFormPopulation } from "../utilities/use-form-population.ts";

/* ── Types ────────────────────────────────────────────────────────── */

type VoteValue = 1 | -1 | null;

type EditionArticle = {
  id: string;
  sourceId: string;
  title: string;
  author: string | null;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sourceType: string;
  readAt?: string | null;
  progress: number;
  sourceName: string;
  focusId: string;
  focusName: string;
  position: number;
};

type EditionDetail = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  articles: EditionArticle[];
};

type FocusSection = {
  focusId: string;
  focusName: string;
  articles: EditionArticle[];
};

type EditionConfigFocus = {
  focusId: string;
  focusName: string;
  position: number;
  budgetType: "time" | "count";
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type EditionConfig = {
  id: string;
  name: string;
  icon: string | null;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: EditionConfigFocus[];
  createdAt: string;
  updatedAt?: string;
};

type EditionSummary = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  configName: string;
};

type FocusConfig = {
  focusId: string;
  position: number;
  budgetType: "time" | "count";
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type Focus = {
  id: string;
  name: string;
  description: string | null;
};

type ViewMode = "list" | "magazine";

/* ── Shared constants ─────────────────────────────────────────────── */

const SCHEDULE_PRESETS = [
  { label: "Daily at 7am", value: "0 7 * * *" },
  { label: "Daily at 8am", value: "0 8 * * *" },
  { label: "Daily at noon", value: "0 12 * * *" },
  { label: "Weekdays at 7am", value: "0 7 * * 1-5" },
  { label: "Weekdays at 8am", value: "0 8 * * 1-5" },
  { label: "Every Monday at 8am", value: "0 8 * * 1" },
  { label: "Every Friday at 5pm", value: "0 17 * * 5" },
  { label: "Custom…", value: "__custom__" },
] as const;

const selectClasses =
  "rounded-md border border-border bg-surface-raised px-2.5 py-2 text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

/* ── Shared helpers ───────────────────────────────────────────────── */

const priorityLabel = (w: number): string => {
  if (w <= 0.1) return "Off";
  if (w < 0.75) return "Low";
  if (w <= 1.25) return "Normal";
  if (w <= 2.1) return "High";
  return "Top";
};

const formatLookback = (hours: number): string => {
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days === 7 ? "1 week" : `${days}d`;
};

const formatTime = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "< 1 min" : `${minutes} min read`;
};

const groupByFocus = (articles: EditionArticle[]): FocusSection[] => {
  const sections: FocusSection[] = [];
  const map = new Map<string, FocusSection>();
  for (const article of articles) {
    let section = map.get(article.focusId);
    if (!section) {
      section = { focusId: article.focusId, focusName: article.focusName, articles: [] };
      map.set(article.focusId, section);
      sections.push(section);
    }
    section.articles.push(article);
  }
  return sections;
};

/* ── useEditionConfigs ────────────────────────────────────────────── */

type UseEditionConfigsReturn = {
  configs: EditionConfig[];
  loading: boolean;
  deletingId: string | null;
  handleDelete: (id: string, name: string) => void;
};

const useEditionConfigs = (): UseEditionConfigsReturn => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const configsQuery = useQuery({
    queryKey: queryKeys.editions.configs,
    queryFn: async (): Promise<EditionConfig[]> => {
      const { data } = await client.GET("/api/editions/configs", { headers });
      return (data ?? []) as EditionConfig[];
    },
    enabled: !!headers,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await client.DELETE("/api/editions/configs/{configId}", {
        params: { path: { configId: id } },
        headers,
      });
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
    },
  });

  const handleDelete = (id: string, name: string): void => {
    if (!confirm(`Delete "${name}"? This will also delete all generated editions.`)) return;
    setDeletingId(id);
    deleteMutation.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  return {
    configs: configsQuery.data ?? [],
    loading: configsQuery.isLoading,
    deletingId,
    handleDelete,
  };
};

/* ── useEditionFocusSelection ─────────────────────────────────────── */

type UseEditionFocusSelectionReturn = {
  allFocuses: Focus[];
  focusesLoading: boolean;
  selectedFocuses: FocusConfig[];
  setSelectedFocuses: React.Dispatch<React.SetStateAction<FocusConfig[]>>;
  selectedIds: Set<string>;
  toggleFocus: (focusId: string) => void;
  updateFocusField: (
    focusId: string,
    field: "budgetType" | "budgetValue" | "lookbackHours" | "excludePriorEditions" | "weight",
    value: string | number | boolean | null,
  ) => void;
  moveFocus: (focusId: string, direction: -1 | 1) => void;
  isPresetSchedule: (schedule: string) => boolean;
  scheduleSelectValue: (schedule: string) => string;
};

const useEditionFocusSelection = (): UseEditionFocusSelectionReturn => {
  const headers = useAuthHeaders();
  const [selectedFocuses, setSelectedFocuses] = useState<FocusConfig[]>([]);

  const focusesQuery = useQuery({
    queryKey: queryKeys.focuses.all,
    queryFn: async (): Promise<Focus[]> => {
      const { data } = await client.GET("/api/focuses", { headers });
      return (data ?? []) as Focus[];
    },
    enabled: !!headers,
  });

  const selectedIds = new Set(selectedFocuses.map((f) => f.focusId));

  const toggleFocus = (focusId: string): void => {
    setSelectedFocuses((prev) => {
      const existing = prev.find((f) => f.focusId === focusId);
      if (existing) return prev.filter((f) => f.focusId !== focusId);
      return [
        ...prev,
        { focusId, position: prev.length, budgetType: "count" as const, budgetValue: 5, lookbackHours: null, excludePriorEditions: null, weight: 1 },
      ];
    });
  };

  const updateFocusField = (
    focusId: string,
    field: "budgetType" | "budgetValue" | "lookbackHours" | "excludePriorEditions" | "weight",
    value: string | number | boolean | null,
  ): void => {
    setSelectedFocuses((prev) =>
      prev.map((f) => (f.focusId === focusId ? { ...f, [field]: value } : f)),
    );
  };

  const moveFocus = (focusId: string, direction: -1 | 1): void => {
    setSelectedFocuses((prev) => {
      const idx = prev.findIndex((f) => f.focusId === focusId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      const a = arr[idx]!;
      const b = arr[newIdx]!;
      arr[idx] = b;
      arr[newIdx] = a;
      return arr.map((f, i) => ({ ...f, position: i }));
    });
  };

  const isPresetSchedule = (schedule: string): boolean =>
    SCHEDULE_PRESETS.some((p) => p.value !== "__custom__" && p.value === schedule);

  const scheduleSelectValue = (schedule: string): string =>
    isPresetSchedule(schedule) ? schedule : "__custom__";

  return {
    allFocuses: focusesQuery.data ?? [],
    focusesLoading: focusesQuery.isLoading,
    selectedFocuses,
    setSelectedFocuses,
    selectedIds,
    toggleFocus,
    updateFocusField,
    moveFocus,
    isPresetSchedule,
    scheduleSelectValue,
  };
};

/* ── useCreateEditionConfig ───────────────────────────────────────── */

type UseCreateEditionConfigReturn = {
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  icon: string | null;
  setIcon: React.Dispatch<React.SetStateAction<string | null>>;
  schedule: string;
  setSchedule: React.Dispatch<React.SetStateAction<string>>;
  lookbackHours: number;
  setLookbackHours: React.Dispatch<React.SetStateAction<number>>;
  excludePriorEditions: boolean;
  setExcludePriorEditions: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  focusSelection: UseEditionFocusSelectionReturn;
  isPending: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleCancel: () => void;
};

const useCreateEditionConfig = (): UseCreateEditionConfigReturn => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [schedule, setSchedule] = useState("0 7 * * *");
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const focusSelection = useEditionFocusSelection();

  const createMutation = useMutation({
    mutationFn: async (body: {
      name: string;
      icon?: string | null;
      schedule: string;
      lookbackHours: number;
      excludePriorEditions?: boolean;
      enabled?: boolean;
      focuses: {
        focusId: string;
        position: number;
        budgetType: "time" | "count";
        budgetValue: number;
        lookbackHours?: number | null;
        weight?: number;
      }[];
    }): Promise<void> => {
      const { error: err } = await client.POST("/api/editions/configs", {
        body,
        headers,
      });
      if (err) {
        throw new Error("error" in err ? (err as { error: string }).error : "Failed to create edition");
      }
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: "/editions" });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);

    createMutation.mutate({
      name,
      icon,
      schedule,
      lookbackHours,
      excludePriorEditions,
      focuses: focusSelection.selectedFocuses.map((f, i) => ({
        focusId: f.focusId,
        position: i,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        lookbackHours: f.lookbackHours,
        excludePriorEditions: f.excludePriorEditions,
        weight: f.weight,
      })),
    });
  };

  const handleCancel = (): void => {
    void navigate({ to: "/editions" });
  };

  return {
    name,
    setName,
    icon,
    setIcon,
    schedule,
    setSchedule,
    lookbackHours,
    setLookbackHours,
    excludePriorEditions,
    setExcludePriorEditions,
    error,
    focusSelection,
    isPending: createMutation.isPending,
    handleSubmit,
    handleCancel,
  };
};

/* ── useEditEditionConfig ─────────────────────────────────────────── */

type UseEditEditionConfigReturn = {
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  icon: string | null;
  setIcon: React.Dispatch<React.SetStateAction<string | null>>;
  schedule: string;
  setSchedule: React.Dispatch<React.SetStateAction<string>>;
  lookbackHours: number;
  setLookbackHours: React.Dispatch<React.SetStateAction<number>>;
  excludePriorEditions: boolean;
  setExcludePriorEditions: React.Dispatch<React.SetStateAction<boolean>>;
  enabled: boolean;
  setEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  loading: boolean;
  config: EditionConfig | null;
  focusSelection: UseEditionFocusSelectionReturn;
  isPending: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleCancel: () => void;
};

const useEditEditionConfig = (configId: string): UseEditEditionConfigReturn => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [schedule, setSchedule] = useState("");
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const focusSelection = useEditionFocusSelection();

  const configQuery = useQuery({
    queryKey: queryKeys.editions.config(configId),
    queryFn: async (): Promise<EditionConfig> => {
      const { data, error: err } = await client.GET("/api/editions/configs/{configId}", {
        params: { path: { configId } },
        headers,
      });
      if (err) throw new Error("Edition config not found");
      return data as unknown as EditionConfig;
    },
    enabled: !!headers,
  });

  // Populate form state when config data loads
  useFormPopulation(configQuery.data, useCallback((c: EditionConfig): void => {
    setName(c.name);
    setIcon(c.icon);
    setSchedule(c.schedule);
    setLookbackHours(c.lookbackHours);
    setExcludePriorEditions(c.excludePriorEditions);
    setEnabled(c.enabled);
    focusSelection.setSelectedFocuses(
      c.focuses.map((f) => ({
        focusId: f.focusId,
        position: f.position,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        lookbackHours: f.lookbackHours,
        excludePriorEditions: f.excludePriorEditions,
        weight: f.weight,
      })),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<void> => {
      const { error: err } = await client.PATCH("/api/editions/configs/{configId}", {
        params: { path: { configId } },
        body,
        headers,
      });
      if (err) throw new Error("Failed to update edition config");
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.config(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: "/editions/$configId", params: { configId } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  const config = configQuery.data ?? null;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);

    if (!config) return;

    const body: Record<string, unknown> = {};

    if (name !== config.name) body.name = name;
    if (icon !== config.icon) body.icon = icon;
    if (schedule !== config.schedule) body.schedule = schedule;
    if (lookbackHours !== config.lookbackHours) body.lookbackHours = lookbackHours;
    if (excludePriorEditions !== config.excludePriorEditions)
      body.excludePriorEditions = excludePriorEditions;
    if (enabled !== config.enabled) body.enabled = enabled;

    const focusesChanged =
      JSON.stringify(focusSelection.selectedFocuses) !==
      JSON.stringify(
        config.focuses.map((f) => ({
          focusId: f.focusId,
          position: f.position,
          budgetType: f.budgetType,
          budgetValue: f.budgetValue,
          lookbackHours: f.lookbackHours,
          excludePriorEditions: f.excludePriorEditions,
          weight: f.weight,
        })),
      );

    if (focusesChanged) {
      body.focuses = focusSelection.selectedFocuses.map((f, i) => ({
        focusId: f.focusId,
        position: i,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        lookbackHours: f.lookbackHours,
        excludePriorEditions: f.excludePriorEditions,
        weight: f.weight,
      }));
    }

    if (Object.keys(body).length === 0) {
      void navigate({ to: "/editions/$configId", params: { configId } });
      return;
    }

    updateMutation.mutate(body);
  };

  const handleCancel = (): void => {
    void navigate({ to: "/editions/$configId", params: { configId } });
  };

  return {
    name,
    setName,
    icon,
    setIcon,
    schedule,
    setSchedule,
    lookbackHours,
    setLookbackHours,
    excludePriorEditions,
    setExcludePriorEditions,
    enabled,
    setEnabled,
    error,
    loading: configQuery.isLoading || focusSelection.focusesLoading,
    config,
    focusSelection,
    isPending: updateMutation.isPending,
    handleSubmit,
    handleCancel,
  };
};

/* ── useEditionConfigDetail ───────────────────────────────────────── */

type UseEditionConfigDetailReturn = {
  config: EditionConfig | null;
  editions: EditionSummary[];
  filtered: EditionSummary[];
  loading: boolean;
  error: string | null;
  readFilter: "unread" | "all" | "read";
  setReadFilter: React.Dispatch<React.SetStateAction<"unread" | "all" | "read">>;
  generatePending: boolean;
  handleGenerate: () => void;
  handleDeleteEdition: (editionId: string, title: string) => void;
  configError: Error | null;
};

const useEditionConfigDetail = (configId: string): UseEditionConfigDetailReturn => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<"unread" | "all" | "read">("unread");

  const configQuery = useQuery({
    queryKey: queryKeys.editions.config(configId),
    queryFn: async (): Promise<EditionConfig> => {
      const { data, error: err } = await client.GET("/api/editions/configs/{configId}", {
        params: { path: { configId } },
        headers,
      });
      if (err) throw new Error("Edition config not found");
      return data as EditionConfig;
    },
    enabled: !!headers,
  });

  const editionsQuery = useQuery({
    queryKey: queryKeys.editions.forConfig(configId),
    queryFn: async (): Promise<EditionSummary[]> => {
      const { data } = await client.GET("/api/editions/configs/{configId}/editions", {
        params: { path: { configId } },
        headers,
      });
      return (data ?? []) as EditionSummary[];
    },
    enabled: !!headers,
  });

  const generateMutation = useMutation({
    mutationFn: async (): Promise<{ id: string }> => {
      const { data, error: err } = await client.POST("/api/editions/configs/{configId}/generate", {
        params: { path: { configId } },
        headers,
      });
      if (err) {
        throw new Error("error" in err ? (err as { error: string }).error : "Failed to generate edition");
      }
      return data as { id: string };
    },
    onSuccess: (data): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({
        to: "/editions/$configId/issues/$editionId",
        params: { configId, editionId: data.id },
      });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (editionId: string): Promise<string> => {
      await client.DELETE("/api/editions/{editionId}", {
        params: { path: { editionId } },
        headers,
      });
      return editionId;
    },
    onMutate: async (editionId): Promise<{ previous: EditionSummary[] | undefined }> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      const previous = queryClient.getQueryData<EditionSummary[]>(queryKeys.editions.forConfig(configId));
      queryClient.setQueryData<EditionSummary[]>(
        queryKeys.editions.forConfig(configId),
        (old) => old?.filter((e) => e.id !== editionId) ?? [],
      );
      return { previous };
    },
    onError: (_err: unknown, _editionId: string, context: { previous: EditionSummary[] | undefined } | undefined): void => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.editions.forConfig(configId), context.previous);
      }
    },
    onSettled: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
    },
  });

  const editions = editionsQuery.data ?? [];

  const filtered = editions.filter((e) => {
    if (readFilter === "unread") return !e.readAt;
    if (readFilter === "read") return !!e.readAt;
    return true;
  });

  const handleGenerate = (): void => {
    setError(null);
    generateMutation.mutate();
  };

  const handleDeleteEdition = (editionId: string, title: string): void => {
    if (!confirm(`Delete "${title}"?`)) return;
    deleteMutation.mutate(editionId);
  };

  return {
    config: configQuery.data ?? null,
    editions,
    filtered,
    loading: configQuery.isLoading || editionsQuery.isLoading,
    error,
    readFilter,
    setReadFilter,
    generatePending: generateMutation.isPending,
    handleGenerate,
    handleDeleteEdition,
    configError: configQuery.error as Error | null,
  };
};

/* ── useEditionView ───────────────────────────────────────────────── */

type UseEditionViewReturn = {
  edition: EditionDetail | undefined;
  sections: FocusSection[];
  isLoading: boolean;
  error: Error | null;
  isRead: boolean;
  votes: Record<string, VoteValue>;
  view: ViewMode;
  setView: React.Dispatch<React.SetStateAction<ViewMode>>;
  handleToggleRead: () => Promise<void>;
  handleMarkDoneAndBack: () => Promise<void>;
  handleDelete: () => void;
  handleEditionVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleMarkArticleViewed: (sourceId: string, articleId: string) => Promise<void>;
  handleExitMagazine: () => void;
  handleGoBack: () => void;
};

const useEditionView = ({ configId, editionId }: { configId: string; editionId: string }): UseEditionViewReturn => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const [isRead, setIsRead] = useState(false);
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [view, setView] = useState<ViewMode>("list");

  const queryKey = queryKeys.editions.detail(editionId);

  const { data: edition, isLoading, error } = useQuery<EditionDetail>({
    queryKey,
    queryFn: async (): Promise<EditionDetail> => {
      const { data, error: err } = await client.GET("/api/editions/{editionId}", {
        params: { path: { editionId } },
        headers,
      });
      if (err) throw new Error("Edition not found");
      return data as EditionDetail;
    },
    enabled: !!headers,
  });

  // Initialize local state from query data
  const [initialized, setInitialized] = useState(false);
  if (edition && !initialized) {
    setIsRead(!!edition.readAt);
    setInitialized(true);
  }

  const sections = edition ? groupByFocus(edition.articles) : [];

  const handleToggleRead = async (): Promise<void> => {
    if (!edition) return;
    const newRead = !isRead;
    setIsRead(newRead);
    await client.PUT("/api/editions/{editionId}/read", {
      params: { path: { editionId } },
      body: { read: newRead },
      headers,
    });
  };

  const handleMarkDoneAndBack = async (): Promise<void> => {
    if (!edition) return;
    if (!isRead) {
      setIsRead(true);
      await client.PUT("/api/editions/{editionId}/read", {
        params: { path: { editionId } },
        body: { read: true },
        headers,
      });
    }
    await navigate({ to: "/editions/$configId", params: { configId } });
  };

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await client.DELETE("/api/editions/{editionId}", {
        params: { path: { editionId } },
        headers,
      });
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void navigate({ to: "/editions/$configId", params: { configId } });
    },
  });

  const handleDelete = (): void => {
    if (!edition) return;
    if (!confirm(`Delete "${edition.title}"?`)) return;
    deleteMutation.mutate();
  };

  const handleEditionVote = async (articleId: string, value: VoteValue): Promise<void> => {
    setVotes((prev) => ({ ...prev, [articleId]: value }));
    if (value === null) {
      await client.DELETE("/api/editions/{editionId}/articles/{articleId}/vote", {
        params: { path: { editionId, articleId } },
        headers,
      });
    } else {
      await client.PUT("/api/editions/{editionId}/articles/{articleId}/vote", {
        params: { path: { editionId, articleId } },
        body: { value },
        headers,
      });
    }
  };

  const handleMarkArticleViewed = async (sourceId: string, articleId: string): Promise<void> => {
    await client.PUT("/api/sources/{id}/articles/{articleId}/read", {
      params: { path: { id: sourceId, articleId } },
      body: { read: true },
      headers,
    });
  };

  const handleExitMagazine = useCallback((): void => setView("list"), []);

  const handleGoBack = useCallback((): void => {
    router.history.back();
  }, [router.history]);

  return {
    edition,
    sections,
    isLoading,
    error: error as Error | null,
    isRead,
    votes,
    view,
    setView,
    handleToggleRead,
    handleMarkDoneAndBack,
    handleDelete,
    handleEditionVote,
    handleMarkArticleViewed,
    handleExitMagazine,
    handleGoBack,
  };
};

/* ── useMagazineView ──────────────────────────────────────────────── */

type UseMagazineViewReturn = {
  edition: EditionDetail | undefined;
  sections: FocusSection[];
  isLoading: boolean;
  error: Error | null;
  page: number;
  pageRef: React.MutableRefObject<number>;
  votes: Record<string, VoteValue>;
  handlePageChange: (newPage: number) => void;
  handleExit: () => void;
  handleMarkDone: () => Promise<void>;
  handleVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleMarkArticleViewed: (sourceId: string, articleId: string) => Promise<void>;
};

const useMagazineView = (editionId: string): UseMagazineViewReturn => {
  const headers = useAuthHeaders();
  const router = useRouter();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});

  const { data: edition, isLoading, error } = useQuery<EditionDetail>({
    queryKey: queryKeys.editions.detail(editionId),
    queryFn: async (): Promise<EditionDetail> => {
      const { data, error: err } = await client.GET("/api/editions/{editionId}", {
        params: { path: { editionId } },
        headers,
      });
      if (err) throw new Error("Edition not found");
      return data as EditionDetail;
    },
    enabled: !!headers,
  });

  const sections = edition ? groupByFocus(edition.articles) : [];

  // Build page->article map for marking viewed on navigation
  const pageArticleMap = useRef<Map<number, { sourceId: string; articleId: string }>>(new Map());
  pageArticleMap.current.clear();
  let articlePageIdx = 2;
  sections.forEach((section) => {
    articlePageIdx += 1;
    section.articles.forEach((article) => {
      pageArticleMap.current.set(articlePageIdx, { sourceId: article.sourceId, articleId: article.id });
      articlePageIdx += 1;
    });
  });

  const handleMarkArticleViewed = useCallback(async (sourceId: string, articleId: string): Promise<void> => {
    await client.PUT("/api/sources/{id}/articles/{articleId}/read", {
      params: { path: { id: sourceId, articleId } },
      body: { read: true },
      headers,
    });
  }, [headers]);

  const handlePageChange = useCallback((newPage: number): void => {
    const articleInfo = pageArticleMap.current.get(pageRef.current);
    if (articleInfo && newPage !== pageRef.current) {
      void handleMarkArticleViewed(articleInfo.sourceId, articleInfo.articleId);
    }
    pageRef.current = newPage;
    setPage(newPage);
  }, [handleMarkArticleViewed]);

  const handleExit = useCallback((): void => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: "/" });
    }
  }, [router.history, navigate]);

  const handleMarkDone = useCallback(async (): Promise<void> => {
    await client.PUT("/api/editions/{editionId}/read", {
      params: { path: { editionId } },
      body: { read: true },
      headers,
    });
    if (window.history.length > 1) {
      router.history.back();
    } else {
      await navigate({ to: "/" });
    }
  }, [editionId, headers, router.history, navigate]);

  const handleVote = useCallback(async (articleId: string, value: VoteValue): Promise<void> => {
    setVotes((prev) => ({ ...prev, [articleId]: value }));
    if (value === null) {
      await client.DELETE("/api/editions/{editionId}/articles/{articleId}/vote", {
        params: { path: { editionId, articleId } },
        headers,
      });
    } else {
      await client.PUT("/api/editions/{editionId}/articles/{articleId}/vote", {
        params: { path: { editionId, articleId } },
        body: { value },
        headers,
      });
    }
  }, [editionId, headers]);

  return {
    edition,
    sections,
    isLoading,
    error: error as Error | null,
    page,
    pageRef,
    votes,
    handlePageChange,
    handleExit,
    handleMarkDone,
    handleVote,
    handleMarkArticleViewed,
  };
};

/* ── Exports ──────────────────────────────────────────────────────── */

export type {
  VoteValue,
  EditionArticle,
  EditionDetail,
  FocusSection,
  EditionConfigFocus,
  EditionConfig,
  EditionSummary,
  FocusConfig,
  Focus,
  ViewMode,
  UseEditionFocusSelectionReturn,
};

export {
  SCHEDULE_PRESETS,
  selectClasses,
  priorityLabel,
  formatLookback,
  formatTime,
  groupByFocus,
  useEditionConfigs,
  useEditionFocusSelection,
  useCreateEditionConfig,
  useEditEditionConfig,
  useEditionConfigDetail,
  useEditionView,
  useMagazineView,
};
