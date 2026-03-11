import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders } from "../api/api.hooks.ts";
import { Button } from "../components/button.tsx";
import { SlideIn, StaggerList, StaggerItem, FadeIn } from "../components/animate.tsx";

// --- Types (match GET /api/home response) ---

type HomeConfig = {
  id: string;
  name: string;
  icon: string | null;
};

type HomeEditionSection = {
  focusName: string;
  articleCount: number;
};

type HomeEditionLead = {
  title: string;
  sourceName: string;
  imageUrl: string | null;
  consumptionTimeSeconds: number | null;
};

type HomeEditionHighlight = {
  title: string;
  sourceName: string;
};

type HomeEdition = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  publishedAt: string;
  configName: string;
  configIcon: string | null;
  sections: HomeEditionSection[];
  lead: HomeEditionLead | null;
  highlights: HomeEditionHighlight[];
};

type HomeData = {
  sourcesCount: number;
  focusesCount: number;
  configs: HomeConfig[];
  editions: HomeEdition[];
};

// --- Data hook ---

const useHomeData = (): { data: HomeData | undefined; isLoading: boolean } => {
  const headers = useAuthHeaders();

  return useQuery({
    queryKey: ["home"],
    queryFn: async (): Promise<HomeData> => {
      const res = await client.GET("/api/home", { headers });
      return res.data as unknown as HomeData;
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
  active: boolean;
  href: string;
  actionLabel: string;
};

const CheckIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
  </svg>
);

const SetupStep = ({ number, title, description, done, active, href, actionLabel }: SetupStepProps): React.ReactElement => (
  <div className="py-5 border-t border-border">
    <div className="flex items-start gap-5">
      <div className="shrink-0 w-7 pt-0.5">
        {done ? (
          <span className="text-accent">
            <CheckIcon />
          </span>
        ) : (
          <span className={`font-mono text-sm ${active ? "text-ink-faint" : "text-ink-faint/40"}`}>
            {String(number).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-serif text-lg font-medium tracking-tight ${done ? "text-ink-tertiary" : active ? "text-ink" : "text-ink-faint"}`}>
          {title}
        </div>
        <div className={`text-sm mt-1 leading-relaxed ${done || active ? "text-ink-tertiary" : "text-ink-faint"}`}>
          {description}
        </div>
        {!done && active && (
          <Link to={href} className="inline-block mt-4">
            <Button variant="primary" size="sm">{actionLabel}</Button>
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

/* ---------- Magazine cover card ---------- */

const formatPubDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const CoverCard = ({ edition }: { edition: HomeEdition }): React.ReactElement => {
  const hasImage = !!edition.lead?.imageUrl;

  return (
    <Link
      to="/editions/$configId/issues/$editionId/magazine"
      params={{ configId: edition.editionConfigId, editionId: edition.id }}
      className="group block rounded-lg overflow-hidden relative isolate"
    >
      {/* Background: image or gradient */}
      {hasImage ? (
        <div className="absolute inset-0 -z-10">
          <img
            src={edition.lead!.imageUrl!}
            alt=""
            className="w-full h-full object-cover transition-transform duration-slow ease-gentle group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/40 to-black/80" />
        </div>
      ) : (
        <div className="absolute inset-0 -z-10 bg-surface-sunken group-hover:bg-surface-raised transition-colors duration-fast" />
      )}

      <div className={`flex flex-col justify-between p-5 min-h-56 ${hasImage ? "text-white" : ""}`}>
        {/* Top bar: config name + date */}
        <div className="flex items-baseline justify-between gap-3">
          <span className={`font-mono text-xs tracking-wide uppercase ${hasImage ? "text-white/80" : "text-accent"}`}>
            {edition.configName}
          </span>
          <span className={`font-mono text-xs tracking-wide ${hasImage ? "text-white/50" : "text-ink-faint"}`}>
            {formatPubDate(edition.publishedAt)}
          </span>
        </div>

        {/* Lead story */}
        <div className="mt-auto pt-4">
          {edition.lead && (
            <>
              <div className={`font-mono text-xs tracking-wide mb-2 ${hasImage ? "text-white/60" : "text-ink-faint"}`}>
                {edition.lead.sourceName}
              </div>
              <h3 className={`font-serif text-xl md:text-2xl font-medium tracking-tight leading-snug mb-3 ${hasImage ? "text-white" : "text-ink"}`}>
                {edition.lead.title}
              </h3>
            </>
          )}

          {/* Sections as tags */}
          {edition.sections.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {edition.sections.map((s) => (
                <span
                  key={s.focusName}
                  className={`text-xs px-2 py-0.5 rounded-full ${hasImage ? "bg-white/15 text-white/80" : "bg-surface-sunken text-ink-tertiary"}`}
                >
                  {s.focusName}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className={`font-mono text-xs tracking-wide flex items-center gap-3 ${hasImage ? "text-white/50" : "text-ink-faint"}`}>
            <span>{edition.articleCount} articles</span>
            {edition.totalReadingMinutes != null && (
              <>
                <span className={hasImage ? "text-white/30" : "text-ink-faint"}>·</span>
                <span>{edition.totalReadingMinutes} min</span>
              </>
            )}
            <span className={hasImage ? "text-white/30" : "text-ink-faint"}>·</span>
            <span>{edition.sections.length} sections</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

/* ---------- Highlight teaser (secondary editions) ---------- */

const EditionTeaser = ({ edition }: { edition: HomeEdition }): React.ReactElement => (
  <Link
    to="/editions/$configId/issues/$editionId"
    params={{ configId: edition.editionConfigId, editionId: edition.id }}
    className="group block py-4 border-t border-border hover:border-accent transition-colors duration-fast"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs tracking-wide text-accent uppercase mb-1.5">
          {edition.configName} · {formatPubDate(edition.publishedAt)}
        </div>
        <div className="font-serif text-lg font-medium tracking-tight text-ink group-hover:text-accent transition-colors duration-fast leading-snug">
          {edition.title}
        </div>
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
  </Link>
);

/* ---------- Configured home (the newsstand) ---------- */

const ConfiguredHome = ({ data }: { data: HomeData }): React.ReactElement => {
  const { editions, configs } = data;

  // The first edition gets the full cover card treatment
  const featured = editions[0];
  const rest = editions.slice(1);

  return (
    <SlideIn from="up" distance={12}>
      <Masthead />

      {editions.length > 0 ? (
        <div>
          <div className="mb-6">
            <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">
              Your reading list
            </h1>
            <p className="text-sm text-ink-tertiary">
              {editions.length === 1
                ? "One edition waiting."
                : `${editions.length} editions waiting.`}
            </p>
          </div>

          {/* Featured: full cover card */}
          {featured && (
            <StaggerList>
              <StaggerItem>
                <CoverCard edition={featured} />
              </StaggerItem>
            </StaggerList>
          )}

          {/* Remaining editions: compact teasers */}
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

      {/* Quick links */}
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
            className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast"
          >
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

  const isFullyConfigured = data.sourcesCount > 0 && data.focusesCount > 0 && data.configs.length > 0;

  if (!isFullyConfigured) {
    return <SetupGuide data={data} />;
  }

  return <ConfiguredHome data={data} />;
};

const Route = createFileRoute("/")({
  component: HomePage,
});

export { Route };
