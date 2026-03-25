import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ModeShell, defaultPathForMode, type Mode } from '../../components/mode-shell.tsx';

/* ── Placeholder content per mode ────────────────────────────────── */

const now = Date.now();

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/* Magazine cover cards — reused from HomePage patterns */
type MagazineCover = {
  id: string;
  title: string;
  configName: string;
  articleCount: number;
  readingMinutes: number;
  publishedAt: string;
  leadTitle: string;
  leadSource: string;
  imageUrl: string | null;
  sections: string[];
};

const magazines: MagazineCover[] = [
  {
    id: '1',
    title: 'Morning Brief',
    configName: 'Morning Brief',
    articleCount: 8,
    readingMinutes: 14,
    publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    leadTitle: 'The quiet revolution in reader design',
    leadSource: 'Ars Technica',
    imageUrl: 'https://picsum.photos/seed/chrome-reader/800/600',
    sections: ['Technology', 'Science', 'Global News'],
  },
  {
    id: '2',
    title: 'Deep Reads',
    configName: 'Deep Reads',
    articleCount: 12,
    readingMinutes: 34,
    publishedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
    leadTitle: 'On finite feeds and calm software',
    leadSource: 'Hacker News',
    imageUrl: null,
    sections: ['Technology', 'Culture', 'Science'],
  },
  {
    id: '3',
    title: 'Morning Brief',
    configName: 'Morning Brief',
    articleCount: 6,
    readingMinutes: 11,
    publishedAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
    leadTitle: 'Pacific trade agreement reaches final ratification',
    leadSource: 'Reuters',
    imageUrl: 'https://picsum.photos/seed/chrome-trade/800/600',
    sections: ['Global News', 'Technology'],
  },
];

