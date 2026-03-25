import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EntityIcon } from '../../components/entity-icon.tsx';
import { Button } from '../../components/button.tsx';
import { PageHeader } from '../../components/page-header.tsx';
import { StaggerList, StaggerItem } from '../../components/animate.tsx';

/* ── Mock data ─────────────────────────────────────────────────────── */

const mockSources = [
  { id: 'ars', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', description: 'In-depth technology news, analysis, and reviews', tags: ['technology', 'science'], coverImage: null },
  { id: 'hn', name: 'Hacker News', url: 'https://hnrss.org/frontpage', description: 'Community-curated tech and startup news', tags: ['technology', 'programming'], coverImage: null },
  { id: 'bbc', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', description: 'Breaking news and analysis from the BBC', tags: ['news', 'world'], coverImage: null },
];

const mockFocuses = [
  { id: 'tech', name: 'Technology', description: 'Software, hardware, startups, and the tech industry', icon: 'cpu', coverImage: null, sources: ['Ars Technica', 'Hacker News', 'The Verge', 'Wired'] },
  { id: 'science', name: 'Science', description: 'Research, discoveries, and the natural world', icon: 'flask-conical', coverImage: null, sources: ['Nature News', 'New Scientist', 'Quanta Magazine'] },
  { id: 'news', name: 'World News', description: 'International current affairs and global events', icon: 'globe', coverImage: null, sources: ['BBC News', 'Reuters', 'The Guardian'] },
];

const mockEditions = [
  { id: 'morning', name: 'Morning Briefing', description: 'A daily digest of top stories across technology, science, and world news. A calm start to your day.', icon: 'sun', coverImage: null, schedule: 'Daily at 7am', focuses: ['World News', 'Technology', 'Science'] },
  { id: 'weekly', name: 'Tech Weekly', description: 'A weekly roundup of the most important technology and programming stories.', icon: 'calendar', coverImage: null, schedule: 'Weekly (Saturday)', focuses: ['Technology', 'Programming'] },
];

/* ── Card components (simplified for stories) ──────────────────────── */

const SourceCard = ({ source, adopted, onAdopt }: { source: typeof mockSources[0]; adopted: boolean; onAdopt: () => void }): React.ReactElement => (
  <div className="rounded-lg border border-border bg-surface-raised p-4 flex items-start gap-3">
    <div className="w-10 h-10 rounded-md bg-surface-sunken flex items-center justify-center shrink-0">
      <EntityIcon icon="rss" size={16} className="text-ink-tertiary" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-serif text-base font-medium tracking-tight text-ink">{source.name}</div>
      <div className="text-xs text-ink-tertiary mt-0.5">{new URL(source.url).hostname}</div>
      <div className="text-sm text-ink-secondary mt-1 line-clamp-2 leading-relaxed">{source.description}</div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {source.tags.map((tag) => (
          <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-surface-sunken text-ink-tertiary">{tag}</span>
        ))}
      </div>
    </div>
    <div className="shrink-0 ml-2">
      {adopted ? (
        <span className="inline-flex items-center gap-1 text-xs text-accent font-medium"><EntityIcon icon="check" size={12} />Added</span>
      ) : (
        <Button variant="secondary" size="sm" onClick={onAdopt}>Add</Button>
      )}
    </div>
  </div>
);

const FocusCard = ({ focus, adopted, onAdopt }: { focus: typeof mockFocuses[0]; adopted: boolean; onAdopt: () => void }): React.ReactElement => (
  <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-accent-subtle flex items-center justify-center shrink-0 mt-0.5">
          <EntityIcon icon={focus.icon} fallback="target" size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-lg font-medium tracking-tight text-ink">{focus.name}</div>
          <div className="text-sm text-ink-secondary mt-0.5 leading-relaxed">{focus.description}</div>
        </div>
        <div className="shrink-0 ml-2">
          {adopted ? (
            <span className="inline-flex items-center gap-1 text-xs text-accent font-medium"><EntityIcon icon="check" size={12} />Added</span>
          ) : (
            <Button variant="secondary" size="sm" onClick={onAdopt}>Add</Button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {focus.sources.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-surface-sunken text-ink-tertiary">
            <EntityIcon icon="rss" size={10} className="text-ink-faint" />{s}
          </span>
        ))}
      </div>
    </div>
  </div>
);

const EditionCard = ({ edition, adopted, onAdopt }: { edition: typeof mockEditions[0]; adopted: boolean; onAdopt: () => void }): React.ReactElement => (
  <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
    <div className="p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0 mt-0.5">
          <EntityIcon icon={edition.icon} fallback="book-open" size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-xl font-medium tracking-tight text-ink">{edition.name}</div>
          <div className="text-sm text-ink-secondary mt-1 leading-relaxed">{edition.description}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-tertiary">
        <span className="inline-flex items-center gap-1"><EntityIcon icon="clock" size={12} className="text-ink-faint" />{edition.schedule}</span>
        <span className="inline-flex items-center gap-1"><EntityIcon icon="layers" size={12} className="text-ink-faint" />{edition.focuses.length} focuses</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {edition.focuses.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent-subtle text-accent">{f}</span>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        {adopted ? (
          <span className="inline-flex items-center gap-1 text-sm text-accent font-medium"><EntityIcon icon="check" size={14} />Added to your editions</span>
        ) : (
          <Button variant="primary" size="sm" onClick={onAdopt}>Add to my editions</Button>
        )}
      </div>
    </div>
  </div>
);

/* ── Full page story ───────────────────────────────────────────────── */

type Tab = 'editions' | 'focuses' | 'sources';
const tabList: { id: Tab; label: string }[] = [
  { id: 'editions', label: 'Editions' },
  { id: 'focuses', label: 'Focuses' },
  { id: 'sources', label: 'Sources' },
];

const DiscoveryPageStory = (): React.ReactElement => {
  const [activeTab, setActiveTab] = useState<Tab>('editions');
  const [adoptedSources, setAdoptedSources] = useState<Set<string>>(new Set());
  const [adoptedFocuses, setAdoptedFocuses] = useState<Set<string>>(new Set());
  const [adoptedEditions, setAdoptedEditions] = useState<Set<string>>(new Set());

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
        <PageHeader
          title="Discover"
          subtitle="Browse curated sources, focuses, and edition configurations to get started quickly"
          serif
        />

        <div className="flex gap-1 mb-6 border-b border-border">
          {tabList.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3 py-2 font-mono text-xs tracking-wide uppercase transition-colors duration-fast ease-gentle cursor-pointer ${
                  isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-tertiary'
                }`}
              >
                {tab.label}
                {isActive && <span className="absolute inset-x-3 bottom-0 h-px bg-ink" />}
              </button>
            );
          })}
        </div>

        {activeTab === 'editions' && (
          <StaggerList className="grid gap-4">
            {mockEditions.map((e) => (
              <StaggerItem key={e.id}>
                <EditionCard
                  edition={e}
                  adopted={adoptedEditions.has(e.id)}
                  onAdopt={() => setAdoptedEditions((prev) => new Set(prev).add(e.id))}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {activeTab === 'focuses' && (
          <StaggerList className="grid gap-3">
            {mockFocuses.map((f) => (
              <StaggerItem key={f.id}>
                <FocusCard
                  focus={f}
                  adopted={adoptedFocuses.has(f.id)}
                  onAdopt={() => setAdoptedFocuses((prev) => new Set(prev).add(f.id))}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {activeTab === 'sources' && (
          <StaggerList className="grid gap-3">
            {mockSources.map((s) => (
              <StaggerItem key={s.id}>
                <SourceCard
                  source={s}
                  adopted={adoptedSources.has(s.id)}
                  onAdopt={() => setAdoptedSources((prev) => new Set(prev).add(s.id))}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  );
};

/* ── Stories ────────────────────────────────────────────────────────── */

const meta: Meta = {
  title: 'Design System/Compositions/Discovery',
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

const Default: Story = {
  render: () => <DiscoveryPageStory />,
};

export default meta;
export { Default };
