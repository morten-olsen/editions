import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
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
  const auth = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    const { data } = await client.GET("/api/sources", {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (data) {
      setSources((data as Source[]).filter((s) => s.type !== "bookmarks"));
    }
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  if (auth.status !== "authenticated") return null;

  return (
    <>
      <PageHeader
        title="Sources"
        subtitle={loading ? "Loading..." : `${sources.length} feeds configured`}
        actions={
          <Link to="/sources/new">
            <Button variant="primary" size="sm">Add source</Button>
          </Link>
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
        <div className="grid gap-3">
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
