import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { client } from '../api/api.ts';
import { useAuthHeaders } from '../api/api.hooks.ts';
import { Button } from '../components/button.tsx';
import { SlideIn, StaggerList, StaggerItem, FadeIn } from '../components/animate.tsx';
import { CoverCard, EditionTeaser } from '../views/home/home-cards.tsx';
import type { HomeEdition } from '../views/home/home-cards.tsx';

// --- Types (match GET /api/home response) ---

type HomeConfig = { id: string; name: string; icon: string | null };

type HomeData = { sourcesCount: number; focusesCount: number; configs: HomeConfig[]; editions: HomeEdition[] };

// --- Data hook ---

const useHomeData = (): { data: HomeData | undefined; isLoading: boolean } => {
  const headers = useAuthHeaders();

  return useQuery({
    queryKey: ['home'],
    queryFn: async (): Promise<HomeData> => {
      const res = await client.GET('/api/home', { headers });
      return res.data as unknown as HomeData;
    },
    enabled: !!headers,
  });
};

/* ---------- Masthead ---------- */

const Masthead = (): React.ReactElement => {
  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <span className="font-mono text-xs tracking-wide uppercase text-ink-faint">Editions</span>
        <span className="font-mono text-xs tracking-wide text-ink-faint">{date}</span>
      </div>
      <div className="h-px bg-border-strong" />
    </div>
  );
};

/* ---------- Setup guide (new users) ---------- */

type SetupStepProps = {
  number: number;
  title: string;
  description: string;
  done: boolean;
  active: boolean;
  href: string;
  actionLabel: string;
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

const SetupStep = (p: SetupStepProps): React.ReactElement => (
  <div className="py-5 border-t border-border">
    <div className="flex items-start gap-5">
      <div className="shrink-0 w-7 pt-0.5">
        {p.done ? (
          <span className="text-accent">
            <CheckIcon />
          </span>
        ) : (
          <span className={`font-mono text-sm ${p.active ? 'text-ink-faint' : 'text-ink-faint/40'}`}>
            {String(p.number).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`font-serif text-lg font-medium tracking-tight ${p.done ? 'text-ink-tertiary' : p.active ? 'text-ink' : 'text-ink-faint'}`}
        >
          {p.title}
        </div>
        <div className={`text-sm mt-1 leading-relaxed ${p.done || p.active ? 'text-ink-tertiary' : 'text-ink-faint'}`}>
          {p.description}
        </div>
        {!p.done && p.active && (
          <Link to={p.href} className="inline-block mt-4">
            <Button variant="primary" size="sm">
              {p.actionLabel}
            </Button>
          </Link>
        )}
      </div>
    </div>
  </div>
);

const SetupGuide = ({ data }: { data: HomeData }): React.ReactElement => {
  const hasSources = data.sourcesCount > 0;
  const hasFocuses = data.focusesCount > 0;
  const hasEditions = data.configs.length > 0;

  return (
    <SlideIn from="up" distance={12}>
      <Masthead />

      <div className="mb-8" data-ai-id="setup-guide" data-ai-role="page" data-ai-label="Getting started">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-3">Getting started</h1>
        <p className="text-sm text-ink-secondary leading-relaxed">
          A finite, curated reading experience. Set up your sources, define your interests, and create your first
          edition — a magazine built just for you.
        </p>
      </div>

      <div>
        <SetupStep
          number={1}
          title="Add sources"
          description="Subscribe to RSS feeds and podcasts. These are the raw ingredients for your editions."
          done={hasSources}
          active={!hasSources}
          href="/sources/new"
          actionLabel="Add your first source"
        />
        <SetupStep
          number={2}
          title="Create focuses"
          description="Define topic areas like Technology, Science, or Local News. Articles are automatically classified into your focuses."
          done={hasFocuses}
          active={hasSources && !hasFocuses}
          href="/focuses/new"
          actionLabel="Create a focus"
        />
        <SetupStep
          number={3}
          title="Create an edition"
          description="Build a scheduled, finite digest from your focuses. Set time budgets, pick sections, and read on your terms."
          done={hasEditions}
          active={hasSources && hasFocuses && !hasEditions}
          href="/editions/new"
          actionLabel="Create your first edition"
        />
        <div className="h-px bg-border" />
      </div>

      {hasSources && (
        <FadeIn>
          <div className="mt-6">
            <Link
              to="/feed"
              className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast"
            >
              Browse all articles →
            </Link>
          </div>
        </FadeIn>
      )}
    </SlideIn>
  );
};

/* ---------- Configured home (the newsstand) ---------- */

const AllReadState = (): React.ReactElement => (
  <div className="py-12 text-center">
    <div className="text-4xl text-accent/20 mb-4 select-none" aria-hidden="true">
      ~
    </div>
    <h1 className="font-serif text-2xl font-medium tracking-tight text-ink mb-2">All read</h1>
    <p className="text-sm text-ink-tertiary leading-relaxed">
      You're up to date. New editions will appear here when they're generated.
    </p>
  </div>
);

const QuickLinks = ({ configs }: { configs: HomeConfig[] }): React.ReactElement => (
  <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
    <Link
      to="/feed"
      className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast"
    >
      Browse feed
    </Link>
    <Link
      to="/bookmarks"
      className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast"
    >
      Bookmarks
    </Link>
    {configs.map((cfg) => (
      <Link
        key={cfg.id}
        to="/editions/$configId/edit"
        params={{ configId: cfg.id }}
        className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast"
      >
        {cfg.name}
      </Link>
    ))}
  </div>
);

const EditionsList = ({ editions }: { editions: HomeEdition[] }): React.ReactElement => {
  const featured = editions[0];
  const rest = editions.slice(1);
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">Your reading list</h1>
        <p className="text-sm text-ink-tertiary">
          {editions.length === 1 ? 'One edition waiting.' : `${editions.length} editions waiting.`}
        </p>
      </div>
      {featured && (
        <StaggerList>
          <StaggerItem>
            <CoverCard edition={featured} />
          </StaggerItem>
        </StaggerList>
      )}
      {rest.length > 0 && (
        <StaggerList className="mt-2">
          {rest.map((edition) => (
            <StaggerItem key={edition.id}>
              <EditionTeaser edition={edition} />
            </StaggerItem>
          ))}
          <div className="h-px bg-border" />
        </StaggerList>
      )}
    </div>
  );
};

const ConfiguredHome = ({ data }: { data: HomeData }): React.ReactElement => (
  <SlideIn from="up" distance={12}>
    <Masthead />
    {data.editions.length > 0 ? <EditionsList editions={data.editions} /> : <AllReadState />}
    <QuickLinks configs={data.configs} />
  </SlideIn>
);

/* ---------- Home page ---------- */

const HomePage = (): React.ReactNode => {
  const { data, isLoading } = useHomeData();

  if (isLoading || !data) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  const isFullyConfigured = data.sourcesCount > 0 && data.focusesCount > 0 && data.configs.length > 0;

  if (!isFullyConfigured) {
    return <SetupGuide data={data} />;
  }

  return <ConfiguredHome data={data} />;
};

const Route = createFileRoute('/')({
  component: HomePage,
});

export { Route };
