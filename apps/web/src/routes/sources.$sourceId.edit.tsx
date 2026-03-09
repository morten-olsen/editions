import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
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
  const auth = useAuth();
  const navigate = useNavigate();
  const { sourceId } = Route.useParams();
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchSource = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const { data, error: err } = await client.GET("/api/sources/{id}", {
      params: { path: { id: sourceId } },
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (err) {
      setError("Source not found");
    } else {
      const s = data as Source;
      setSource(s);
      setName(s.name);
      setUrl(s.url);
    }
    setLoading(false);
  }, [auth, sourceId]);

  useEffect(() => {
    void fetchSource();
  }, [fetchSource]);

  if (auth.status !== "authenticated") return null;

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!source) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? "Source not found"}</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const body: Record<string, string> = {};
    if (name !== source.name) body.name = name;
    if (url !== source.url) body.url = url;

    if (Object.keys(body).length === 0) {
      await navigate({ to: "/sources/$sourceId", params: { sourceId } });
      return;
    }

    const { error: err } = await client.PATCH("/api/sources/{id}", {
      params: { path: { id: sourceId } },
      body,
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (err) {
      setError("Failed to update source");
      setSubmitting(false);
      return;
    }

    await navigate({ to: "/sources/$sourceId", params: { sourceId } });
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
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
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
