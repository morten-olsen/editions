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
  const [sourceType, setSourceType] = useState<"rss" | "podcast">("rss");
  const [direction, setDirection] = useState<"newest" | "oldest">("newest");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; url: string; type: "rss" | "podcast"; direction: "newest" | "oldest" }): Promise<void> => {
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
    createMutation.mutate({ name, url, type: sourceType, direction });
  };

  return (
    <>
      <PageHeader title="Add source" subtitle={sourceType === "podcast" ? "Add a podcast feed" : "Add a new RSS feed to your collection"} />

      {error && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-md flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Type</label>
          <div className="flex gap-2">
            {(["rss", "podcast"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSourceType(t)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors duration-fast cursor-pointer ${sourceType === t ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-ink-secondary hover:border-ink-faint"}`}
              >
                {t === "rss" ? "RSS Feed" : "Podcast"}
              </button>
            ))}
          </div>
        </div>
        <Input
          label="Name"
          placeholder={sourceType === "podcast" ? "My Favorite Podcast" : "My Favorite Blog"}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Feed URL"
          type="url"
          placeholder={sourceType === "podcast" ? "https://example.com/feed.xml" : "https://example.com/feed.xml"}
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "newest" | "oldest")}
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first (series)</option>
          </select>
          <p className="text-xs text-ink-tertiary mt-1">
            Use "Oldest first" for serialized content that should be consumed in order.
          </p>
        </div>
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
