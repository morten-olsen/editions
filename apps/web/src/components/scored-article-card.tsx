import { formatDate, formatTime } from './article-card.tsx';

/* ── Scored article card ──────────────────────────────────────────
 * Used in builder preview panels to show articles with their
 * classification confidence score. Compact, informational — the
 * user is evaluating how well their configuration captures content.
 * ────────────────────────────────────────────────────────────────── */

type ScoredArticleCardProps = {
  id: string;
  title: string;
  sourceName: string;
  author?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  confidence: number;
  /** Whether this article passes the current threshold */
  included: boolean;
};

const confidenceColor = (confidence: number, included: boolean): string => {
  if (!included) return 'text-ink-faint';
  if (confidence >= 0.7) return 'text-positive';
  if (confidence >= 0.4) return 'text-accent';
  return 'text-caution';
};

const ScoredArticleCard = ({
  id,
  title,
  sourceName,
  author,
  publishedAt,
  consumptionTimeSeconds,
  confidence,
  included,
}: ScoredArticleCardProps): React.ReactElement => {
  const pct = Math.round(confidence * 100);

  return (
    <div
      className={`py-3 transition-opacity duration-fast ${included ? '' : 'opacity-40'}`}
      data-ai-id={`scored-article-${id}`}
      data-ai-role="section"
      data-ai-label={`${title} — ${pct}% match`}
      data-ai-state={included ? 'included' : 'excluded'}
    >
      <div className="flex items-start gap-3">
        {/* Confidence badge */}
        <div
          className={`shrink-0 w-10 h-10 rounded-md flex items-center justify-center font-mono text-xs font-medium ${
            included ? 'bg-surface-sunken' : 'bg-surface-sunken/50'
          } ${confidenceColor(confidence, included)}`}
        >
          {pct}%
        </div>

        <div className="flex-1 min-w-0">
          {/* Source */}
          <div className="font-mono text-xs tracking-wide text-accent mb-0.5">{sourceName}</div>

          {/* Title */}
          <div className={`font-serif text-sm font-medium tracking-tight leading-snug ${included ? 'text-ink' : 'text-ink-tertiary'}`}>
            {title}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-1.5 text-xs text-ink-faint mt-0.5">
            {author && <span>{author}</span>}
            {author && publishedAt && <span>·</span>}
            {publishedAt && <span>{formatDate(publishedAt)}</span>}
            {consumptionTimeSeconds != null && (
              <>
                <span>·</span>
                <span>{formatTime(consumptionTimeSeconds)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export type { ScoredArticleCardProps };
export { ScoredArticleCard };
