import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";

type EditionConfigFocus = {
  focusId: string;
  focusName: string;
  position: number;
  budgetType: "time" | "count";
  budgetValue: number;
};

type EditionConfig = {
  id: string;
  name: string;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: EditionConfigFocus[];
  createdAt: string;
};

const formatLookback = (hours: number): string => {
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days === 7 ? "1 week" : `${days}d`;
};

const EditionsPage = (): React.ReactNode => {
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

  if (!headers) return null;

  const configs = configsQuery.data ?? [];
  const loading = configsQuery.isLoading;

  const handleDelete = (id: string, name: string): void => {
    if (!confirm(`Delete "${name}"? This will also delete all generated editions.`)) return;
    setDeletingId(id);
    deleteMutation.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  return (
    <>
      <PageHeader
        title="Editions"
        subtitle={loading ? "Loading..." : `${configs.length} edition configurations`}
        actions={
          <Link to="/editions/new" data-ai-id="edition-new" data-ai-role="link" data-ai-label="New edition">
            <Button variant="primary" size="sm">New edition</Button>
          </Link>
        }
      />

      {!loading && configs.length === 0 ? (
        <EmptyState
          title="No editions yet"
          description="Editions are curated digests built from your focuses. Create your first edition to start receiving briefings."
          action={
            <Link to="/editions/new">
              <Button variant="primary">New edition</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3" data-ai-id="edition-list" data-ai-role="list" data-ai-label={`${configs.length} edition configurations`}>
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between py-4 border-b border-border last:border-b-0"
              data-ai-id={`edition-config-${config.id}`}
              data-ai-role="section"
              data-ai-label={config.name}
            >
              <div className="min-w-0 flex-1">
                <Link
                  to="/editions/$configId"
                  params={{ configId: config.id }}
                  className="font-serif text-lg font-medium tracking-tight text-ink hover:text-accent transition-colors duration-fast"
                  data-ai-id={`edition-config-${config.id}-link`}
                  data-ai-role="link"
                  data-ai-label={config.name}
                >
                  {config.name}
                </Link>
                <div className="flex items-center gap-2 text-xs text-ink-tertiary mt-1">
                  <span>{formatLookback(config.lookbackHours)} window</span>
                  <span className="text-ink-faint">·</span>
                  <span>
                    {config.focuses.length === 0
                      ? "No focuses"
                      : `${config.focuses.length} focus${config.focuses.length === 1 ? "" : "es"}`}
                  </span>
                  {!config.enabled && (
                    <>
                      <span className="text-ink-faint">·</span>
                      <span className="text-caution">disabled</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(config.id, config.name)}
                className="text-xs text-ink-tertiary hover:text-critical transition-colors duration-fast cursor-pointer ml-4"
                data-ai-id={`edition-config-${config.id}-delete`}
                data-ai-role="button"
                data-ai-label={`Delete ${config.name}`}
              >
                {deletingId === config.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const Route = createFileRoute("/editions/")({
  component: EditionsPage,
});

export { Route };
