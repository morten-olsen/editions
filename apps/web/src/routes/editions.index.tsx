import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
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
  const auth = useAuth();
  const [configs, setConfigs] = useState<EditionConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    const { data } = await client.GET("/api/editions/configs", {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (data) {
      setConfigs(data as EditionConfig[]);
    }
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  if (auth.status !== "authenticated") return null;

  const handleDelete = async (id: string, name: string): Promise<void> => {
    if (!confirm(`Delete "${name}"? This will also delete all generated editions.`)) return;

    await client.DELETE("/api/editions/configs/{configId}", {
      params: { path: { configId: id } },
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <>
      <PageHeader
        title="Editions"
        subtitle={loading ? "Loading..." : `${configs.length} edition configurations`}
        actions={
          <Link to="/editions/new">
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
        <div className="grid gap-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between py-4 border-b border-border last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to="/editions/$configId"
                  params={{ configId: config.id }}
                  className="font-serif text-lg font-medium tracking-tight text-ink hover:text-accent transition-colors duration-fast"
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
                onClick={() => void handleDelete(config.id, config.name)}
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

const Route = createFileRoute("/editions/")({
  component: EditionsPage,
});

export { Route };
