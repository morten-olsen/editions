import * as React from "react";
import { ArticleCard } from "./article-card.tsx";
import type { ArticleCardProps } from "./article-card.tsx";
import { formatTime } from "./article-card.tsx";

type EditionSectionProps = {
  focusName: string;
  articles: ArticleCardProps[];
  index?: number;
};

const EditionSection = ({
  focusName,
  articles,
  index = 0,
}: EditionSectionProps): React.ReactElement => {
  const totalSeconds = articles.reduce(
    (sum, a) => sum + (a.consumptionTimeSeconds ?? 0),
    0,
  );

  return (
    <section className="py-8">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-mono text-accent tracking-wide">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="font-serif text-xl font-medium tracking-tight text-ink">
            {focusName}
          </h2>
        </div>
        <div className="text-xs text-ink-tertiary">
          {articles.length} {articles.length === 1 ? "article" : "articles"}
          {totalSeconds > 0 && ` · ${formatTime(totalSeconds)}`}
        </div>
      </div>
      <div className="divide-y divide-border">
        {articles.map((article) => (
          <ArticleCard key={article.id} {...article} />
        ))}
      </div>
    </section>
  );
};

export type { EditionSectionProps };
export { EditionSection };