const MagazineCoverCard = ({ mag }: { mag: MagazineCover }): React.ReactElement => {
  const hasImage = !!mag.imageUrl;
  return (
    <div className="group rounded-lg overflow-hidden relative isolate cursor-pointer">
      {hasImage ? (
        <div className="absolute inset-0 -z-10">
          <img src={mag.imageUrl!} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/40 to-black/80" />
        </div>
      ) : (
        <div className="absolute inset-0 -z-10 bg-surface-sunken" />
      )}
      <div className={`flex flex-col justify-between p-5 min-h-56 ${hasImage ? 'text-white' : ''}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className={`font-mono text-xs tracking-wide uppercase ${hasImage ? 'text-white/80' : 'text-accent'}`}>
            {mag.configName}
          </span>
          <span className={`font-mono text-xs tracking-wide ${hasImage ? 'text-white/50' : 'text-ink-faint'}`}>
            {formatDate(mag.publishedAt)}
          </span>
        </div>
        <div className="mt-auto pt-4">
          <div className={`font-mono text-xs tracking-wide mb-2 ${hasImage ? 'text-white/60' : 'text-ink-faint'}`}>
            {mag.leadSource}
          </div>
          <h3
            className={`font-serif text-xl md:text-2xl font-medium tracking-tight leading-snug mb-3 ${hasImage ? 'text-white' : 'text-ink'}`}
          >
            {mag.leadTitle}
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {mag.sections.map((s) => (
              <span
                key={s}
                className={`text-xs px-2 py-0.5 rounded-full ${hasImage ? 'bg-white/15 text-white/80' : 'bg-surface text-ink-tertiary'}`}
              >
                {s}
              </span>
            ))}
          </div>
          <div
            className={`font-mono text-xs tracking-wide flex items-center gap-3 ${hasImage ? 'text-white/50' : 'text-ink-faint'}`}
          >
            <span>{mag.articleCount} articles</span>
            <span className={hasImage ? 'text-white/30' : 'text-ink-faint'}>·</span>
            <span>{mag.readingMinutes} min</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MagazineTeaser = ({ mag }: { mag: MagazineCover }): React.ReactElement => (
  <div className="py-4 border-t border-border cursor-pointer">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs tracking-wide text-accent uppercase mb-1.5">
          {mag.configName} · {formatDate(mag.publishedAt)}
        </div>
        <div className="font-serif text-lg font-medium tracking-tight text-ink leading-snug">{mag.leadTitle}</div>
        <div className="font-mono text-xs text-ink-faint mt-1.5 tracking-wide">
          {mag.articleCount} articles · {mag.readingMinutes} min
        </div>
      </div>
      {mag.imageUrl && (
        <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-surface-sunken">
          <img src={mag.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  </div>
);

const MagazinesContent = (): React.ReactElement => (
  <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
    <div className="mb-10">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <span className="font-mono text-xs tracking-wide uppercase text-ink-faint">Editions</span>
        <span className="font-mono text-xs tracking-wide text-ink-faint">Saturday, 15 March 2026</span>
      </div>
      <div className="h-px bg-border-strong" />
    </div>
    <div className="mb-6">
      <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">Your reading list</h1>
      <p className="text-sm text-ink-tertiary">3 editions waiting.</p>
    </div>
    <MagazineCoverCard mag={magazines[0]!} />
    <div className="mt-2">
      <MagazineTeaser mag={magazines[1]!} />
      <MagazineTeaser mag={magazines[2]!} />
      <div className="h-px bg-border" />
    </div>
  </div>
);

/* Feed placeholder content */
type FeedArticle = {
  id: string;
  title: string;
  sourceName: string;
  author?: string;
  summary: string;
  publishedAt: string;
  readingMinutes: number;
};

const feedArticles: FeedArticle[] = [
  {
    id: '1',
    title: 'The quiet revolution in reader design',
    sourceName: 'Ars Technica',
    author: 'Samuel Axon',
    summary:
      "How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span.",
    publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    readingMinutes: 8,
  },
  {
    id: '2',
    title: "Europe's new data sovereignty framework explained",
    sourceName: 'The Guardian',
    author: 'Alex Hern',
    summary:
      'The Digital Markets Act enters its second phase, requiring tech giants to open their platforms to interoperability.',
    publishedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    readingMinutes: 6,
  },
  {
    id: '3',
    title: "JWST captures light from the universe's first galaxies",
    sourceName: 'Nature',
    author: 'Dr. Emily Carter',
    summary: 'New observations push the frontier of known galaxies back another 200 million years.',
    publishedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    readingMinutes: 5,
  },
  {
    id: '4',
    title: "Why SQLite is the database you didn't know you needed",
    sourceName: 'Hacker News',
    summary: 'A deep dive into why embedded databases are making a comeback in server-side applications.',
    publishedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
    readingMinutes: 12,
  },
];

const FeedArticleRow = ({ article }: { article: FeedArticle }): React.ReactElement => (
  <div className="py-4 border-t border-border cursor-pointer group">
    <div className="flex items-baseline gap-3 mb-1.5">
      <span className="font-mono text-xs tracking-wide text-accent">{article.sourceName}</span>
      {article.author && <span className="text-xs text-ink-faint">· {article.author}</span>}
    </div>
    <h3 className="font-serif text-lg font-medium tracking-tight text-ink leading-snug group-hover:text-accent transition-colors duration-fast">
      {article.title}
    </h3>
    <p className="text-sm text-ink-secondary mt-1 leading-relaxed line-clamp-2">{article.summary}</p>
    <div className="font-mono text-xs text-ink-faint mt-2 tracking-wide">
      {formatDate(article.publishedAt)} · {article.readingMinutes} min read
    </div>
  </div>
);

const FeedContent = (): React.ReactElement => (
  <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
    <div className="flex items-baseline justify-between mb-6">
      <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Feed</h1>
      <div className="flex gap-2">
        <button
          type="button"
          className="font-mono text-xs tracking-wide px-2.5 py-1 rounded-md bg-accent-subtle text-accent"
        >
          Top
        </button>
        <button
          type="button"
          className="font-mono text-xs tracking-wide px-2.5 py-1 rounded-md text-ink-faint hover:text-ink-tertiary transition-colors duration-fast cursor-pointer"
        >
          Recent
        </button>
      </div>
    </div>
    <div>
      {feedArticles.map((article) => (
        <FeedArticleRow key={article.id} article={article} />
      ))}
      <div className="h-px bg-border" />
    </div>
    <div className="py-12 text-center text-sm text-ink-tertiary">
      You've reached the end — {feedArticles.length} articles
    </div>
  </div>
);

/* Builder placeholder content */
const BuilderContent = (): React.ReactElement => (
  <div className="max-w-wide mx-auto px-4 py-6 md:px-8 md:py-8">
    <div className="mb-8">
      <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">Builder</h1>
      <p className="text-sm text-ink-secondary leading-relaxed">
        Configure your sources, focuses, and editions. Every change shows its effect immediately.
      </p>
    </div>

    {/* Builder nav tabs */}
    <div className="flex gap-1 mb-8 border-b border-border">
      <button
        type="button"
        className="relative font-mono text-xs tracking-wide uppercase px-3 py-2.5 text-ink cursor-pointer"
      >
        Sources
        <span className="absolute inset-x-3 bottom-0 h-px bg-ink" />
      </button>
      <button
        type="button"
        className="font-mono text-xs tracking-wide uppercase px-3 py-2.5 text-ink-faint hover:text-ink-tertiary transition-colors duration-fast cursor-pointer"
      >
        Focuses
      </button>
      <button
        type="button"
        className="font-mono text-xs tracking-wide uppercase px-3 py-2.5 text-ink-faint hover:text-ink-tertiary transition-colors duration-fast cursor-pointer"
      >
        Editions
      </button>
    </div>

    {/* Source cards grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {['Ars Technica', 'The Guardian', 'Nature', 'Hacker News', 'Reuters', 'NPR'].map((name) => (
        <div key={name} className="rounded-lg border border-border bg-surface-raised p-4 cursor-pointer group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-md bg-accent-subtle flex items-center justify-center">
              <span className="font-mono text-xs text-accent font-medium">{name[0]}</span>
            </div>
            <div>
              <div className="text-sm font-medium text-ink">{name}</div>
              <div className="font-mono text-xs text-ink-faint">RSS feed</div>
            </div>
          </div>
          {/* Focus distribution bars */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-tertiary w-20 truncate">Technology</span>
              <div className="flex-1 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                <div className="h-full bg-accent/60 rounded-full" style={{ width: '72%' }} />
              </div>
              <span className="font-mono text-xs text-ink-faint w-8 text-right">72%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-tertiary w-20 truncate">Science</span>
              <div className="flex-1 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                <div className="h-full bg-accent/40 rounded-full" style={{ width: '18%' }} />
              </div>
              <span className="font-mono text-xs text-ink-faint w-8 text-right">18%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-tertiary w-20 truncate">Other</span>
              <div className="flex-1 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                <div className="h-full bg-ink-faint/30 rounded-full" style={{ width: '10%' }} />
              </div>
              <span className="font-mono text-xs text-ink-faint w-8 text-right">10%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ── Interactive wrapper ─────────────────────────────────────────── */

const DiscoverContent = (): React.ReactElement => (
  <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
    <div className="text-2xl font-serif font-medium tracking-tight text-ink mb-2">Discover</div>
    <div className="text-sm text-ink-secondary">Browse curated sources, focuses, and edition configurations</div>
  </div>
);

const contentForMode: Record<Mode, React.ReactElement> = {
  magazines: <MagazinesContent />,
  feed: <FeedContent />,
  discover: <DiscoverContent />,
  builder: <BuilderContent />,
};

const InteractiveShell = ({ initialMode = 'magazines' }: { initialMode?: Mode }): React.ReactElement => {
  const [mode, setMode] = useState<Mode>(initialMode);
  return (
    <ModeShell
      activeMode={mode}
      onModeChange={setMode}
      pathname={defaultPathForMode[mode]}
      username="alice"
      onLogout={() => {}}
      onSettingsClick={() => {}}
    >
      {contentForMode[mode]}
    </ModeShell>
  );
};

/* ── Stories ──────────────────────────────────────────────────────── */

const meta: Meta = {
  title: 'Design System/Compositions/Mode Shell',
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

/** Full interactive shell — click modes to switch between Magazines, Feed, and Builder */
const Interactive: Story = {
  render: () => <InteractiveShell />,
};

/** Starting on the Feed mode */
const FeedMode: Story = {
  render: () => <InteractiveShell initialMode="feed" />,
};

/** Starting on the Builder mode */
const BuilderMode: Story = {
  render: () => <InteractiveShell initialMode="builder" />,
};

/** Magazines mode — the default landing experience */
const MagazinesMode: Story = {
  render: () => <InteractiveShell initialMode="magazines" />,
};

/** Mobile viewport — use the Mobile viewport preset in Storybook toolbar */
const MobileView: Story = {
  render: () => <InteractiveShell />,
  parameters: {
    viewport: { defaultViewport: 'mobile' },
  },
};

export default meta;
export { Interactive, FeedMode, BuilderMode, MagazinesMode, MobileView };
