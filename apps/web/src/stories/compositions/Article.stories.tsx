import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import * as Article from '../../components/article/article.tsx';
import { Editorial, Hero, Compact, ArticleView } from '../../components/article/article.presets.tsx';
import type { ArticleStyle } from '../../components/article/article.presets.tsx';
import { FeedFooter, FocusFooter } from '../../components/article/article.footers.tsx';
import type { VoteValue } from '../../components/article/article.tsx';
import { MediaPlayer } from '../../components/media-player.tsx';

/* ── Sample content ──────────────────────────────────────────── */

const sampleContent = `For the better part of a decade, the dominant paradigm in digital reading has been the infinite scroll. Twitter pioneered it, Facebook perfected it, and RSS readers adopted it wholesale. The assumption was simple: more content, delivered faster, in an unbroken stream. But a growing number of designers and developers are questioning whether that assumption ever served readers at all.

The problem isn't technical — it's attentional. When everything arrives in a single undifferentiated stream, nothing feels important. A three-thousand-word investigation sits alongside a two-sentence hot take.

### The finite alternative

"The most radical thing you can do in 2026 is give someone an ending," says Mira Chen, lead designer at Streamline, a reading app that launched last month to quiet enthusiasm. "Every other app in the attention economy is designed to keep you scrolling. We designed ours so you reach the bottom and feel *done*."

> We're not building a feed. We're building something closer to a daily newspaper — assembled with intention, bounded by design, and meant to be finished.

### Source budgeting

One technique gaining traction is "source budgeting" — algorithmically limiting how many articles from any single source can appear in a reading session. The idea is proportional representation: a prolific news wire shouldn't crowd out a small blog that publishes once a week.

This approach requires a fundamental rethink of how feeds are assembled. Instead of sorting by recency and calling it done, these apps build curated editions.`;

const now = Date.now();
const sampleArticle = {
  title: 'The quiet revolution in reader design',
  sourceName: 'Ars Technica',
  author: 'Samuel Axon',
  summary:
    "How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span.",
  publishedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  consumptionTimeSeconds: 480,
  imageUrl: 'https://picsum.photos/seed/article-comp/800/600',
  content: sampleContent,
};

/* ── Meta ─────────────────────────────────────────────────────── */

const meta: Meta = {
  title: 'Design System/Compositions/Article',
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

/* ── Compound component stories ──────────────────────────────── */

const CompoundParts: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Article.Root className="max-w-prose mx-auto">
        <Article.Source name="Ars Technica" centered delay={0} />
        <Article.Title centered size="xl" delay={0.1}>
          The quiet revolution in reader design
        </Article.Title>
        <Article.Divider delay={0.2} />
        <Article.Image src="https://picsum.photos/seed/article-comp/800/600" delay={0.25} />
        <Article.Summary centered delay={0.3}>
          How a new generation of reading apps is rethinking the relationship between content, interface, and the
          reader&apos;s attention span.
        </Article.Summary>
        <Article.Byline
          author="Samuel Axon"
          publishedAt={new Date(now - 3 * 60 * 60 * 1000).toISOString()}
          consumptionTimeSeconds={480}
          centered
          delay={0.35}
        />
        <Article.Body content={sampleContent} delay={0.4} />
        <Article.VoteRow vote={null} onVote={() => undefined} label="Quality" delay={0.5} />
      </Article.Root>
    </div>
  ),
};

/* ── Preset stories ──────────────────────────────────────────── */

const EditorialPreset: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Editorial {...sampleArticle} />
    </div>
  ),
};

const EditorialNoContent: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Editorial {...sampleArticle} content={null} />
    </div>
  ),
};

const EditorialNoImage: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Editorial {...sampleArticle} imageUrl={null} />
    </div>
  ),
};

const HeroPreset: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Hero {...sampleArticle} />
    </div>
  ),
};

const HeroNoImage: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Hero {...sampleArticle} imageUrl={null} />
    </div>
  ),
};

const CompactPreset: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Compact {...sampleArticle} />
    </div>
  ),
};

const CompactNoImage: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Compact {...sampleArticle} imageUrl={null} />
    </div>
  ),
};

