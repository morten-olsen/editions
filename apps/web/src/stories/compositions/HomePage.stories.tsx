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

const sampleConfigs: HomeConfig[] = [
  { id: 'cfg-1', name: 'Morning Brief', icon: 'sun' },
  { id: 'cfg-2', name: 'Deep Reads', icon: 'book-open' },
];

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
  {
    id: 'ed-3',
    editionConfigId: 'cfg-1',
    title: 'Morning Brief',
    totalReadingMinutes: 11,
    articleCount: 6,
    publishedAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
    configName: 'Morning Brief',
    configIcon: 'sun',
    sections: [
      { focusName: 'Global News', articleCount: 3 },
      { focusName: 'Technology', articleCount: 3 },
    ],
    lead: {
      title: 'Pacific trade agreement reaches final ratification',
      sourceName: 'Reuters',
      imageUrl: 'https://picsum.photos/seed/trade-newsstand/800/600',
      consumptionTimeSeconds: 120,
    },
    highlights: [{ title: 'TypeScript 6.0 introduces pattern matching', sourceName: 'Hacker News' }],
  },
];

/* ── Presentational components ────────────────────────────────────── */

const Masthead = ({ date }: { date?: string }): React.ReactElement => {
  const displayDate = date ?? 'Wednesday, 11 March 2026';
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

/* Cover card lead section */
const CoverCardLead = ({ edition, hasImage }: { edition: HomeEdition; hasImage: boolean }): React.ReactElement => (
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

/* Cover card: full magazine-cover-style card with image background */
const CoverCardStatic = ({ edition }: { edition: HomeEdition }): React.ReactElement => {
  const hasImage = !!edition.lead?.imageUrl;

  return (
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
        <CoverCardLead edition={edition} hasImage={hasImage} />
      </div>
    </div>
  );
};

/* Teaser: compact list item for secondary editions */
const EditionTeaserStatic = ({ edition }: { edition: HomeEdition }): React.ReactElement => (
  <div className="group block py-4 border-t border-border cursor-pointer">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs tracking-wide text-accent uppercase mb-1.5">
          {edition.configName} · {formatPubDate(edition.publishedAt)}
        </div>
        <div className="font-serif text-lg font-medium tracking-tight text-ink leading-snug">{edition.title}</div>
        <div className="font-mono text-xs text-ink-faint mt-1.5 tracking-wide">
          {edition.articleCount} articles
          {edition.totalReadingMinutes != null && ` · ${edition.totalReadingMinutes} min`}
        </div>
      </div>
      {edition.lead?.imageUrl && (
        <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-surface-sunken">
          <img src={edition.lead.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  </div>
);

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

/* Newsstand with multiple unread editions */
const Newsstand: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">Your reading list</h1>
        <p className="text-sm text-ink-tertiary">3 editions waiting.</p>
      </div>

      {/* Featured cover card */}
      <CoverCardStatic edition={sampleEditions[0] as HomeEdition} />

      {/* Remaining teasers */}
      <div className="mt-2">
        <EditionTeaserStatic edition={sampleEditions[1] as HomeEdition} />
        <EditionTeaserStatic edition={sampleEditions[2] as HomeEdition} />
        <div className="h-px bg-border" />
      </div>

      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

/* Single unread edition — cover card only */
const SingleEdition: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">Your reading list</h1>
        <p className="text-sm text-ink-tertiary">One edition waiting.</p>
      </div>

      <CoverCardStatic edition={sampleEditions[0] as HomeEdition} />

      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

/* No-image edition — typographic cover card */
const NoImageEdition: Story = {
  render: () => (
    <ContentShell>
      <Masthead />
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">Your reading list</h1>
        <p className="text-sm text-ink-tertiary">One edition waiting.</p>
      </div>

      <CoverCardStatic edition={sampleEditions[1] as HomeEdition} />

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

export default meta;
export { FreshSetup, PartialSetup, Newsstand, SingleEdition, NoImageEdition, AllRead };
