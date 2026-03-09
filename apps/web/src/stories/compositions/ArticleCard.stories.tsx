import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ArticleCard } from "../../components/article-card.tsx";
import type { VoteValue } from "../../components/vote-controls.tsx";

const rootRoute = createRootRoute();
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
const routeTree = rootRoute.addChildren([indexRoute]);
const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

const withRouter = (Story: React.ComponentType): React.ReactElement => (
  <RouterProvider router={router} defaultComponent={() => <Story />} />
);

const meta: Meta<typeof ArticleCard> = {
  title: "Design System/Compositions/Article Card",
  component: ArticleCard,
  decorators: [withRouter],
  parameters: { layout: "centered" },
};

type Story = StoryObj<typeof ArticleCard>;

const Default: Story = {
  render: () => (
    <div style={{ width: "40rem" }}>
      <ArticleCard
        id="1"
        title="The quiet revolution in reader design"
        sourceName="Ars Technica"
        author="Samuel Axon"
        summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span."
        publishedAt={new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={480}
      />
    </div>
  ),
};

const WithImage: Story = {
  render: () => (
    <div style={{ width: "40rem" }}>
      <ArticleCard
        id="1"
        title="The quiet revolution in reader design"
        sourceName="Ars Technica"
        author="Samuel Axon"
        summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span."
        publishedAt={new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={480}
        imageUrl="https://picsum.photos/seed/reader/400/300"
      />
    </div>
  ),
};

const Compact: Story = {
  render: () => (
    <div style={{ width: "40rem" }}>
      <ArticleCard
        id="2"
        title="TypeScript 6.0 introduces pattern matching"
        sourceName="Hacker News"
        publishedAt={new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={180}
        compact
      />
    </div>
  ),
};

const List: Story = {
  render: () => (
    <div style={{ width: "40rem" }} className="divide-y divide-border">
      <ArticleCard
        id="1"
        title="The quiet revolution in reader design"
        sourceName="Ars Technica"
        author="Samuel Axon"
        summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span."
        publishedAt={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={480}
        imageUrl="https://picsum.photos/seed/reader/400/300"
      />
      <ArticleCard
        id="2"
        title="Europe's new data sovereignty framework explained"
        sourceName="The Guardian"
        author="Alex Hern"
        summary="The Digital Markets Act enters its second phase, requiring tech giants to open their platforms to interoperability. What it means for everyday users."
        publishedAt={new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={360}
        imageUrl="https://picsum.photos/seed/eu-data/400/300"
      />
      <ArticleCard
        id="3"
        title="Why SQLite is the database you didn't know you needed"
        sourceName="Hacker News"
        summary="A deep dive into why embedded databases are making a comeback in server-side applications, and what the trade-offs really look like."
        publishedAt={new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={720}
      />
      <ArticleCard
        id="4"
        title="Pacific trade agreement reaches final ratification"
        sourceName="Reuters"
        publishedAt={new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={120}
        imageUrl="https://picsum.photos/seed/trade/400/300"
      />
    </div>
  ),
};

const VotableArticle = (): React.ReactElement => {
  const [focusVote, setFocusVote] = useState<VoteValue>(null);
  const [globalVote, setGlobalVote] = useState<VoteValue>(null);

  return (
    <div style={{ width: "40rem" }}>
      <ArticleCard
        id="1"
        title="The quiet revolution in reader design"
        sourceName="Ars Technica"
        author="Samuel Axon"
        summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span."
        publishedAt={new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={480}
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
    <div style={{ width: "40rem" }} className="divide-y divide-border">
      <ArticleCard
        id="1"
        title="An article you upvoted in this focus"
        sourceName="Nature"
        summary="This article was marked as a good match for the current focus, and you also liked it globally."
        publishedAt={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={360}
        focusVote={1}
        onFocusVote={() => {}}
        vote={1}
        onVote={() => {}}
      />
      <ArticleCard
        id="2"
        title="Good article, wrong focus"
        sourceName="The Guardian"
        summary="You enjoyed this article but it doesn't belong in this focus."
        publishedAt={new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={240}
        focusVote={-1}
        onFocusVote={() => {}}
        vote={1}
        onVote={() => {}}
      />
      <ArticleCard
        id="3"
        title="Not your cup of tea"
        sourceName="Hacker News"
        summary="You downvoted this globally."
        publishedAt={new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()}
        readingTimeSeconds={180}
        vote={-1}
        onVote={() => {}}
        focusVote={null}
        onFocusVote={() => {}}
      />
    </div>
  ),
};

export default meta;
export { Default, WithImage, Compact, List, WithVoting, WithActiveVotes };