/* ── Style selector story ────────────────────────────────────── */

const StyleSelectorRender = (): React.ReactElement => {
  const [style, setStyle] = useState<ArticleStyle>('editorial');

  return (
    <div className="bg-surface min-h-dvh">
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-prose mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-xs font-mono tracking-wide text-ink-tertiary">Style:</span>
          {(['editorial', 'hero', 'compact'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={`text-xs px-3 py-1 rounded-full cursor-pointer transition-colors duration-fast ${
                style === s
                  ? 'bg-accent text-white'
                  : 'bg-surface-sunken text-ink-secondary hover:text-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="py-16 px-4">
        <ArticleView style={style} {...sampleArticle} />
      </div>
    </div>
  );
};

const StyleSelector: Story = {
  render: () => <StyleSelectorRender />,
};

/* ── Footer stories ──────────────────────────────────────────── */

const FeedFooterRender = (): React.ReactElement => {
  const [vote, setVote] = useState<VoteValue>(null);

  return (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Editorial
        {...sampleArticle}
        footer={
          <FeedFooter
            vote={vote}
            onVote={setVote}
            onDone={() => alert('Done clicked')}
            articleUrl="https://example.com/article"
          />
        }
      />
    </div>
  );
};

const WithFeedFooter: Story = {
  render: () => <FeedFooterRender />,
};

const FocusFooterRender = (): React.ReactElement => {
  const [focusVote, setFocusVote] = useState<VoteValue>(null);
  const [globalVote, setGlobalVote] = useState<VoteValue>(null);

  return (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Editorial
        {...sampleArticle}
        footer={
          <FocusFooter
            focusVote={focusVote}
            onFocusVote={setFocusVote}
            globalVote={globalVote}
            onGlobalVote={setGlobalVote}
            onDone={() => alert('Done clicked')}
            articleUrl="https://example.com/article"
          />
        }
      />
    </div>
  );
};

const WithFocusFooter: Story = {
  render: () => <FocusFooterRender />,
};

/* ── Image aspect ratios ─────────────────────────────────────── */

const ImageAspects: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <div className="max-w-prose mx-auto flex flex-col gap-8">
        <div>
          <div className="text-xs font-mono tracking-wide text-ink-tertiary mb-3">video (16:9)</div>
          <Article.Image src="https://picsum.photos/seed/aspect-v/800/450" aspect="video" delay={0} />
        </div>
        <div>
          <div className="text-xs font-mono tracking-wide text-ink-tertiary mb-3">photo (4:3)</div>
          <Article.Image src="https://picsum.photos/seed/aspect-p/800/600" aspect="photo" delay={0} />
        </div>
        <div>
          <div className="text-xs font-mono tracking-wide text-ink-tertiary mb-3">square (1:1)</div>
          <Article.Image src="https://picsum.photos/seed/aspect-s/400/400" aspect="square" delay={0} />
        </div>
      </div>
    </div>
  ),
};

/* ── Title sizes ─────────────────────────────────────────────── */

const TitleSizes: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <div className="max-w-prose mx-auto flex flex-col gap-8">
        <div>
          <div className="text-xs font-mono tracking-wide text-ink-tertiary mb-3">size=&quot;base&quot;</div>
          <Article.Title size="base" delay={0}>
            The quiet revolution in reader design
          </Article.Title>
        </div>
        <div>
          <div className="text-xs font-mono tracking-wide text-ink-tertiary mb-3">size=&quot;lg&quot;</div>
          <Article.Title size="lg" delay={0}>
            The quiet revolution in reader design
          </Article.Title>
        </div>
        <div>
          <div className="text-xs font-mono tracking-wide text-ink-tertiary mb-3">size=&quot;xl&quot;</div>
          <Article.Title size="xl" delay={0}>
            The quiet revolution in reader design
          </Article.Title>
        </div>
      </div>
    </div>
  ),
};

/* ── Podcast stories ─────────────────────────────────────────── */

const podcastShowNotes = `In this episode, we sit down with two engineers who've spent the last year rebuilding their company's entire content pipeline around the idea of "finite feeds" — the principle that a reading experience should have a beginning, a middle, and an end.

### Topics covered

We discuss the concept of "edition generation" — assembling a bounded set of articles that balances topics, sources, reading time, and importance — and how it differs from traditional feed ranking.

### The SQLite decision

Perhaps the most interesting segment covers their database choice. The team explains why they moved from PostgreSQL to SQLite for their self-hosted product, how WAL mode and careful write serialization solved their concurrency concerns, and the operational simplicity gains that followed.`;

const samplePodcast = {
  title: 'Building finite feeds: architecture for calm software',
  sourceName: 'Software Unscripted',
  author: 'Richard Feldman',
  summary:
    'Two engineers discuss source budgeting, edition generation, and why they chose SQLite — a deep technical conversation about building reading software that respects attention.',
  publishedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
  consumptionTimeSeconds: 2700,
  imageUrl: 'https://picsum.photos/seed/podcast-cover/800/800',
  sourceType: 'podcast' as const,
};

const PodcastWithPlayer: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Editorial
        {...samplePodcast}
        content={podcastShowNotes}
      >
        <div className="mt-8">
          <MediaPlayer
            mediaUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
            mediaType="audio/mpeg"
            delay={0.35}
          />
        </div>
      </Editorial>
    </div>
  ),
};

const PodcastSummaryOnly: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Editorial
        {...samplePodcast}
        content={null}
      >
        <div className="mt-8">
          <MediaPlayer
            mediaUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
            mediaType="audio/mpeg"
            delay={0.35}
          />
        </div>
      </Editorial>
    </div>
  ),
};

const PodcastWithFooter: Story = {
  render: () => {
    const [vote, setVote] = useState<VoteValue>(null);
    return (
      <div className="bg-surface min-h-dvh py-16 px-4">
        <Editorial
          {...samplePodcast}
          content={podcastShowNotes}
          footer={
            <FeedFooter
              vote={vote}
              onVote={setVote}
              onDone={() => alert('Done clicked')}
              articleUrl="https://example.com/podcast"
            />
          }
        >
          <div className="mt-8">
            <MediaPlayer
              mediaUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
              mediaType="audio/mpeg"
              delay={0.35}
            />
          </div>
        </Editorial>
      </div>
    );
  },
};

const PodcastCompactLayout: Story = {
  render: () => (
    <div className="bg-surface min-h-dvh py-16 px-4">
      <Compact
        {...samplePodcast}
        content={null}
      >
        <div className="mt-8">
          <MediaPlayer
            mediaUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
            mediaType="audio/mpeg"
            delay={0.35}
          />
        </div>
      </Compact>
    </div>
  ),
};

/* ── All three presets side by side ───────────────────────────── */

const AllPresets: Story = {
  render: () => {
    const shortArticle = { ...sampleArticle, content: null };
    return (
      <div className="bg-surface min-h-dvh py-16 px-4">
        <div className="max-w-wide mx-auto mb-16">
          <div className="text-xs font-mono tracking-wide text-accent mb-4">01 — Editorial</div>
          <div className="border border-border rounded-lg p-8">
            <Editorial {...shortArticle} />
          </div>
        </div>
        <div className="max-w-wide mx-auto mb-16">
          <div className="text-xs font-mono tracking-wide text-accent mb-4">02 — Hero</div>
          <div className="border border-border rounded-lg p-8">
            <Hero {...shortArticle} />
          </div>
        </div>
        <div className="max-w-wide mx-auto">
          <div className="text-xs font-mono tracking-wide text-accent mb-4">03 — Compact</div>
          <div className="border border-border rounded-lg p-8">
            <Compact {...shortArticle} />
          </div>
        </div>
      </div>
    );
  },
};

export default meta;
export {
  CompoundParts,
  EditorialPreset,
  EditorialNoContent,
  EditorialNoImage,
  HeroPreset,
  HeroNoImage,
  CompactPreset,
  CompactNoImage,
  StyleSelector,
  WithFeedFooter,
  WithFocusFooter,
  PodcastWithPlayer,
  PodcastSummaryOnly,
  PodcastWithFooter,
  PodcastCompactLayout,
  ImageAspects,
  TitleSizes,
  AllPresets,
};
