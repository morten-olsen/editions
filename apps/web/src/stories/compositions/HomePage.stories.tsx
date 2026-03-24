import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../components/button.tsx';

/* ── Mock data ────────────────────────────────────────────────────── */

const now = Date.now();

type HomeEdition = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  publishedAt: string;
  configName: string;
  configIcon: string | null;
  sections: { focusName: string; articleCount: number }[];
  lead: {
    title: string;
    sourceName: string;
    imageUrl: string | null;
    consumptionTimeSeconds: number | null;
  } | null;
  highlights: { title: string; sourceName: string }[];
};

type HomeConfig = {
  id: string;
  name: string;
  icon: string | null;
};

type EditionSummary = {
  id: string;
  title: string;
  publishedAt: string;
  articleCount: number;
  totalReadingMinutes: number | null;
  readAt: string | null;
  configName: string;
};

const sampleConfigs: HomeConfig[] = [
  { id: 'cfg-1', name: 'Morning Brief', icon: 'sun' },
  { id: 'cfg-2', name: 'Deep Reads', icon: 'book-open' },
];

/* One edition per config — the magazine stand model */
const sampleEditions: HomeEdition[] = [
  {
    id: 'ed-1',
    editionConfigId: 'cfg-1',
    title: 'Morning Brief',
    totalReadingMinutes: 14,
    articleCount: 8,
    publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    configName: 'Morning Brief',
    configIcon: 'sun',
    sections: [
      { focusName: 'Technology', articleCount: 4 },
      { focusName: 'Science', articleCount: 1 },
      { focusName: 'Global News', articleCount: 3 },
    ],
    lead: {
      title: 'The quiet revolution in reader design',
      sourceName: 'Ars Technica',
      imageUrl: 'https://picsum.photos/seed/reader-newsstand/800/600',
      consumptionTimeSeconds: 480,
    },
    highlights: [
      { title: "JWST captures the universe's first galaxies", sourceName: 'Nature' },
      { title: "Europe's new data sovereignty framework", sourceName: 'The Guardian' },
    ],
  },
  {
    id: 'ed-2',
    editionConfigId: 'cfg-2',
    title: 'Deep Reads',
    totalReadingMinutes: 34,
    articleCount: 12,
    publishedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
    configName: 'Deep Reads',
    configIcon: 'book-open',
    sections: [
      { focusName: 'Technology', articleCount: 5 },
      { focusName: 'Culture', articleCount: 4 },
      { focusName: 'Science', articleCount: 3 },
    ],
    lead: {
      title: 'On finite feeds and calm software',
      sourceName: 'Hacker News',
      imageUrl: null,
      consumptionTimeSeconds: 720,
    },
    highlights: [{ title: "Why SQLite is the database you didn't know you needed", sourceName: 'Hacker News' }],
  },
];

const sampleIssues: EditionSummary[] = [
  { id: 'ed-1', title: 'Morning Brief — Mar 24', publishedAt: '2026-03-24T07:00:00Z', articleCount: 8, totalReadingMinutes: 14, readAt: null, configName: 'Morning Brief' },
  { id: 'ed-3', title: 'Morning Brief — Mar 23', publishedAt: '2026-03-23T07:00:00Z', articleCount: 6, totalReadingMinutes: 11, readAt: null, configName: 'Morning Brief' },
  { id: 'ed-5', title: 'Morning Brief — Mar 22', publishedAt: '2026-03-22T07:00:00Z', articleCount: 7, totalReadingMinutes: 12, readAt: null, configName: 'Morning Brief' },
  { id: 'ed-7', title: 'Morning Brief — Mar 21', publishedAt: '2026-03-21T07:00:00Z', articleCount: 5, totalReadingMinutes: 9, readAt: '2026-03-21T19:00:00Z', configName: 'Morning Brief' },
  { id: 'ed-9', title: 'Morning Brief — Mar 20', publishedAt: '2026-03-20T07:00:00Z', articleCount: 8, totalReadingMinutes: 15, readAt: '2026-03-20T18:30:00Z', configName: 'Morning Brief' },
];

/* ── Presentational components ────────────────────────────────────── */

