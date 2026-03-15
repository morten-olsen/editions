import { createFileRoute, Link } from '@tanstack/react-router';

import { useSourceDetail } from '../hooks/sources/sources.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { Separator } from '../components/separator.tsx';
import { ArticleCard } from '../components/article-card.tsx';

const SourceDetailPage = (): React.ReactNode => {
  const { sourceId } = Route.useParams();
  const detail = useSourceDetail({ sourceId });

  if (!detail.ready) {
    return null;
  }

  if (detail.loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!detail.source) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{detail.sourceQuery.error?.message ?? 'Source not found'}</div>
      </div>
    );
  }

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      <SourceHeader source={detail.source} sourceId={sourceId} detail={detail} />
      <SourceStatusMessages
        source={detail.source}
        fetchResult={detail.fetchResult}
        reanalyseResult={detail.reanalyseResult}
      />
      <SourceMeta source={detail.source} articlesPage={detail.articlesPage} />
      <Separator soft className="mb-6" />
      <SourceArticles source={detail.source} sourceId={sourceId} detail={detail} />
    </div>
  );
};

/* ---- Header ---- */

type SourceData = {
  name: string;
  url: string;
  type: string;
  lastFetchedAt: string | null;
  fetchError: string | null;
};

type DetailActions = {
  fetchMutation: { isPending: boolean };
  reanalyseMutation: { isPending: boolean };
  handleFetch: () => void;
  handleReanalyse: () => void;
};

const SourceHeader = ({
  source,
  sourceId,
  detail,
}: {
  source: SourceData;
  sourceId: string;
  detail: DetailActions;
}): React.ReactNode => (
  <PageHeader
    title={source.name}
    subtitle={source.url}
    actions={
      <div className="flex items-center gap-2">
        <Link
          to="/sources/$sourceId/edit"
          params={{ sourceId }}
          data-ai-id="source-edit"
          data-ai-role="link"
          data-ai-label="Edit source"
        >
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </Link>
        <Button
          variant="secondary"
          size="sm"
          disabled={detail.reanalyseMutation.isPending}
          onClick={detail.handleReanalyse}
          data-ai-id="source-reanalyse"
          data-ai-role="button"
          data-ai-label="Reanalyse articles"
          data-ai-state={detail.reanalyseMutation.isPending ? 'loading' : 'idle'}
        >
          {detail.reanalyseMutation.isPending ? 'Reanalysing...' : 'Reanalyse'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={detail.fetchMutation.isPending}
          onClick={detail.handleFetch}
          data-ai-id="source-fetch"
          data-ai-role="button"
          data-ai-label="Fetch articles"
          data-ai-state={detail.fetchMutation.isPending ? 'loading' : 'idle'}
        >
          {detail.fetchMutation.isPending ? 'Fetching...' : 'Fetch now'}
        </Button>
      </div>
    }
  />
);

/* ---- Status messages ---- */

const SourceStatusMessages = ({
  source,
  fetchResult,
  reanalyseResult,
}: {
  source: SourceData;
  fetchResult: string | null;
  reanalyseResult: string | null;
}): React.ReactNode => (
  <>
    {source.fetchError && (
      <div
        className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-4"
        data-ai-id="source-fetch-error"
        data-ai-role="error"
        data-ai-error={source.fetchError}
      >
        {source.fetchError}
      </div>
    )}
    {fetchResult && (
      <div
        className="text-sm text-ink-secondary mb-4"
        data-ai-id="source-fetch-result"
        data-ai-role="status"
        data-ai-label={fetchResult}
      >
        {fetchResult}
      </div>
    )}
    {reanalyseResult && (
      <div
        className="text-sm text-ink-secondary mb-4"
        data-ai-id="source-reanalyse-result"
        data-ai-role="status"
        data-ai-label={reanalyseResult}
      >
        {reanalyseResult}
      </div>
    )}
  </>
);

/* ---- Meta ---- */

type ArticlesPage = {
  total: number;
  articles: {
    id: string;
    title: string;
    author: string | null;
    summary: string | null;
    imageUrl: string | null;
    publishedAt: string | null;
    sourceType?: string;
  }[];
};

const SourceMeta = ({
  source,
  articlesPage,
}: {
  source: SourceData;
  articlesPage: ArticlesPage | null | undefined;
}): React.ReactNode => (
  <div
    className="flex items-center gap-4 text-xs text-ink-tertiary mb-6"
    data-ai-id="source-meta"
    data-ai-role="info"
    data-ai-label={`Last fetched: ${source.lastFetchedAt ? new Date(source.lastFetchedAt).toLocaleString() : 'never'}, ${articlesPage?.total ?? 0} articles`}
  >
    {source.lastFetchedAt && <span>Last fetched {new Date(source.lastFetchedAt).toLocaleString()}</span>}
    {articlesPage && <span>{articlesPage.total} articles</span>}
  </div>
);

/* ---- Articles list ---- */

type SourceArticlesProps = {
  source: SourceData;
  sourceId: string;
  detail: DetailActions & {
    articlesPage: ArticlesPage | null | undefined;
    pagination: {
      totalPages: number;
      currentPage: number;
      hasPrev: boolean;
      hasNext: boolean;
      goPrev: () => void;
      goNext: () => void;
    };
  };
};

const SourceArticles = ({ source, sourceId, detail }: SourceArticlesProps): React.ReactNode => {
  const { articlesPage, pagination, fetchMutation, handleFetch } = detail;

  if (!articlesPage || articlesPage.articles.length === 0) {
    return (
      <EmptyState
        title="No articles yet"
        description="Try fetching the feed to pull in articles."
        action={
          <Button variant="primary" disabled={fetchMutation.isPending} onClick={handleFetch}>
            {fetchMutation.isPending ? 'Fetching...' : 'Fetch now'}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div
        className="divide-y divide-border"
        data-ai-id="source-articles"
        data-ai-role="list"
        data-ai-label={`Articles (${articlesPage.total} total, showing ${articlesPage.articles.length})`}
      >
        {articlesPage.articles.map((article) => (
          <ArticleCard
            key={article.id}
            id={article.id}
            title={article.title}
            sourceName={source.name}
            author={article.author}
            summary={article.summary}
            imageUrl={article.imageUrl}
            publishedAt={article.publishedAt}
            sourceType={source.type}
            href={`/sources/${sourceId}/articles/${article.id}`}
          />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div
          className="flex items-center justify-between mt-6 pt-6 border-t border-border"
          data-ai-id="source-pagination"
          data-ai-role="info"
          data-ai-label={`Page ${pagination.currentPage} of ${pagination.totalPages}`}
        >
          <Button
            variant="ghost"
            size="sm"
            disabled={!pagination.hasPrev}
            onClick={pagination.goPrev}
            data-ai-id="source-prev-page"
            data-ai-role="button"
            data-ai-label="Previous page"
          >
            Previous
          </Button>
          <span className="text-xs text-ink-tertiary">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!pagination.hasNext}
            onClick={pagination.goNext}
            data-ai-id="source-next-page"
            data-ai-role="button"
            data-ai-label="Next page"
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
};

const Route = createFileRoute('/sources/$sourceId/')({
  component: SourceDetailPage,
});

export { Route };
