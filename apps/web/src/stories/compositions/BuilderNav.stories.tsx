import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ModeShell } from '../../components/mode-shell.tsx';
import { BuilderNav, type BuilderTab } from '../../components/builder-nav.tsx';
import { PageHeader } from '../../components/page-header.tsx';
import { Button } from '../../components/button.tsx';
import { AuthProvider } from '../../auth/auth.tsx';

/* ── Router setup ────────────────────────────────────────────────── */

const rootRoute = createRootRoute();
const sourcesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sources' });
const focusesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/focuses' });
const editionsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/editions' });
const routeTree = rootRoute.addChildren([sourcesRoute, focusesRoute, editionsRoute]);

const createStoryRouter = (initialPath: string) =>
  createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
});

/* ── Placeholder page content ────────────────────────────────────── */

const SourcesPage = (): React.ReactElement => (
  <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
    <PageHeader
      title="Sources"
      subtitle="Manage your RSS feeds and podcasts"
      actions={
        <Button variant="primary" size="sm">
          Add source
        </Button>
      }
    />
    <div className="space-y-3 mt-4">
      {['Ars Technica', 'The Guardian', 'Nature', 'Hacker News'].map((name) => (
        <div key={name} className="flex items-center gap-3 py-3 border-b border-border">
          <div className="w-8 h-8 rounded-md bg-accent-subtle flex items-center justify-center">
            <span className="font-mono text-xs text-accent font-medium">{name[0]}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-ink">{name}</div>
            <div className="font-mono text-xs text-ink-faint">RSS feed</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const FocusesPage = (): React.ReactElement => (
  <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
    <PageHeader
      title="Focuses"
      subtitle="Define topic areas for article classification"
      actions={
        <Button variant="primary" size="sm">
          New focus
        </Button>
      }
    />
    <div className="space-y-3 mt-4">
      {['Technology', 'Science', 'Global News', 'Culture'].map((name) => (
        <div key={name} className="flex items-center gap-3 py-3 border-b border-border">
          <span className="text-sm font-medium text-ink">{name}</span>
          <span className="font-mono text-xs text-ink-faint ml-auto">4 sources</span>
        </div>
      ))}
    </div>
  </div>
);

const EditionsPage = (): React.ReactElement => (
  <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
    <PageHeader
      title="Editions"
      subtitle="Configure your scheduled digests"
      actions={
        <Button variant="primary" size="sm">
          New edition
        </Button>
      }
    />
    <div className="space-y-3 mt-4">
      {['Morning Brief', 'Deep Reads'].map((name) => (
        <div key={name} className="flex items-center gap-3 py-3 border-b border-border">
          <span className="text-sm font-medium text-ink">{name}</span>
          <span className="font-mono text-xs text-ink-faint ml-auto">3 focuses · daily</span>
        </div>
      ))}
    </div>
  </div>
);

const RoutedBuilder = ({ initialPath = '/sources' }: { initialPath?: string }): React.ReactElement => {
  const router = createStoryRouter(initialPath);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider
          router={router}
          defaultComponent={() => (
            <ModeShell
              activeMode="builder"
              onModeChange={() => {}}
              pathname={initialPath}
              username="alice"
              onLogout={() => {}}
              onSettingsClick={() => {}}
            >
              <BuilderNav activeTab={initialPath.replace('/', '') as BuilderTab} />
              {initialPath === '/focuses' ? (
                <FocusesPage />
              ) : initialPath === '/editions' ? (
                <EditionsPage />
              ) : (
                <SourcesPage />
              )}
            </ModeShell>
          )}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
};

/* ── Stories ──────────────────────────────────────────────────────── */

const meta: Meta = {
  title: 'Design System/Compositions/Builder Navigation',
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

/** Sources tab active (default builder landing) */
const Sources: Story = {
  render: () => <RoutedBuilder initialPath="/sources" />,
};

/** Focuses tab active */
const Focuses: Story = {
  render: () => <RoutedBuilder initialPath="/focuses" />,
};

/** Editions tab active */
const Editions: Story = {
  render: () => <RoutedBuilder initialPath="/editions" />,
};

export default meta;
export { Sources, Focuses, Editions };
