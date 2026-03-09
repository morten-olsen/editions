import * as React from "react";
import { Link } from "@tanstack/react-router";
import { formatDate } from "./article-card.tsx";

type SourceCardProps = {
  id: string;
  name: string;
  url: string;
  lastFetchedAt?: string | null;
  fetchError?: string | null;
  href?: string;
};

const SourceCard = ({
  name,
  url,
  lastFetchedAt,
  fetchError,
  href,
}: SourceCardProps): React.ReactElement => {
  const content = (
    <div className="flex items-start justify-between gap-4 p-5 rounded-lg border border-border bg-surface-raised transition-all duration-fast ease-gentle hover:shadow-sm hover:border-border-strong">
      <div className="min-w-0">
        <div className="font-medium text-sm text-ink truncate">{name}</div>
        <div className="text-xs text-ink-tertiary truncate mt-0.5">{url}</div>
        {lastFetchedAt && (
          <div className="text-xs text-ink-faint mt-2">
            Last fetched {formatDate(lastFetchedAt)}
          </div>
        )}
      </div>
      {fetchError && (
        <div className="shrink-0 size-2 rounded-full bg-caution mt-1.5" title="Fetch error" />
      )}
    </div>
  );

  if (href) {
    return <Link to={href} className="block">{content}</Link>;
  }

  return content;
};

export type { SourceCardProps };
export { SourceCard };
