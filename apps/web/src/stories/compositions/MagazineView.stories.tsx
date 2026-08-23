import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '../../auth/auth.tsx';
import { MagazineCover, MagazineFinale, MagazineSection, MagazineToc } from '../../components/magazine/magazine.tsx';
import { MagazineView } from '../../views/editions/edition-magazine-view.tsx';
import type { EditionArticle, EditionDetail } from '../../views/editions/edition-types.ts';
import { groupByFocus } from '../../views/editions/edition-types.ts';

/* ── Sample content ───────────────────────────────────────────── */

const readerDesign = `For the better part of a decade the dominant paradigm in digital reading has been the infinite scroll. Twitter pioneered it, Facebook perfected it, and RSS readers adopted it wholesale. The assumption was simple: more content, delivered faster, in an unbroken stream. A growing number of designers now question whether that assumption ever served readers at all.

The problem isn't technical, it's attentional. When everything arrives in a single undifferentiated stream, nothing feels important. A three-thousand-word investigation sits alongside a two-sentence hot take. A post from a friend you haven't heard from in months drowns under a flood of content from accounts you barely remember following.

## The finite alternative

"The most radical thing you can do is give someone an ending," says Mira Chen, lead designer at Streamline. "Every other app in the attention economy is designed to keep you scrolling. We designed ours so you reach the bottom and feel *done*."

Streamline isn't alone. A wave of reading apps share a philosophy: reading should be bounded, curated and calm. They draw on print magazines and morning newspapers — media that arrived finite by nature.

> We're not building a feed. We're building something closer to a daily newspaper, assembled with intention and meant to be finished.

## Source budgeting

One technique gaining traction is **source budgeting** — limiting how many articles any single source can contribute. The idea is proportional representation: a prolific wire service shouldn't crowd out a blog that publishes once a week. The reader subscribed to both for a reason.

This requires rethinking how a feed is assembled. Instead of sorting by recency and calling it done, these apps build editions: a bounded set balanced across topics, sources, reading time and importance.

## Reading time as a first-class idea

The most visible change is the emphasis on time. Rather than showing counts — 47 unread — these apps frame everything in minutes. The shift is psychological as much as practical: reading stops being an obligation to clear and becomes a choice to make.

For that to work an app has to know how long a piece actually takes, which means extracting the full text rather than the summary. The investment pays off elsewhere too: better classification, offline reading, and a consistent visual treatment across every source.`;

const sqlite = `SQLite has quietly become the default for a certain kind of application: single-tenant, self-hosted, read-heavy, and happier without a database server to operate.

The case is mostly operational. There is no connection pool to size, no failover to rehearse, no separate process to monitor. The database is a file, and the file is the backup.

## Where it stops being enough

Write concurrency is the usual wall. \`WAL\` mode allows one writer alongside many readers, which is plenty for one household and not enough for a busy multi-tenant service.

The honest answer is that most projects never reach that wall, and the ones that do can migrate a query layer that was dialect-agnostic to begin with.`;

const now = Date.now();

const article = (
  overrides: Partial<EditionArticle> & Pick<EditionArticle, 'id' | 'title' | 'sourceName' | 'focusId' | 'focusName'>,
): EditionArticle => ({
  sourceId: `source-${overrides.id}`,
  author: null,
  summary: null,
  url: 'https://example.com/article',
  imageUrl: null,
  publishedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
  consumptionTimeSeconds: 420,
  content: null,
  mediaUrl: null,
  mediaType: null,
  sourceType: 'rss',
  progress: 0,
  position: 0,
  ...overrides,
});

const articles: EditionArticle[] = [
  article({
    id: 'a1',
    title: 'The quiet revolution in reader design',
    sourceName: 'Ars Technica',
    author: 'Samuel Axon',
    summary: 'How a new generation of reading apps is rethinking attention, one finite edition at a time.',
    imageUrl: 'https://picsum.photos/seed/reader-design/1200/750',
    content: readerDesign,
    consumptionTimeSeconds: 540,
    focusId: 'f1',
    focusName: 'Technology',
  }),
  article({
    id: 'a2',
    title: 'SQLite in production, eleven years on',
    sourceName: 'The Pragmatic Engineer',
    author: 'Gergely Orosz',
    summary: 'The operational case for a database that is just a file, and the point at which it stops holding.',
    imageUrl: 'https://picsum.photos/seed/sqlite-prod/1200/750',
    content: sqlite,
    consumptionTimeSeconds: 300,
    focusId: 'f1',
    focusName: 'Technology',
  }),
  article({
    id: 'a3',
    title: 'What the tide gauges know',
    sourceName: 'Nature',
    author: 'Priya Sharma',
    summary: 'A century of unglamorous measurements is turning out to be the most reliable climate record we have.',
    imageUrl: 'https://picsum.photos/seed/tide-gauges/1200/750',
    content: readerDesign,
    consumptionTimeSeconds: 480,
    focusId: 'f2',
    focusName: 'Science',
  }),
];

