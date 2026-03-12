import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

import { SourceCard } from '../../components/source-card.tsx';
import { PageHeader } from '../../components/page-header.tsx';
import { Button } from '../../components/button.tsx';
import { EmptyState } from '../../components/empty-state.tsx';

const rootRoute = createRootRoute();
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' });
const routeTree = rootRoute.addChildren([indexRoute]);
const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

const withRouter = (story: React.ComponentType): React.ReactElement => {
  const Story = story;
  return <RouterProvider router={router} defaultComponent={() => <Story />} />;
};

const now = Date.now();

const sampleSources = [
  {
    id: '1',
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    lastFetchedAt: new Date(now - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'The Guardian',
    url: 'https://www.theguardian.com/world/rss',
    lastFetchedAt: new Date(now - 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    lastFetchedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    name: 'Nature News',
    url: 'https://www.nature.com/nature.rss',
    fetchError: 'Connection timed out',
    lastFetchedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    name: 'Daring Fireball',
    url: 'https://daringfireball.net/feeds/main',
    lastFetchedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
  },
];

const meta: Meta = {
  title: 'Design System/Compositions/Sources List',
  decorators: [withRouter],
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

const WithSources: Story = {
  render: () => (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem' }}>
      <PageHeader
        title="Sources"
        subtitle={`${sampleSources.length} feeds configured`}
        actions={
          <Button variant="primary" size="sm">
            Add source
          </Button>
        }
      />
      <div className="grid gap-3">
        {sampleSources.map((source) => (
          <SourceCard key={source.id} {...source} />
        ))}
      </div>
    </div>
  ),
};

const Empty: Story = {
  render: () => (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem' }}>
      <PageHeader title="Sources" />
      <EmptyState
        title="No sources yet"
        description="Add your first RSS feed to start building your reading experience."
        action={<Button variant="primary">Add source</Button>}
      />
    </div>
  ),
};

export default meta;
export { WithSources, Empty };