const Masthead = ({ date }: { date?: string }): React.ReactElement => {
  const displayDate = date ?? 'Tuesday, 24 March 2026';
  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <span className="font-mono text-xs tracking-wide uppercase text-ink-faint">Editions</span>
        <span className="font-mono text-xs tracking-wide text-ink-faint">{displayDate}</span>
      </div>
      <div className="h-px bg-border-strong" />
    </div>
  );
};

const CheckIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path
      fillRule="evenodd"
      d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
      clipRule="evenodd"
    />
  </svg>
);

const formatPubDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const formatFullDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/* Cover card background */
const CoverCardBackground = ({ imageUrl }: { imageUrl: string | null }): React.ReactElement =>
  imageUrl ? (
    <div className="absolute inset-0 -z-10">
      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/40 to-black/80" />
    </div>
  ) : (
    <div className="absolute inset-0 -z-10 bg-surface-sunken" />
  );

/* Cover card stats */
const CoverCardStats = ({ edition, hasImage }: { edition: HomeEdition; hasImage: boolean }): React.ReactElement => (
  <div
    className={`font-mono text-xs tracking-wide flex items-center gap-3 ${hasImage ? 'text-white/50' : 'text-ink-faint'}`}
  >
    <span>{edition.articleCount} articles</span>
    {edition.totalReadingMinutes != null && (
      <>
        <span className={hasImage ? 'text-white/30' : 'text-ink-faint'}>·</span>
        <span>{edition.totalReadingMinutes} min</span>
      </>
    )}
    <span className={hasImage ? 'text-white/30' : 'text-ink-faint'}>·</span>
    <span>{edition.sections.length} sections</span>
  </div>
);

