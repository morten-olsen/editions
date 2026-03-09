import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Input } from "../components/input.tsx";
import { Button } from "../components/button.tsx";

const NewSourcePage = (): React.ReactNode => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.status !== "authenticated") return null;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: err } = await client.POST("/api/sources", {
      body: { name, url },
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (err) {
      setError("error" in err ? (err as { error: string }).error : "Failed to create source");
      setSubmitting(false);
      return;
    }

    await navigate({ to: "/sources" });
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
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add source"}
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
