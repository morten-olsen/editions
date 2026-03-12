import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ArticleCard } from '../../components/article-card.tsx';
import type { ArticleCardProps } from '../../components/article-card.tsx';
import type { VoteValue } from '../../components/vote-controls.tsx';

const sampleProps = {
  id: '1',
  title: 'The quiet revolution in reader design',
  sourceName: 'Ars Technica',
  author: 'Samuel Axon',
  summary:
    "How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span.",
  publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  consumptionTimeSeconds: 480,
} satisfies ArticleCardProps;

const meta: Meta<typeof ArticleCard> = {
  title: 'Design System/Compositions/Article Card',
  component: ArticleCard,
  parameters: { layout: 'centered' },
  args: sampleProps,
  argTypes: {
    read: { control: 'boolean' },
    compact: { control: 'boolean' },
    title: { control: 'text' },
    sourceName: { control: 'text' },
    author: { control: 'text' },
    summary: { control: 'text' },
    imageUrl: { control: 'text' },
    consumptionTimeSeconds: { control: 'number' },
  },
  render: (args) => (
    <div style={{ width: '40rem' }}>
      <ArticleCard {...args} />
    </div>
  ),
};

type Story = StoryObj<typeof ArticleCard>;

const Default: Story = {};

const WithImage: Story = {
  args: {
    imageUrl: 'https://picsum.photos/seed/reader/400/300',
  },
};

const Compact: Story = {
  args: {
    id: '2',
    title: 'TypeScript 6.0 introduces pattern matching',
    sourceName: 'Hacker News',
    author: undefined,
    summary: undefined,
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    consumptionTimeSeconds: 180,
    compact: true,
  },
};

const Read: Story = {
  args: { read: true },
};

const ReadWithImage: Story = {
  args: {
    read: true,
    imageUrl: 'https://picsum.photos/seed/reader/400/300',
  },
};

const List: Story = {
  render: () => (
    <div style={{ width: '40rem' }} className="divide-y divide-border">
      <ArticleCard
        id="1"
        title="The quiet revolution in reader design"
        sourceName="Ars Technica"
        author="Samuel Axon"
        summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span."
        publishedAt={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={480}
        imageUrl="https://picsum.photos/seed/reader/400/300"
      />
      <ArticleCard
        id="2"
        title="Europe's new data sovereignty framework explained"
        sourceName="The Guardian"
        author="Alex Hern"
        summary="The Digital Markets Act enters its second phase, requiring tech giants to open their platforms to interoperability. What it means for everyday users."
        publishedAt={new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={360}
        imageUrl="https://picsum.photos/seed/eu-data/400/300"
      />
      <ArticleCard
        id="3"
        title="Why SQLite is the database you didn't know you needed"
        sourceName="Hacker News"
        summary="A deep dive into why embedded databases are making a comeback in server-side applications, and what the trade-offs really look like."
        publishedAt={new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={720}
      />
      <ArticleCard
        id="4"
        title="Pacific trade agreement reaches final ratification"
        sourceName="Reuters"
        publishedAt={new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={120}
        imageUrl="https://picsum.photos/seed/trade/400/300"
      />
    </div>
  ),
};

const ReadMixedList: Story = {
  render: () => (
    <div style={{ width: '40rem' }} className="divide-y divide-border">
      <ArticleCard
        id="1"
        title="The quiet revolution in reader design"
        sourceName="Ars Technica"
        author="Samuel Axon"
        summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span."
        publishedAt={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={480}
        imageUrl="https://picsum.photos/seed/reader/400/300"
      />
      <ArticleCard
        id="2"
        title="Europe's new data sovereignty framework explained"
        sourceName="The Guardian"
        author="Alex Hern"
        summary="The Digital Markets Act enters its second phase, requiring tech giants to open their platforms to interoperability. What it means for everyday users."
        publishedAt={new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={360}
        read
      />
      <ArticleCard
        id="3"
        title="Why SQLite is the database you didn't know you needed"
        sourceName="Hacker News"
        summary="A deep dive into why embedded databases are making a comeback in server-side applications, and what the trade-offs really look like."
        publishedAt={new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={720}
      />
      <ArticleCard
        id="4"
        title="Pacific trade agreement reaches final ratification"
        sourceName="Reuters"
        summary="Twelve nations sign the landmark agreement after three years of negotiations."
        publishedAt={new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={120}
        read
      />
    </div>
  ),
};

const VotableArticle = (): React.ReactElement => {
  const [focusVote, setFocusVote] = useState<VoteValue>(null);
  const [globalVote, setGlobalVote] = useState<VoteValue>(null);

  return (
    <div style={{ width: '40rem' }}>
      <ArticleCard
        {...sampleProps}
        imageUrl="https://picsum.photos/seed/reader/400/300"
        focusVote={focusVote}
        onFocusVote={setFocusVote}
        vote={globalVote}
        onVote={setGlobalVote}
      />
    </div>
  );
};

const WithVoting: Story = {
  render: () => <VotableArticle />,
};

const WithActiveVotes: Story = {
  render: () => (
    <div style={{ width: '40rem' }} className="divide-y divide-border">
      <ArticleCard
        id="1"
        title="An article you upvoted in this focus"
        sourceName="Nature"
        summary="This article was marked as a good match for the current focus, and you also liked it globally."
        publishedAt={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={360}
        focusVote={1}
        onFocusVote={() => undefined}
        vote={1}
        onVote={() => undefined}
      />
      <ArticleCard
        id="2"
        title="Good article, wrong focus"
        sourceName="The Guardian"
        summary="You enjoyed this article but it doesn't belong in this focus."
        publishedAt={new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={240}
        focusVote={-1}
        onFocusVote={() => undefined}
        vote={1}
        onVote={() => undefined}
      />
      <ArticleCard
        id="3"
        title="Not your cup of tea"
        sourceName="Hacker News"
        summary="You downvoted this globally."
        publishedAt={new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={180}
        vote={-1}
        onVote={() => undefined}
        focusVote={null}
        onFocusVote={() => undefined}
      />
    </div>
  ),
};

export default meta;
export { Default, WithImage, Compact, Read, ReadWithImage, List, ReadMixedList, WithVoting, WithActiveVotes };
