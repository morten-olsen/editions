import { useState } from 'react';
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
import { BuilderNav } from '../../components/builder-nav.tsx';
import { BuilderSplitView } from '../../components/builder-split-view.tsx';
import { ScoredArticleCard } from '../../components/scored-article-card.tsx';
import { Input } from '../../components/input.tsx';
import { Textarea } from '../../components/textarea.tsx';
import { Button } from '../../components/button.tsx';
import { Checkbox } from '../../components/checkbox.tsx';
import { Separator } from '../../components/separator.tsx';
import { AuthProvider } from '../../auth/auth.tsx';

/* ── Router setup ────────────────────────────────────────────────── */

const rootRoute = createRootRoute();
const focusesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/focuses' });
const editionsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/editions' });
const sourcesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sources' });
const routeTree = rootRoute.addChildren([focusesRoute, editionsRoute, sourcesRoute]);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
});

const withRouter = (initialPath: string, Story: React.ComponentType): React.ReactElement => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} defaultComponent={() => <Story />} />
      </AuthProvider>
    </QueryClientProvider>
  );
};

/* ── Mock data ───────────────────────────────────────────────────── */

const now = Date.now();

const mockArticles = [
  { id: '1', title: 'The quiet revolution in reader design', sourceName: 'Ars Technica', author: 'Samuel Axon', publishedAt: new Date(now - 2 * 3600000).toISOString(), consumptionTimeSeconds: 480, confidence: 0.92 },
  { id: '2', title: 'TypeScript 6.0 introduces pattern matching', sourceName: 'Hacker News', author: null, publishedAt: new Date(now - 4 * 3600000).toISOString(), consumptionTimeSeconds: 360, confidence: 0.78 },
  { id: '3', title: 'Why SQLite is the database you didn\'t know you needed', sourceName: 'Hacker News', author: null, publishedAt: new Date(now - 6 * 3600000).toISOString(), consumptionTimeSeconds: 720, confidence: 0.65 },
  { id: '4', title: 'JWST captures light from the universe\'s first galaxies', sourceName: 'Nature', author: 'Dr. Emily Carter', publishedAt: new Date(now - 8 * 3600000).toISOString(), consumptionTimeSeconds: 300, confidence: 0.31 },
  { id: '5', title: 'Europe\'s new data sovereignty framework explained', sourceName: 'The Guardian', author: 'Alex Hern', publishedAt: new Date(now - 10 * 3600000).toISOString(), consumptionTimeSeconds: 360, confidence: 0.22 },
  { id: '6', title: 'Pacific trade agreement reaches final ratification', sourceName: 'Reuters', author: null, publishedAt: new Date(now - 12 * 3600000).toISOString(), consumptionTimeSeconds: 120, confidence: 0.08 },
];

const mockSources = [
  { id: 's1', name: 'Ars Technica' },
  { id: 's2', name: 'Hacker News' },
  { id: 's3', name: 'Nature' },
  { id: 's4', name: 'The Guardian' },
  { id: 's5', name: 'Reuters' },
];

/* ── Focus config panel ──────────────────────────────────────────── */

const confidenceHint = (pct: number): string => {
  if (pct >= 80) return 'Tight';
  if (pct >= 50) return 'Moderate';
  if (pct >= 20) return 'Loose';
  return 'Very loose';
};

const FocusConfigPanel = ({
  threshold,
  onThresholdChange,
  selectedSourceIds,
  onToggleSource,
}: {
  threshold: number;
  onThresholdChange: (v: number) => void;
  selectedSourceIds: Set<string>;
  onToggleSource: (id: string) => void;
}): React.ReactElement => (
  <div className="flex flex-col gap-6">
    <div>
      <h2 className="font-serif text-2xl font-medium tracking-tight text-ink mb-1">Technology</h2>
      <p className="text-sm text-ink-secondary">News about software, startups, and the tech industry</p>
    </div>

    <div className="flex flex-col gap-5">
      <Input label="Name" value="Technology" readOnly />
      <Textarea
        label="Description"
        description="Helps the classifier recognise which articles belong here."
        rows={2}
        value="News about software, startups, and the tech industry"
        readOnly
      />
    </div>

    <Separator soft />

    {/* Threshold slider */}
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">Minimum match</label>
      <p className="text-xs text-ink-tertiary -mt-0.5">
        How closely articles must match this topic. Higher values filter to only strong matches.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={threshold}
          onChange={(e) => onThresholdChange(Number(e.target.value))}
          className="flex-1 accent-accent"
        />
        <span className="text-sm text-ink-secondary tabular-nums w-24 text-right">
          {threshold === 0 ? 'All articles' : `${threshold}% — ${confidenceHint(threshold)}`}
        </span>
      </div>
    </div>

    <Separator soft />

    {/* Sources */}
    <div>
      <div className="text-sm font-medium text-ink mb-0.5">Sources</div>
      <p className="text-xs text-ink-tertiary mb-3">Choose which sources feed this topic.</p>
      <div className="flex flex-col gap-1">
        {mockSources.map((source) => (
          <div key={source.id} className="px-3 py-2">
            <Checkbox
              label={source.name}
              checked={selectedSourceIds.has(source.id)}
              onCheckedChange={() => onToggleSource(source.id)}
            />
          </div>
        ))}
      </div>
    </div>

    <div className="flex items-center gap-3">
      <Button variant="primary" size="sm">Save changes</Button>
      <Button variant="ghost" size="sm">Cancel</Button>
    </div>
  </div>
);

/* ── Focus preview panel ─────────────────────────────────────────── */

