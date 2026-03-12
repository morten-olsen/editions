import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppShell } from '../../components/app-shell.tsx';
import { Nav } from '../../components/nav.tsx';
import { PageHeader } from '../../components/page-header.tsx';
import { ArticleCard } from '../../components/article-card.tsx';
import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';
import { AuthProvider } from '../../auth/auth.tsx';

const rootRoute = createRootRoute();
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' });
const editionsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/editions' });
const sourcesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sources' });
const focusesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/focuses' });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings' });
const routeTree = rootRoute.addChildren([indexRoute, editionsRoute, sourcesRoute, focusesRoute, settingsRoute]);
const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
});

const withRouter = (Story: React.ComponentType): React.ReactElement => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RouterProvider router={router} defaultComponent={() => <Story />} />
    </AuthProvider>
  </QueryClientProvider>
);

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

const meta: Meta = {
  title: 'Design System/Compositions/App Layout',
  decorators: [withRouter],
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

const FeedView: Story = {
  render: () => (
    <AppShell nav={<Nav />}>
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
    </AppShell>
  ),
};

export default meta;
export { FeedView };