/* Cover card with "All issues" link */
const CoverCardStatic = ({ edition }: { edition: HomeEdition }): React.ReactElement => {
  const hasImage = !!edition.lead?.imageUrl;

  return (
    <div>
      <div className="group block rounded-lg overflow-hidden relative isolate cursor-pointer">
        <CoverCardBackground imageUrl={edition.lead?.imageUrl ?? null} />
        <div className={`flex flex-col justify-between p-5 min-h-56 ${hasImage ? 'text-white' : ''}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className={`font-mono text-xs tracking-wide uppercase ${hasImage ? 'text-white/80' : 'text-accent'}`}>
              {edition.configName}
            </span>
            <span className={`font-mono text-xs tracking-wide ${hasImage ? 'text-white/50' : 'text-ink-faint'}`}>
              {formatPubDate(edition.publishedAt)}
            </span>
          </div>
          <div className="mt-auto pt-4">
            {edition.lead && (
              <>
                <div className={`font-mono text-xs tracking-wide mb-2 ${hasImage ? 'text-white/60' : 'text-ink-faint'}`}>
                  {edition.lead.sourceName}
                </div>
                <h3
                  className={`font-serif text-xl md:text-2xl font-medium tracking-tight leading-snug mb-3 ${hasImage ? 'text-white' : 'text-ink'}`}
                >
                  {edition.lead.title}
                </h3>
              </>
            )}
            {edition.sections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {edition.sections.map((s) => (
                  <span
                    key={s.focusName}
                    className={`text-xs px-2 py-0.5 rounded-full ${hasImage ? 'bg-white/15 text-white/80' : 'bg-surface-sunken text-ink-tertiary'}`}
                  >
                    {s.focusName}
                  </span>
                ))}
              </div>
            )}
            <CoverCardStats edition={edition} hasImage={hasImage} />
          </div>
        </div>
      </div>
      <div className="mt-2">
        <span className="font-mono text-xs tracking-wide text-ink-faint hover:text-ink transition-colors duration-fast cursor-pointer">
          All issues →
        </span>
      </div>
    </div>
  );
};

type SetupStepStaticProps = {
  number: number;
  title: string;
  description: string;
  done: boolean;
  active: boolean;
  actionLabel: string;
};

const SetupStepStatic = ({
  number,
  title,
  description,
  done,
  active,
  actionLabel,
}: SetupStepStaticProps): React.ReactElement => (
  <div className="py-5 border-t border-border">
    <div className="flex items-start gap-5">
      <div className="shrink-0 w-7 pt-0.5">
        {done ? (
          <span className="text-accent">
            <CheckIcon />
          </span>
        ) : (
          <span className={`font-mono text-sm ${active ? 'text-ink-faint' : 'text-ink-faint/40'}`}>
            {String(number).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`font-serif text-lg font-medium tracking-tight ${done ? 'text-ink-tertiary' : active ? 'text-ink' : 'text-ink-faint'}`}
        >
          {title}
        </div>
        <div className={`text-sm mt-1 leading-relaxed ${done || active ? 'text-ink-tertiary' : 'text-ink-faint'}`}>
          {description}
        </div>
        {!done && active && (
          <div className="mt-4">
            <Button variant="primary" size="sm">
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  </div>
);

const QuickLinks = ({ configs }: { configs: HomeConfig[] }): React.ReactElement => (
  <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
    <span className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer">
      Browse feed
    </span>
    <span className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer">
      Bookmarks
    </span>
    {configs.map((cfg) => (
      <span
        key={cfg.id}
        className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
      >
        {cfg.name}
      </span>
    ))}
  </div>
);

const ContentShell = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <div className="min-h-dvh bg-surface">
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">{children}</div>
  </div>
);

/* Filter toggle for the All Issues view */
const FilterToggle = ({
  value,
  onChange,
}: {
  value: 'unread' | 'all';
  onChange: (v: 'unread' | 'all') => void;
}): React.ReactElement => (
  <div className="flex gap-1 bg-surface-sunken rounded-md p-0.5">
    {(['unread', 'all'] as const).map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={`font-mono text-xs tracking-wide px-3 py-1 rounded transition-colors duration-fast capitalize ${
          value === opt ? 'bg-surface text-ink shadow-xs' : 'text-ink-tertiary hover:text-ink'
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

/* ── Stories ───────────────────────────────────────────────────── */

const meta: Meta = {
  title: 'Design System/Compositions/Home Page',
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

/* Fresh user — no setup done yet */
const FreshSetup: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-3">Getting started</h1>
        <p className="text-sm text-ink-secondary leading-relaxed">
          A finite, curated reading experience. Set up your sources, define your interests, and create your first
          edition — a magazine built just for you.
        </p>
      </div>
      <div>
        <SetupStepStatic
          number={1}
          title="Add sources"
          description="Subscribe to RSS feeds and podcasts. These are the raw ingredients for your editions."
          done={false}
          active={true}
          actionLabel="Add your first source"
        />
        <SetupStepStatic
          number={2}
          title="Create focuses"
          description="Define topic areas like Technology, Science, or Local News. Articles are automatically classified into your focuses."
          done={false}
          active={false}
          actionLabel="Create a focus"
        />
        <SetupStepStatic
          number={3}
          title="Create an edition"
          description="Build a scheduled, finite digest from your focuses. Set time budgets, pick sections, and read on your terms."
          done={false}
          active={false}
          actionLabel="Create your first edition"
        />
        <div className="h-px bg-border" />
      </div>
    </ContentShell>
  ),
};

/* Partially set up — sources done, focuses next */
const PartialSetup: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-3">Getting started</h1>
        <p className="text-sm text-ink-secondary leading-relaxed">
          A finite, curated reading experience. Set up your sources, define your interests, and create your first
          edition — a magazine built just for you.
        </p>
      </div>
      <div>
        <SetupStepStatic
          number={1}
          title="Add sources"
          description="Subscribe to RSS feeds and podcasts. These are the raw ingredients for your editions."
          done={true}
          active={false}
          actionLabel="Add your first source"
        />
        <SetupStepStatic
          number={2}
          title="Create focuses"
          description="Define topic areas like Technology, Science, or Local News. Articles are automatically classified into your focuses."
          done={false}
          active={true}
          actionLabel="Create a focus"
        />
        <SetupStepStatic
          number={3}
          title="Create an edition"
          description="Build a scheduled, finite digest from your focuses. Set time budgets, pick sections, and read on your terms."
          done={false}
          active={false}
          actionLabel="Create your first edition"
        />
        <div className="h-px bg-border" />
      </div>
      <div className="mt-6">
        <span className="font-mono text-xs tracking-wide text-ink-tertiary cursor-pointer">Browse all articles →</span>
      </div>
    </ContentShell>
  ),
};

/* Caught-up card: config with no unread edition */
const CaughtUpCardStatic = ({ config }: { config: HomeConfig }): React.ReactElement => (
  <div>
    <div className="rounded-lg bg-surface-sunken p-5 min-h-32 flex flex-col justify-between">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs tracking-wide uppercase text-accent">{config.name}</span>
      </div>
      <div className="mt-auto pt-4">
        <p className="font-serif text-lg text-ink-tertiary tracking-tight">All caught up</p>
      </div>
    </div>
    <div className="mt-2">
      <span className="font-mono text-xs tracking-wide text-ink-faint hover:text-ink transition-colors duration-fast cursor-pointer">
        All issues →
      </span>
    </div>
  </div>
);

/* Magazine stand with one edition per config */
const MagazineStand: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="flex flex-col gap-6">
        {sampleEditions.map((edition) => (
          <CoverCardStatic key={edition.id} edition={edition} />
        ))}
      </div>
      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

/* Single edition config — one cover card */
const SingleEdition: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="flex flex-col gap-6">
        <CoverCardStatic edition={sampleEditions[0] as HomeEdition} />
      </div>
      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

/* No-image edition — typographic cover card */
const NoImageEdition: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="flex flex-col gap-6">
        <CoverCardStatic edition={sampleEditions[1] as HomeEdition} />
      </div>
      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

/* All caught up */
const AllRead: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="py-12 text-center">
        <div className="text-4xl text-accent/20 mb-4 select-none" aria-hidden="true">
          ~
        </div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-ink mb-2">All read</h1>
        <p className="text-sm text-ink-tertiary leading-relaxed">
          You're up to date. New editions will appear here when they're generated.
        </p>
      </div>
      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

/* All Issues view — unread filter */
const AllIssuesUnread: Story = {
  render: () => {
    const [filter, setFilter] = useState<'unread' | 'all'>('unread');
    const issues = filter === 'unread' ? sampleIssues.filter((i) => !i.readAt) : sampleIssues;

    return (
      <ContentShell>
        <div className="mb-8">
          <span className="font-mono text-xs tracking-wide text-ink-faint mb-4 inline-block cursor-pointer">
            ← Back
          </span>
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-ink">Morning Brief</h1>
            <FilterToggle value={filter} onChange={setFilter} />
          </div>
        </div>
        <div>
          {issues.map((issue) => (
            <div key={issue.id} className="py-4 border-t border-border group">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-mono text-xs tracking-wide text-ink-faint">
                      {formatFullDate(issue.publishedAt)}
                    </span>
                    {issue.readAt && <span className="font-mono text-xs tracking-wide text-accent">read</span>}
                  </div>
                  <div className="font-serif text-lg font-medium tracking-tight text-ink leading-snug">
                    {issue.title}
                  </div>
                  <div className="font-mono text-xs text-ink-faint mt-1.5 tracking-wide">
                    {issue.articleCount} articles
                    {issue.totalReadingMinutes != null && ` · ${issue.totalReadingMinutes} min`}
                  </div>
                </div>
                <span className="shrink-0 opacity-0 group-hover:opacity-100 font-mono text-xs tracking-wide text-ink-faint hover:text-critical transition-opacity duration-fast cursor-pointer">
                  Delete
                </span>
              </div>
            </div>
          ))}
          <div className="h-px bg-border" />
        </div>
        <div className="mt-8">
          <span className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer">
            Edition settings
          </span>
        </div>
      </ContentShell>
    );
  },
};

/* Mixed stand — one config has an unread edition, the other is caught up */
const MixedStand: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="flex flex-col gap-6">
        <CoverCardStatic edition={sampleEditions[0] as HomeEdition} />
        <CaughtUpCardStatic config={sampleConfigs[1] as HomeConfig} />
      </div>
      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

export default meta;
export { FreshSetup, PartialSetup, MagazineStand, MixedStand, SingleEdition, NoImageEdition, AllRead, AllIssuesUnread };
