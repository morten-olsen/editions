import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";

import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { SourceCard } from "../components/source-card.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { Button } from "../components/button.tsx";

type Source = {
  id: string;
  name: string;
  url: string;
  type: string;
  lastFetchedAt: string | null;
  fetchError: string | null;
  createdAt: string;
};

const SourcesPage = (): React.ReactNode => {
  const headers = useAuthHeaders();

  const sourcesQuery = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: async (): Promise<Source[]> => {
      const { data } = await client.GET("/api/sources", { headers });
      return ((data as Source[]) ?? []).filter((s) => s.type !== "bookmarks");
    },
    enabled: !!headers,
  });

  const reanalyseMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await client.POST("/api/sources/reanalyse-all", { headers });
    },
  });

  const sources = sourcesQuery.data ?? [];
  const loading = sourcesQuery.isLoading;

  return (
    <>
      <PageHeader
        title="Sources"
        subtitle={loading ? "Loading..." : `${sources.length} feeds configured`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={reanalyseMutation.isPending}
              onClick={() => reanalyseMutation.mutate()}
            >
              {reanalyseMutation.isPending ? "Reanalysing..." : "Reanalyse all"}
            </Button>
            <Link to="/sources/new" data-ai-id="add-source-btn" data-ai-role="button" data-ai-label="Add source">
              <Button variant="primary" size="sm">Add source</Button>
            </Link>
          </div>
        }
      />

      {!loading && sources.length === 0 ? (
        <EmptyState
          title="No sources yet"
          description="Add your first RSS feed to start building your reading experience."
          action={
            <Link to="/sources/new">
              <Button variant="primary">Add source</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3" data-ai-id="sources-list" data-ai-role="list" data-ai-label="Sources">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              id={source.id}
              name={source.name}
              url={source.url}
              lastFetchedAt={source.lastFetchedAt}
              fetchError={source.fetchError}
              href={`/sources/${source.id}`}
            />
          ))}
        </div>
      )}
    </>
  );
};

const Route = createFileRoute("/sources/")({
  component: SourcesPage,
});

export { Route };
