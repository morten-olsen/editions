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

      // Fetch editions for each config, collect unread ones
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

/* ---------- Setup guide (new users) ---------- */

type SetupStepProps = {
  number: number;
  title: string;
  description: string;
  done: boolean;
  href: string;
  actionLabel: string;
};

const SetupStep = ({ number, title, description, done, href, actionLabel }: SetupStepProps): React.ReactElement => (
  <div className={`flex items-start gap-4 p-5 rounded-lg border transition-colors duration-fast ${done ? "border-border bg-surface" : "border-accent/30 bg-accent-subtle/30"}`}>
    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${done ? "bg-accent text-white" : "bg-surface-sunken text-ink-tertiary border border-border"}`}>
      {done ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
        </svg>
      ) : (
        number
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className={`text-sm font-medium ${done ? "text-ink-secondary" : "text-ink"}`}>{title}</div>
      <div className="text-xs text-ink-tertiary mt-0.5 leading-relaxed">{description}</div>
      {!done && (
        <Link to={href} className="inline-block mt-3">
          <Button variant="primary" size="sm">{actionLabel}</Button>
        </Link>
      )}
    </div>
  </div>
);

const SetupGuide = ({ data }: { data: HomeData }): React.ReactElement => {
  const hasSources = data.sources.length > 0;
  const hasFocuses = data.focuses.length > 0;
  const hasEditions = data.configs.length > 0;

  return (
    <SlideIn from="up" distance={12}>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-3">
            Welcome to Editions
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed max-w-md mx-auto">
            A finite, curated reading experience. Set up your sources, define your interests, and create your first edition — a magazine built just for you.
          </p>
        </div>

        <div className="flex flex-col gap-3">
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
        </div>

        {hasSources && (
          <FadeIn>
            <div className="mt-8 text-center">
              <Link to="/feed" className="text-xs text-ink-tertiary hover:text-ink transition-colors duration-fast">
                Browse all articles
              </Link>
            </div>
          </FadeIn>
        )}
      </div>
    </SlideIn>
  );
};

/* ---------- Edition card ---------- */

type EditionCardProps = {
  edition: EditionSummary;
  configId: string;
};

const EditionCard = ({ edition, configId }: EditionCardProps): React.ReactElement => (
  <Link
    to="/editions/$configId/issues/$editionId"
    params={{ configId, editionId: edition.id }}
    className="group block p-5 rounded-lg border border-border hover:border-accent/40 bg-surface hover:bg-accent-subtle/20 transition-colors duration-fast"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ink-tertiary mb-1">{edition.configName}</div>
        <div className="font-serif text-lg font-medium tracking-tight text-ink group-hover:text-accent transition-colors duration-fast">
          {edition.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-tertiary mt-1.5">
          <span>{edition.articleCount} articles</span>
          {edition.totalReadingMinutes && (
            <>
              <span className="text-ink-faint">·</span>
              <span>{edition.totalReadingMinutes} min</span>
            </>
          )}
          <span className="text-ink-faint">·</span>
          <span>{new Date(edition.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        </div>
      </div>
      <div className="shrink-0 mt-1">
        <span className="w-2 h-2 rounded-full bg-accent block" />
      </div>
    </div>
  </Link>
);

/* ---------- Configured home ---------- */

const ConfiguredHome = ({ data }: { data: HomeData }): React.ReactElement => {
  const { unreadEditions, configs } = data;

  return (
    <SlideIn from="up" distance={12}>
      <div className="max-w-2xl">
        {/* Unread editions */}
        {unreadEditions.length > 0 ? (
          <div className="mb-10">
            <h2 className="font-serif text-2xl font-medium tracking-tight text-ink mb-1">
              Ready to read
            </h2>
            <p className="text-sm text-ink-tertiary mb-6">
              {unreadEditions.length === 1
                ? "You have one unread edition waiting."
                : `You have ${unreadEditions.length} unread editions waiting.`}
            </p>
            <StaggerList className="flex flex-col gap-3">
              {unreadEditions.map((edition) => (
                <StaggerItem key={edition.id}>
                  <EditionCard edition={edition} configId={edition.editionConfigId} />
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        ) : (
          <div className="mb-10">
            <h2 className="font-serif text-2xl font-medium tracking-tight text-ink mb-1">
              You're all caught up
            </h2>
            <p className="text-sm text-ink-tertiary">
              No unread editions. New issues will appear here when they're generated.
            </p>
          </div>
        )}

        {/* Quick links */}
        <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-border">
          <Link to="/feed">
            <Button variant="ghost" size="sm">Browse feed</Button>
          </Link>
          <Link to="/bookmarks">
            <Button variant="ghost" size="sm">Bookmarks</Button>
          </Link>
          {configs.map((cfg) => (
            <Link key={cfg.id} to="/editions/$configId" params={{ configId: cfg.id }}>
              <Button variant="ghost" size="sm">
                <EntityIcon icon={cfg.icon} fallback="newspaper" size={14} className="shrink-0 mr-1.5" />
                {cfg.name}
              </Button>
            </Link>
          ))}
        </div>
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

  // Show setup guide if they haven't completed all three steps
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
