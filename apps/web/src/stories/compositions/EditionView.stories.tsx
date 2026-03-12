import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

import { EditionSection } from '../../components/edition-section.tsx';
import { ReadingShell } from '../../components/app-shell.tsx';
import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';

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

const sampleEdition = {
  title: 'Morning Briefing',
  publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  totalReadingMinutes: 14,
  articleCount: 7,
  sections: [
    {
      focusName: 'Technology',
      articles: [
        {
          id: '1',
          title: 'The quiet revolution in reader design',
          sourceName: 'Ars Technica',
          author: 'Samuel Axon',
          summary:
            "How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span.",
          publishedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 480,
          imageUrl: 'https://picsum.photos/seed/reader/400/300',
        },
        {
          id: '2',
          title: 'TypeScript 6.0 introduces pattern matching',
          sourceName: 'Hacker News',
          summary:
            'The long-awaited pattern matching RFC lands in TypeScript, bringing exhaustive checks and destructuring to a new level.',
          publishedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 180,
        },
      ],
    },
    {
      focusName: 'Science',
      articles: [
        {
          id: '3',
          title: "JWST captures light from the universe's first galaxies",
          sourceName: 'Nature',
          author: 'Dr. Emily Carter',
          summary:
            'New observations push the frontier of known galaxies back another 200 million years, challenging existing models of early star formation.',
          publishedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 360,
          imageUrl: 'https://picsum.photos/seed/jwst/400/300',
        },
      ],
    },
    {
      focusName: 'Global News',
      articles: [
        {
          id: '4',
          title: "Europe's new data sovereignty framework explained",
          sourceName: 'The Guardian',
          author: 'Alex Hern',
          summary: 'The Digital Markets Act enters its second phase, requiring tech giants to open their platforms.',
          publishedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 240,
          imageUrl: 'https://picsum.photos/seed/eu-data/400/300',
        },
        {
          id: '5',
          title: 'Pacific trade agreement reaches final ratification',
          sourceName: 'Reuters',
          publishedAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 120,
        },
      ],
    },
  ],
};

const EditionHeader = (): React.ReactElement => (
  <header className="border-b border-border bg-surface">
    <div className="max-w-prose mx-auto px-6 py-6 flex items-center justify-between">
      <Button variant="ghost" size="sm">
        ← Back
      </Button>
      <div className="text-xs text-ink-tertiary">
        {sampleEdition.articleCount} articles · {sampleEdition.totalReadingMinutes} min
      </div>
    </div>
  </header>
);

const meta: Meta = {
  title: 'Design System/Compositions/Edition View',
  decorators: [withRouter],
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

const FullEdition: Story = {
  render: () => (
    <ReadingShell header={<EditionHeader />}>
      <div className="mb-12">
        <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-3">
          Morning Edition ·{' '}
          {new Date(sampleEdition.publishedAt).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </div>
        <h1 className="text-4xl font-serif tracking-tight text-ink leading-tight mb-3">{sampleEdition.title}</h1>
        <div className="text-sm text-ink-secondary">
          {sampleEdition.articleCount} articles across {sampleEdition.sections.length} focuses · approximately{' '}
          {sampleEdition.totalReadingMinutes} minutes
        </div>
      </div>

      {sampleEdition.sections.map((section, i) => (
        <div key={section.focusName}>
          {i > 0 && <Separator soft />}
          <EditionSection focusName={section.focusName} articles={section.articles} index={i} />
        </div>
      ))}

      <Separator />
      <div className="py-16 text-center">
        <div className="font-serif text-2xl text-ink mb-2">You're all caught up</div>
        <div className="text-sm text-ink-tertiary">
          {sampleEdition.articleCount} articles · {sampleEdition.totalReadingMinutes} minutes well spent
        </div>
      </div>
    </ReadingShell>
  ),
};

export default meta;
export { FullEdition };
