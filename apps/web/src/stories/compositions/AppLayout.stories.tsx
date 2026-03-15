import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ModeShell, defaultPathForMode, type Mode } from '../../components/mode-shell.tsx';
import { BuilderNav } from '../../components/builder-nav.tsx';
import { ArticleCard } from '../../components/article-card.tsx';
import { PageHeader } from '../../components/page-header.tsx';
import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';

/* ── Mock data ───────────────────────────────────────────────────── */

const now = Date.now();

const feedArticles = [
  {
    id: '1',
    title: 'The quiet revolution in reader design',
    sourceName: 'Ars Technica',
    author: 'Samuel Axon',
    summary:
      "How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span.",
    publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    consumptionTimeSeconds: 480,
    imageUrl: 'https://picsum.photos/seed/reader/400/300',
  },
  {
    id: '2',
    title: "Europe's new data sovereignty framework explained",
    sourceName: 'The Guardian',
    author: 'Alex Hern',
    summary:
      'The Digital Markets Act enters its second phase, requiring tech giants to open their platforms to interoperability.',
    publishedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    consumptionTimeSeconds: 360,
    imageUrl: 'https://picsum.photos/seed/eu-data/400/300',
  },
  {
    id: '3',
    title: "JWST captures light from the universe's first galaxies",
    sourceName: 'Nature',
    author: 'Dr. Emily Carter',
    summary: 'New observations push the frontier of known galaxies back another 200 million years.',
    publishedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    consumptionTimeSeconds: 300,
    imageUrl: 'https://picsum.photos/seed/jwst/400/300',
  },
  {
    id: '4',
    title: "Why SQLite is the database you didn't know you needed",
    sourceName: 'Hacker News',
    summary: 'A deep dive into why embedded databases are making a comeback in server-side applications.',
    publishedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
    consumptionTimeSeconds: 720,
  },
  {
    id: '5',
    title: 'Pacific trade agreement reaches final ratification',
    sourceName: 'Reuters',
    publishedAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
    consumptionTimeSeconds: 120,
    imageUrl: 'https://picsum.photos/seed/trade/400/300',
  },
];

/* ── Story wrapper ───────────────────────────────────────────────── */

const AppLayoutShell = ({ initialMode = 'feed' }: { initialMode?: Mode }): React.ReactElement => {
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
      {mode === 'builder' && <BuilderNav activeTab="sources" />}
      <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
        <PageHeader
          title="Feed"
          subtitle="Your latest articles, ranked by importance"
          actions={
            <Button variant="ghost" size="sm">
              Mark all read
            </Button>
          }
          serif
        />
        <div className="divide-y divide-border">
          {feedArticles.map((article) => (
            <ArticleCard key={article.id} {...article} />
          ))}
        </div>
        <Separator soft className="mt-4" />
        <div className="py-12 text-center text-sm text-ink-tertiary">
          You've reached the end — {feedArticles.length} articles
        </div>
      </div>
    </ModeShell>
  );
};

/* ── Stories ──────────────────────────────────────────────────────── */

const meta: Meta = {
  title: 'Design System/Compositions/App Layout',
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

const FeedView: Story = {
  render: () => <AppLayoutShell initialMode="feed" />,
};

export default meta;
export { FeedView };
