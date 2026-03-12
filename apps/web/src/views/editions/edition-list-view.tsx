import { ReadingShell } from '../../components/app-shell.tsx';
import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';
import { ArticleCard } from '../../components/article-card.tsx';
import type { VoteValue } from '../../components/vote-controls.tsx';

import type { EditionDetail, FocusSection } from './edition-types.ts';
import { formatTime } from './edition-types.ts';

type EditionListViewProps = {
  edition: EditionDetail;
  sections: FocusSection[];
  votes: Record<string, VoteValue>;
  isRead: boolean;
  onToggleRead: () => void;
  onDelete: () => void;
  onVote: (articleId: string, value: VoteValue) => void;
  onMarkDone: () => void;
  onOpenMagazine: () => void;
  onBack: () => void;
};

const EditionListView = ({
  edition,
  sections,
  votes,
  isRead,
  onToggleRead,
  onDelete,
  onVote,
  onMarkDone,
  onOpenMagazine,
  onBack,
}: EditionListViewProps): React.ReactNode => {
  const promoImage = edition.articles.find((a) => a.imageUrl)?.imageUrl;

  const editionHeader = (
    <header className="border-b border-border bg-surface">
      <div className="max-w-prose mx-auto px-4 py-4 md:px-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block text-xs text-ink-tertiary">
            {edition.articleCount} articles
            {edition.totalReadingMinutes && ` · ${edition.totalReadingMinutes} min`}
          </div>
          <button
            type="button"
            onClick={onToggleRead}
            className="text-xs text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
          >
            {isRead ? 'Mark unread' : 'Mark read'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-ink-tertiary hover:text-critical transition-colors duration-fast cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </header>
  );

  return (
    <ReadingShell header={editionHeader}>
      {edition.articles.length > 0 && (
        <MagazinePromo
          promoImage={promoImage ?? null}
          articleCount={edition.articleCount}
          totalReadingMinutes={edition.totalReadingMinutes}
          onOpen={onOpenMagazine}
        />
      )}

      <EditionTitle edition={edition} sectionCount={sections.length} />

      {edition.articles.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-tertiary">
          No articles matched the criteria for this edition.
        </div>
      ) : (
        <EditionSections sections={sections} votes={votes} onVote={onVote} />
      )}

      <Separator soft className="mt-12" />
      <div className="py-10 text-center">
        <div className="font-serif text-xl text-ink mb-3">End of edition</div>
        <div className="text-sm text-ink-tertiary mb-6">
          {edition.articleCount} articles
          {edition.totalReadingMinutes && ` · ${edition.totalReadingMinutes} minutes`}
        </div>
        <Button variant="primary" size="sm" onClick={onMarkDone}>
          Done
        </Button>
      </div>
    </ReadingShell>
  );
};

/* ---- Magazine promo banner ---- */

const MagazinePromo = ({
  promoImage,
  articleCount,
  totalReadingMinutes,
  onOpen,
}: {
  promoImage: string | null;
  articleCount: number;
  totalReadingMinutes: number | null;
  onOpen: () => void;
}): React.ReactNode => (
  <button
    onClick={onOpen}
    className="group relative w-full rounded-lg overflow-hidden mb-12 text-left cursor-pointer transition-shadow duration-normal hover:shadow-lg"
  >
    {promoImage && (
      <div className="absolute inset-0">
        <img src={promoImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-r from-black/85 via-black/70 to-black/50" />
      </div>
    )}
    {!promoImage && <div className="absolute inset-0 bg-linear-to-r from-accent/15 to-accent/5" />}

    <div className={`relative flex items-center justify-between gap-6 px-6 py-5 ${promoImage ? 'text-white' : ''}`}>
      <div className="min-w-0">
        <div className={`text-xs font-mono tracking-wide mb-1.5 ${promoImage ? 'text-white/60' : 'text-accent'}`}>
          Magazine experience
        </div>
        <div className={`font-serif text-lg leading-snug ${promoImage ? 'text-white' : 'text-ink'}`}>
          Read this edition as an immersive magazine
        </div>
        <div className={`text-xs mt-1 ${promoImage ? 'text-white/50' : 'text-ink-tertiary'}`}>
          {articleCount} articles · {totalReadingMinutes ?? '?'} min · page-by-page
        </div>
      </div>
      <div
        className={`shrink-0 text-sm font-medium tracking-wide px-4 py-2 rounded-full transition-all duration-normal
        ${
          promoImage
            ? 'bg-white/15 text-white group-hover:bg-white/25 border border-white/20'
            : 'bg-accent text-accent-ink group-hover:bg-accent-hover'
        }`}
      >
        Open →
      </div>
    </div>
  </button>
);

/* ---- Edition title block ---- */

const EditionTitle = ({ edition, sectionCount }: { edition: EditionDetail; sectionCount: number }): React.ReactNode => (
  <div className="mb-12">
    <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-3">
      {new Date(edition.publishedAt).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}
    </div>
    <h1 className="font-serif text-4xl font-medium tracking-tight text-ink leading-tight mb-3">{edition.title}</h1>
    <div className="text-sm text-ink-secondary">
      {edition.articleCount} articles across {sectionCount} {sectionCount === 1 ? 'focus' : 'focuses'}
      {edition.totalReadingMinutes && ` · approximately ${edition.totalReadingMinutes} minutes`}
    </div>
  </div>
);

/* ---- Edition sections ---- */

const EditionSections = ({
  sections,
  votes,
  onVote,
}: {
  sections: FocusSection[];
  votes: Record<string, VoteValue>;
  onVote: (articleId: string, value: VoteValue) => void;
}): React.ReactNode => (
  <>
    {sections.map((section, i) => {
      const totalSeconds = section.articles.reduce((sum, a) => sum + (a.consumptionTimeSeconds ?? 0), 0);

      return (
        <div key={section.focusId}>
          {i > 0 && <Separator soft />}
          <section className="py-8">
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-mono text-accent tracking-wide">{String(i + 1).padStart(2, '0')}</span>
                <h2 className="font-serif text-xl font-medium tracking-tight text-ink">{section.focusName}</h2>
              </div>
              <div className="text-xs text-ink-tertiary">
                {section.articles.length} {section.articles.length === 1 ? 'article' : 'articles'}
                {totalSeconds > 0 && ` · ${formatTime(totalSeconds)}`}
              </div>
            </div>
            <div className="divide-y divide-border">
              {section.articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  sourceName={article.sourceName}
                  author={article.author}
                  summary={article.summary}
                  imageUrl={article.imageUrl}
                  publishedAt={article.publishedAt}
                  consumptionTimeSeconds={article.consumptionTimeSeconds}
                  sourceType={article.sourceType}
                  read={!!article.readAt}
                  href={`/sources/${article.sourceId}/articles/${article.id}`}
                  focusVote={votes[article.id] ?? null}
                  onFocusVote={(value) => void onVote(article.id, value)}
                />
              ))}
            </div>
          </section>
        </div>
      );
    })}
  </>
);

export type { EditionListViewProps };
export { EditionListView };