const edition: EditionDetail = {
  id: 'edition-1',
  editionConfigId: 'config-1',
  title: 'Morning Briefing',
  totalReadingMinutes: 22,
  articleCount: articles.length,
  currentPosition: 0,
  readAt: null,
  publishedAt: new Date(now).toISOString(),
  articles,
};

const sections = groupByFocus(articles);

/** Stories are for looking at, not for wiring up. */
const noop = (): void => undefined;
const noopAsync = (): Promise<void> => Promise.resolve();

/* ── Frames ───────────────────────────────────────────────────── */

const PageFrame = ({ width, height, children }: { width: number; height: number; children: React.ReactNode }) => (
  <div className="flex h-screen w-screen items-center justify-center bg-surface-sunken p-6">
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xl" style={{ width, height }}>
      {children}
    </div>
  </div>
);

/* ── Meta ─────────────────────────────────────────────────────── */

/**
 * The view keeps a reader's place through the API, so it needs the same
 * providers the app gives it. Requests fail harmlessly here — progress saving
 * is best-effort by design.
 */
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const withProviders = (story: () => React.ReactElement): React.ReactElement => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{story()}</AuthProvider>
  </QueryClientProvider>
);

const meta: Meta = {
  title: 'Design System/Compositions/Magazine',
  decorators: [withProviders],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A whole issue as pages: cover, contents, a divider per focus, the articles typeset between them, and a last page. Arrow keys, edge clicks or swipes turn the page.',
      },
    },
  },
};

export default meta;

type Story = StoryObj;

/* ── Stories ──────────────────────────────────────────────────── */

/** The full issue. On a wide window the cover stands alone, then spreads. */
export const FullIssue: Story = {
  render: () => (
    <MagazineView
      edition={edition}
      sections={sections}
      votes={{}}
      globalVotes={{}}
      focusVotes={{}}
      bookmarkedIds={new Set()}
      onVote={noop}
      onGlobalVote={noop}
      onFocusVote={noop}
      onBookmarkToggle={noop}
      onSaveUrl={noopAsync}
      onMarkArticleViewed={noop}
      onExit={noop}
      onMarkDone={noop}
    />
  ),
};

/** The cover, alone, the way an issue opens. */
export const Cover: Story = {
  render: () => (
    <PageFrame width={700} height={940}>
      <MagazineCover
        editionTitle={edition.title}
        date={edition.publishedAt}
        totalReadingMinutes={edition.totalReadingMinutes ?? 0}
        articleCount={edition.articleCount}
        focusCount={sections.length}
        lead={articles[0] as EditionArticle}
        highlights={articles.slice(1, 3)}
      />
    </PageFrame>
  ),
};

export const Contents: Story = {
  render: () => (
    <PageFrame width={700} height={940}>
      <MagazineToc
        editionTitle={edition.title}
        sections={sections.map((section, index) => ({
          focusName: section.focusName,
          startPage: 2 + index,
          articles: section.articles.map((article, position) => ({
            title: article.title,
            sourceName: article.sourceName,
            consumptionTimeSeconds: article.consumptionTimeSeconds,
            sourceType: article.sourceType,
            page: 3 + index + position,
          })),
        }))}
        onNavigate={noop}
      />
    </PageFrame>
  ),
};

export const SectionDivider: Story = {
  render: () => (
    <PageFrame width={700} height={940}>
      <MagazineSection focusName="Technology" index={0} articleCount={2} totalReadingMinutes={14} />
    </PageFrame>
  ),
};

export const LastPage: Story = {
  render: () => (
    <PageFrame width={700} height={940}>
      <MagazineFinale articleCount={7} totalReadingMinutes={14} editionTitle="Morning Briefing" onMarkDone={noop} />
    </PageFrame>
  ),
};
