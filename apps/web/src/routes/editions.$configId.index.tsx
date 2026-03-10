import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";

type EditionConfig = {
  id: string;
  name: string;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: { focusId: string; focusName: string; position: number; budgetType: "time" | "count"; budgetValue: number }[];
  createdAt: string;
  updatedAt: string;
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

const CogIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
  </svg>
);

const EditionConfigDetailPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { configId } = Route.useParams();
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
    onError: (_err, _editionId, context): void => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.editions.forConfig(configId), context.previous);
      }
    },
    onSettled: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
    },
  });

  if (!headers) return null;

  const loading = configQuery.isLoading || editionsQuery.isLoading;
  const config = configQuery.data ?? null;
  const editions = editionsQuery.data ?? [];

  const handleGenerate = (): void => {
    setError(null);
    generateMutation.mutate();
  };

  const handleDeleteEdition = (editionId: string, title: string): void => {
    if (!confirm(`Delete "${title}"?`)) return;
    deleteMutation.mutate(editionId);
  };

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!config) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? configQuery.error?.message ?? "Edition config not found"}</div>
      </div>
    );
  }

  const filtered = editions.filter((e) => {
    if (readFilter === "unread") return !e.readAt;
    if (readFilter === "read") return !!e.readAt;
    return true;
  });

  return (
    <>
      {/* Header: name + cog */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1 className="text-2xl font-serif font-medium tracking-tight text-ink">
          {config.name}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={generateMutation.isPending}
            onClick={() => handleGenerate()}
          >
            {generateMutation.isPending ? "Generating..." : "Generate issue"}
          </Button>
          <Link
            to="/editions/$configId/edit"
            params={{ configId }}
            className="p-2 rounded-md text-ink-tertiary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast"
            aria-label="Edit edition settings"
          >
            <CogIcon />
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      {editions.length > 0 && (
        <div className="flex gap-1 border-b border-border mb-6">
          {(["unread", "all", "read"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setReadFilter(f)}
              className={`relative flex h-8 items-center justify-center px-3 text-xs font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${readFilter === f ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent" : "text-ink-tertiary hover:text-ink-secondary"}`}
            >
              {f === "unread" ? "Unread" : f === "all" ? "All" : "Read"}
            </button>
          ))}
        </div>
      )}

      {/* Issues list */}
      {editions.length === 0 ? (
        <EmptyState
          title="No issues yet"
          description="Generate your first issue to see it here."
          action={
            <Button
              variant="primary"
              disabled={generateMutation.isPending}
              onClick={() => handleGenerate()}
            >
              {generateMutation.isPending ? "Generating..." : "Generate issue"}
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-ink-tertiary">
          {readFilter === "unread" ? "All caught up!" : "No read issues yet."}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((edition) => (
            <div
              key={edition.id}
              className="flex items-center justify-between py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!edition.readAt && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                  <Link
                    to="/editions/$configId/issues/$editionId"
                    params={{ configId, editionId: edition.id }}
                    className={`font-serif font-medium hover:text-accent transition-colors duration-fast ${edition.readAt ? "text-ink-secondary" : "text-ink"}`}
                  >
                    {edition.title}
                  </Link>
                </div>
                <div className={`flex items-center gap-2 text-xs mt-0.5 ${!edition.readAt ? "ml-3.5" : ""} text-ink-tertiary`}>
                  <span>{edition.articleCount} articles</span>
                  {edition.totalReadingMinutes && (
                    <>
                      <span className="text-ink-faint">·</span>
                      <span>{edition.totalReadingMinutes} min</span>
                    </>
                  )}
                  <span className="text-ink-faint">·</span>
                  <span>{new Date(edition.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  {edition.currentPosition > 0 && (
                    <>
                      <span className="text-ink-faint">·</span>
                      <span className="text-accent">resumed</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteEdition(edition.id, edition.title)}
                className="text-xs text-ink-tertiary hover:text-critical transition-colors duration-fast cursor-pointer ml-4"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const Route = createFileRoute("/editions/$configId/")({
  component: EditionConfigDetailPage,
});

export { Route };
