import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Input } from "../components/input.tsx";
import { Button } from "../components/button.tsx";

const NewSourcePage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; url: string }): Promise<void> => {
      const { error: err } = await client.POST("/api/sources", {
        body,
        headers,
      });
      if (err) {
        throw new Error(
          "error" in err ? (err as { error: string }).error : "Failed to create source",
        );
      }
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await navigate({ to: "/sources" });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  if (!headers) return null;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    createMutation.mutate({ name, url });
  };

  return (
    <>
      <PageHeader title="Add source" subtitle="Add a new RSS feed to your collection" />

      {error && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-md flex flex-col gap-5">
        <Input
          label="Name"
          placeholder="My Favorite Blog"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Feed URL"
          type="url"
          placeholder="https://example.com/feed.xml"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-2">
          <Button variant="primary" type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding..." : "Add source"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void navigate({ to: "/sources" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};

const Route = createFileRoute("/sources/new")({
  component: NewSourcePage,
});

export { Route };
