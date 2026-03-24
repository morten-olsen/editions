import * as React from 'react';
import { motion } from 'motion/react';

import * as Article from './article.tsx';
import { easeOut, formatArticleDate } from './article.tsx';

/* ── Shared article data shape ───────────────────────────────── */

type ArticleData = {
  title: string;
  sourceName: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  imageUrl?: string | null;
  content?: string | null;
  sourceType?: string | null;
};

type PresetProps = ArticleData & {
  /** Content injected between byline and body (e.g. media player) */
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onSaveUrl?: ((url: string) => Promise<void>) | null;
};

/* ── Editorial ───────────────────────────────────────────────── */
/* Centered single-column layout — the signature reading style   */

const Editorial = ({
  title,
  sourceName,
  author,
  summary,
  publishedAt,
  consumptionTimeSeconds,
  imageUrl,
  sourceType,
  content,
  children,
  footer,
  onSaveUrl,
}: PresetProps): React.ReactElement => {
  const hasContent = !!content;

  return (
    <Article.Root className="max-w-prose mx-auto w-full">
      <Article.Source name={sourceName} centered delay={0} />
      <Article.Title centered size="xl" delay={0.1}>
        {title}
      </Article.Title>
      <Article.Divider delay={0.2} />
      {imageUrl && <Article.Image src={imageUrl} delay={0.25} />}
      <Article.Summary centered hasContent={hasContent} delay={0.3}>
        {summary}
      </Article.Summary>
      <Article.Byline
        author={author}
        publishedAt={publishedAt}
        consumptionTimeSeconds={consumptionTimeSeconds}
        sourceType={sourceType}
        centered={!hasContent}
        delay={hasContent ? 0.4 : 0.35}
      />
      {children}
      {hasContent && <Article.Body content={content} onSaveUrl={onSaveUrl} delay={0.5} />}
      {footer}
    </Article.Root>
  );
};

/* ── Hero ─────────────────────────────────────────────────────── */
/* Two-column grid: text left, image right                       */

const Hero = ({
  title,
  sourceName,
  author,
  summary,
  publishedAt,
  consumptionTimeSeconds,
  imageUrl,
  sourceType,
  content,
  children,
  footer,
  onSaveUrl,
}: PresetProps): React.ReactElement => {
  const hasContent = !!content;

  return (
    <Article.Root>
      <div className="max-w-wide mx-auto w-full grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
        <div className="order-2 lg:order-1">
          <Article.Source name={sourceName} publishedAt={publishedAt} delay={0} />
          <Article.Title delay={0.1}>{title}</Article.Title>
          <Article.Summary hasContent={hasContent}>{summary}</Article.Summary>
          <Article.Byline author={author} consumptionTimeSeconds={consumptionTimeSeconds} sourceType={sourceType} />
        </div>
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}
            className="order-1 lg:order-2 aspect-[4/3] rounded-lg overflow-hidden bg-surface-sunken"
          >
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </motion.div>
        )}
      </div>
      {children && <div className="max-w-prose mx-auto w-full mt-8">{children}</div>}
      {(hasContent || footer) && (
        <div className="max-w-prose mx-auto w-full mt-12">
          {hasContent && <Article.Body content={content} onSaveUrl={onSaveUrl} />}
          {footer}
        </div>
      )}
    </Article.Root>
  );
};

/* ── Compact ─────────────────────────────────────────────────── */
/* Asymmetric sidebar with square image or accent border         */

const CompactSidebar = ({
  imageUrl,
  sourceName,
  publishedAt,
}: {
  imageUrl?: string | null;
  sourceName: string;
  publishedAt?: string | null;
}): React.ReactElement => (
  <div>
    {imageUrl ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="aspect-square rounded-lg overflow-hidden bg-surface-sunken"
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </motion.div>
    ) : (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="py-4 border-t-2 border-accent"
      >
        <div className="text-xs font-mono tracking-wide text-accent uppercase">{sourceName}</div>
        {publishedAt && <div className="text-xs text-ink-tertiary mt-1">{formatArticleDate(publishedAt)}</div>}
      </motion.div>
    )}
  </div>
);

const Compact = ({
  title,
  sourceName,
  author,
  summary,
  publishedAt,
  consumptionTimeSeconds,
  imageUrl,
  sourceType,
  content,
  children,
  footer,
  onSaveUrl,
}: PresetProps): React.ReactElement => {
  const hasContent = !!content;

  return (
    <Article.Root>
      <div className="max-w-wide mx-auto w-full">
        <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-12 items-start">
          <CompactSidebar imageUrl={imageUrl} sourceName={sourceName} publishedAt={publishedAt} />
          <div>
            {imageUrl && <Article.Source name={sourceName} delay={0} className="mb-3" />}
            <Article.Title size="base" delay={0.1}>
              {title}
            </Article.Title>
            <Article.Summary hasContent={hasContent} size="base">
              {summary}
            </Article.Summary>
            <Article.Byline author={author} consumptionTimeSeconds={consumptionTimeSeconds} sourceType={sourceType} />
          </div>
        </div>
      </div>
      {children && <div className="max-w-wide mx-auto w-full mt-8">{children}</div>}
      {(hasContent || footer) && (
        <div className="max-w-wide mx-auto w-full mt-8">
          {hasContent && <Article.Body content={content} onSaveUrl={onSaveUrl} />}
          {footer}
        </div>
      )}
    </Article.Root>
  );
};

/* ── Style selector ──────────────────────────────────────────── */

type ArticleStyle = 'editorial' | 'hero' | 'compact';

type ArticleViewProps = PresetProps & {
  style: ArticleStyle;
};

const ArticleView = ({ style, ...props }: ArticleViewProps): React.ReactElement => {
  switch (style) {
    case 'hero':
      return <Hero {...props} />;
    case 'compact':
      return <Compact {...props} />;
    case 'editorial':
    default:
      return <Editorial {...props} />;
  }
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { ArticleData, PresetProps, ArticleStyle, ArticleViewProps };
export { Editorial, Hero, Compact, CompactSidebar, ArticleView };
