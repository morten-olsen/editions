import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Input } from "../components/input.tsx";
import { Button } from "../components/button.tsx";

type Source = {
  id: string;
  name: string;
  url: string;
};

const EditSourcePage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sourceId } = Route.useParams();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sourceQuery = useQuery({
    queryKey: queryKeys.sources.detail(sourceId),
    queryFn: async (): Promise<Source> => {
      const { data, error: err } = await client.GET("/api/sources/{id}", {
        params: { path: { id: sourceId } },
        headers,
      });
      if (err) throw new Error("Source not found");
      return data as Source;
    },
    enabled: !!headers,
  });

  useEffect(() => {
    if (sourceQuery.data) {
      setName(sourceQuery.data.name);
      setUrl(sourceQuery.data.url);
    }
  }, [sourceQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, string>): Promise<void> => {
      const { error: err } = await client.PATCH("/api/sources/{id}", {
        params: { path: { id: sourceId } },
        body,
        headers,
      });
      if (err) throw new Error("Failed to update source");
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sources.detail(sourceId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await navigate({ to: "/sources/$sourceId", params: { sourceId } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  if (!headers) return null;

  if (sourceQuery.isLoading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!sourceQuery.data) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? sourceQuery.error?.message ?? "Source not found"}</div>
      </div>
    );
  }

  const source = sourceQuery.data;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    const body: Record<string, string> = {};
    if (name !== source.name) body.name = name;
    if (url !== source.url) body.url = url;

    if (Object.keys(body).length === 0) {
      await navigate({ to: "/sources/$sourceId", params: { sourceId } });
      return;
    }

    updateMutation.mutate(body);
  };

  return (
    <>
      <PageHeader title="Edit source" />

      {error && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-md flex flex-col gap-5">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Feed URL"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-2">
          <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void navigate({ to: "/sources/$sourceId", params: { sourceId } })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};

const Route = createFileRoute("/sources/$sourceId/edit")({
  component: EditSourcePage,
});

export { Route };
