import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders } from "../api/api.hooks.ts";
import { Button } from "../components/button.tsx";
import { EntityIcon } from "../components/entity-icon.tsx";
import { SlideIn, StaggerList, StaggerItem, FadeIn } from "../components/animate.tsx";

type EditionConfigSummary = {
  id: string;
  name: string;
  icon: string | null;
};

type EditionSummary = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  readAt: string | null;
  publishedAt: string;
  configName: string;
};

type SourceSummary = {
  id: string;
  name: string;
};

type FocusSummary = {
  id: string;
  name: string;
  icon: string | null;
};

type HomeData = {
  sources: SourceSummary[];
  focuses: FocusSummary[];
  configs: EditionConfigSummary[];
  unreadEditions: EditionSummary[];
};

const useHomeData = (): { data: HomeData | undefined; isLoading: boolean } => {
  const headers = useAuthHeaders();

  return useQuery({
    queryKey: ["home"],
    queryFn: async (): Promise<HomeData> => {
      const [sourcesRes, focusesRes, configsRes] = await Promise.all([
        client.GET("/api/sources", { headers }),
        client.GET("/api/focuses", { headers }),
        client.GET("/api/editions/configs", { headers }),
      ]);

      const sources = (sourcesRes.data ?? []) as SourceSummary[];
      const focuses = (focusesRes.data ?? []) as FocusSummary[];
      const configs = (configsRes.data ?? []) as EditionConfigSummary[];

      const allEditions = await Promise.all(
        configs.map(async (cfg) => {
          const { data } = await client.GET("/api/editions/configs/{configId}/editions", {
            params: { path: { configId: cfg.id } },
            headers,
          });
          return (data ?? []) as EditionSummary[];
        }),
      );

      const unreadEditions = allEditions
        .flat()
        .filter((e) => !e.readAt)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      return { sources, focuses, configs, unreadEditions };
    },
    enabled: !!headers,
  });
};

/* ---------- Masthead ---------- */

const Masthead = (): React.ReactElement => {
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <span className="font-mono text-xs tracking-wide uppercase text-ink-faint">
          Editions
        </span>
        <span className="font-mono text-xs tracking-wide text-ink-faint">
          {date}
        </span>
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
  href: string;
  actionLabel: string;
};

const CheckIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
  </svg>
);

const SetupStep = ({ number, title, description, done, href, actionLabel }: SetupStepProps): React.ReactElement => (
  <div className="py-5 border-t border-border">
    <div className="flex items-start gap-5">
      <div className="shrink-0 w-7 pt-0.5">
        {done ? (
          <span className="text-accent">
            <CheckIcon />
          </span>
        ) : (
          <span className="font-mono text-sm text-ink-faint">
            {String(number).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-serif text-lg font-medium tracking-tight ${done ? "text-ink-tertiary" : "text-ink"}`}>
          {title}
        </div>
        <div className="text-sm text-ink-tertiary mt-1 leading-relaxed">
          {description}
        </div>
        {!done && (
          <Link to={href} className="inline-block mt-4">
            <Button variant="primary" size="sm">{actionLabel}</Button>
          </Link>
        )}
      </div>
    </div>
  </div>
);

const SetupGuide = ({ data }: { data: HomeData }): React.ReactElement => {
  const hasSources = data.sources.length > 0;
  const hasFocuses = data.focuses.length > 0;
  const hasEditions = data.configs.length > 0;

  return (
    <SlideIn from="up" distance={12}>
      <Masthead />

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-3">
          Getting started
        </h1>
        <p className="text-sm text-ink-secondary leading-relaxed">
          A finite, curated reading experience. Set up your sources, define your interests, and create your first edition — a magazine built just for you.
        </p>
      </div>

      <div>
        <SetupStep
          number={1}
          title="Add sources"
          description="Subscribe to RSS feeds and podcasts. These are the raw ingredients for your editions."
          done={hasSources}
          href="/sources/new"
          actionLabel="Add your first source"
        />
        <SetupStep
          number={2}
          title="Create focuses"
          description="Define topic areas like Technology, Science, or Local News. Articles are automatically classified into your focuses."
          done={hasFocuses}
          href="/focuses/new"
          actionLabel="Create a focus"
        />
        <SetupStep
          number={3}
          title="Create an edition"
          description="Build a scheduled, finite digest from your focuses. Set time budgets, pick sections, and read on your terms."
          done={hasEditions}
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

/* ---------- Edition card ---------- */

type EditionCardProps = {
  edition: EditionSummary;
  configId: string;
};

const ArrowIcon = (): React.ReactElement => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5.5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EditionCard = ({ edition, configId }: EditionCardProps): React.ReactElement => {
  const pubDate = new Date(edition.publishedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <Link
      to="/editions/$configId/issues/$editionId"
      params={{ configId, editionId: edition.id }}
      className="group block py-5 border-t border-border hover:border-accent transition-colors duration-fast"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs tracking-wide text-accent uppercase mb-2">
            {edition.configName} · {pubDate}
          </div>
          <div className="font-serif text-xl font-medium tracking-tight text-ink group-hover:text-accent transition-colors duration-fast leading-snug">
            {edition.title}
          </div>
          <div className="font-mono text-xs text-ink-faint mt-2.5 tracking-wide">
            {edition.articleCount} articles
            {edition.totalReadingMinutes != null && ` · ${edition.totalReadingMinutes} min`}
          </div>
        </div>
        <div className="shrink-0 self-center text-ink-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-fast">
          <ArrowIcon />
        </div>
      </div>
    </Link>
  );
};

/* ---------- Configured home ---------- */

const ConfiguredHome = ({ data }: { data: HomeData }): React.ReactElement => {
  const { unreadEditions, configs } = data;

  return (
    <SlideIn from="up" distance={12}>
      <Masthead />

      {unreadEditions.length > 0 ? (
        <div>
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">
              Your reading list
            </h1>
            <p className="text-sm text-ink-tertiary">
              {unreadEditions.length === 1
                ? "One edition waiting."
                : `${unreadEditions.length} editions waiting.`}
            </p>
          </div>

          <StaggerList className="flex flex-col">
            {unreadEditions.map((edition) => (
              <StaggerItem key={edition.id}>
                <EditionCard edition={edition} configId={edition.editionConfigId} />
              </StaggerItem>
            ))}
          </StaggerList>
          <div className="h-px bg-border" />
        </div>
      ) : (
        <div className="py-12 text-center">
          <div className="text-4xl text-accent/20 mb-4 select-none" aria-hidden="true">~</div>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-ink mb-2">
            All read
          </h1>
          <p className="text-sm text-ink-tertiary leading-relaxed">
            You're up to date. New editions will appear here when they're generated.
          </p>
        </div>
      )}

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
            to="/editions/$configId"
            params={{ configId: cfg.id }}
            className="flex items-center gap-1.5 font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast"
          >
            <EntityIcon icon={cfg.icon} fallback="newspaper" size={12} className="shrink-0" />
            {cfg.name}
          </Link>
        ))}
      </div>
    </SlideIn>
  );
};

/* ---------- Home page ---------- */

const HomePage = (): React.ReactNode => {
  const { data, isLoading } = useHomeData();

  if (isLoading || !data) {
    return (
      <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
    );
  }

  const isFullyConfigured = data.sources.length > 0 && data.focuses.length > 0 && data.configs.length > 0;

  if (!isFullyConfigured) {
    return <SetupGuide data={data} />;
  }

  return <ConfiguredHome data={data} />;
};

const Route = createFileRoute("/")({
  component: HomePage,
});

export { Route };