const FocusPreviewPanel = ({
  articles,
  threshold,
}: {
  articles: typeof mockArticles;
  threshold: number;
}): React.ReactElement => {
  const thresholdDecimal = threshold / 100;
  const included = articles.filter((a) => a.confidence >= thresholdDecimal);
  const excluded = articles.filter((a) => a.confidence < thresholdDecimal);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-mono text-xs tracking-wide text-ink-faint uppercase">
          Matching articles
        </h3>
        <span className="font-mono text-xs text-ink-tertiary">
          {included.length} of {articles.length}
        </span>
      </div>

      {included.length === 0 ? (
        <div className="py-8 text-center text-sm text-ink-tertiary">
          No articles match at this threshold. Try lowering it.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {included.map((article) => (
            <ScoredArticleCard key={article.id} {...article} included />
          ))}
        </div>
      )}

      {excluded.length > 0 && (
        <>
          <div className="mt-6 mb-3">
            <span className="font-mono text-xs tracking-wide text-ink-faint uppercase">
              Below threshold ({excluded.length})
            </span>
          </div>
          <div className="divide-y divide-border">
            {excluded.map((article) => (
              <ScoredArticleCard key={article.id} {...article} included={false} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ── Edition preview panel (ToC style) ───────────────────────────── */

const EditionTocPanel = (): React.ReactElement => (
  <div>
    <div className="flex items-baseline justify-between mb-6">
      <h3 className="font-mono text-xs tracking-wide text-ink-faint uppercase">Edition preview</h3>
      <span className="font-mono text-xs text-ink-tertiary">5 articles · 14 min</span>
    </div>

    {[
      { name: 'Technology', articles: ['The quiet revolution in reader design', 'TypeScript 6.0 introduces pattern matching', 'Why SQLite is the database you didn\'t know you needed'] },
      { name: 'Science', articles: ['JWST captures light from the universe\'s first galaxies'] },
      { name: 'Global News', articles: ['Pacific trade agreement reaches final ratification'] },
    ].map((section, i) => (
      <div key={section.name} className="mb-6">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="font-mono text-xs text-accent tracking-wide">{String(i + 1).padStart(2, '0')}</span>
          <span className="font-serif text-lg font-medium tracking-tight text-ink">{section.name}</span>
          <span className="font-mono text-xs text-ink-faint ml-auto">{section.articles.length}</span>
        </div>
        <div className="pl-8 flex flex-col gap-1.5">
          {section.articles.map((title, j) => (
            <div key={j} className="flex items-start gap-2">
              <span className="font-mono text-xs text-ink-faint shrink-0 mt-0.5">{j + 1}.</span>
              <span className="text-sm text-ink-secondary leading-snug">{title}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

/* ── Interactive focus builder ───────────────────────────────────── */

const InteractiveFocusBuilder = (): React.ReactElement => {
  const [threshold, setThreshold] = useState(30);
  const [selectedSourceIds, setSelectedSourceIds] = useState(new Set(['s1', 's2', 's3']));

  const toggleSource = (id: string): void => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const includedCount = mockArticles.filter((a) => a.confidence >= threshold / 100).length;

  return (
    <ModeShell
      activeMode="builder"
      onModeChange={() => {}}
      pathname="/focuses/tech/edit"
      username="alice"
      onLogout={() => {}}
      onSettingsClick={() => {}}
    >
      <BuilderNav activeTab="focuses" />
      <BuilderSplitView
        config={
          <FocusConfigPanel
            threshold={threshold}
            onThresholdChange={setThreshold}
            selectedSourceIds={selectedSourceIds}
            onToggleSource={toggleSource}
          />
        }
        preview={<FocusPreviewPanel articles={mockArticles} threshold={threshold} />}
        previewLabel="Preview"
        previewCount={includedCount}
      />
    </ModeShell>
  );
};

const InteractiveEditionBuilder = (): React.ReactElement => (
  <ModeShell
    activeMode="builder"
    onModeChange={() => {}}
    pathname="/editions/morning/edit"
    username="alice"
    onLogout={() => {}}
    onSettingsClick={() => {}}
  >
    <BuilderNav activeTab="editions" />
    <BuilderSplitView
      config={
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="font-serif text-2xl font-medium tracking-tight text-ink mb-1">Morning Brief</h2>
            <p className="text-sm text-ink-secondary">Daily digest, 7am, 15 minute target</p>
          </div>
          <Input label="Name" value="Morning Brief" readOnly />
          <Separator soft />
          <div>
            <div className="text-sm font-medium text-ink mb-2">Focuses</div>
            {['Technology', 'Science', 'Global News'].map((name) => (
              <div key={name} className="flex items-center gap-2 py-2">
                <Checkbox label={name} checked onCheckedChange={() => {}} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm">Save changes</Button>
            <Button variant="ghost" size="sm">Cancel</Button>
          </div>
        </div>
      }
      preview={<EditionTocPanel />}
      previewLabel="Edition preview"
      previewCount={5}
    />
  </ModeShell>
);

/* ── Stories ──────────────────────────────────────────────────────── */

const meta: Meta = {
  title: 'Design System/Compositions/Builder Split View',
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

/** Focus builder — adjust threshold slider and watch articles move in/out */
const FocusBuilder: Story = {
  render: () => withRouter('/focuses', InteractiveFocusBuilder),
};

/** Edition builder — configuration with ToC preview */
const EditionBuilder: Story = {
  render: () => withRouter('/editions', InteractiveEditionBuilder),
};

export default meta;
export { FocusBuilder, EditionBuilder };
