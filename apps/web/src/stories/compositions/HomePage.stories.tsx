import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../components/button.tsx";

/* ── Mock data ────────────────────────────────────────────────────── */

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

type EditionConfigSummary = {
  id: string;
  name: string;
  icon: string | null;
};

const now = Date.now();

const sampleConfigs: EditionConfigSummary[] = [
  { id: "cfg-1", name: "Morning Brief", icon: "sun" },
  { id: "cfg-2", name: "Deep Reads", icon: "book-open" },
];

const sampleEditions: EditionSummary[] = [
  {
    id: "ed-1",
    editionConfigId: "cfg-1",
    title: "The Week AI Went Mainstream",
    totalReadingMinutes: 14,
    articleCount: 8,
    readAt: null,
    publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    configName: "Morning Brief",
  },
  {
    id: "ed-2",
    editionConfigId: "cfg-2",
    title: "On Finite Feeds and Calm Software",
    totalReadingMinutes: 34,
    articleCount: 12,
    readAt: null,
    publishedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
    configName: "Deep Reads",
  },
  {
    id: "ed-3",
    editionConfigId: "cfg-1",
    title: "Europe's Data Sovereignty Push",
    totalReadingMinutes: 11,
    articleCount: 6,
    readAt: null,
    publishedAt: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
    configName: "Morning Brief",
  },
];

/* ── Presentational components (decoupled from router) ──────────── */

const Masthead = ({ date }: { date?: string }): React.ReactElement => {
  const displayDate = date ?? new Date().toLocaleDateString("en-GB", {
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
          {displayDate}
        </span>
      </div>
      <div className="h-px bg-border-strong" />
    </div>
  );
};

const ArrowIcon = (): React.ReactElement => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5.5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
  </svg>
);

const EditionCardStatic = ({ edition }: { edition: EditionSummary }): React.ReactElement => {
  const pubDate = new Date(edition.publishedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="group block py-5 border-t border-border hover:border-accent transition-colors duration-fast cursor-pointer">
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
    </div>
  );
};

type SetupStepStaticProps = {
  number: number;
  title: string;
  description: string;
  done: boolean;
  actionLabel: string;
};

const SetupStepStatic = ({ number, title, description, done, actionLabel }: SetupStepStaticProps): React.ReactElement => (
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
          <div className="mt-4">
            <Button variant="primary" size="sm">{actionLabel}</Button>
          </div>
        )}
      </div>
    </div>
  </div>
);

const QuickLinks = ({ configs }: { configs: EditionConfigSummary[] }): React.ReactElement => (
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
        className="flex items-center gap-1.5 font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
      >
        {cfg.name}
      </span>
    ))}
  </div>
);

/* ── Page shells (simulate AppShell content area) ─────────────── */

const ContentShell = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <div className="min-h-dvh bg-surface">
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      {children}
    </div>
  </div>
);

/* ── Stories ───────────────────────────────────────────────────── */

const meta: Meta = {
  title: "Design System/Compositions/Home Page",
  parameters: { layout: "fullscreen" },
};

type Story = StoryObj;

/* Fresh user — no setup done yet */
const FreshSetup: Story = {
  render: () => (
    <ContentShell>
      <Masthead date="Wednesday, 11 March 2026" />

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-3">
          Getting started
        </h1>
        <p className="text-sm text-ink-secondary leading-relaxed">
          A finite, curated reading experience. Set up your sources, define your interests, and create your first edition — a magazine built just for you.
        </p>
      </div>

      <div>
        <SetupStepStatic
          number={1}
          title="Add sources"
          description="Subscribe to RSS feeds and podcasts. These are the raw ingredients for your editions."
          done={false}
          actionLabel="Add your first source"
        />
        <SetupStepStatic
          number={2}
          title="Create focuses"
          description="Define topic areas like Technology, Science, or Local News. Articles are automatically classified into your focuses."
          done={false}
          actionLabel="Create a focus"
        />
        <SetupStepStatic
          number={3}
          title="Create an edition"
          description="Build a scheduled, finite digest from your focuses. Set time budgets, pick sections, and read on your terms."
          done={false}
          actionLabel="Create your first edition"
        />
        <div className="h-px bg-border" />
      </div>
    </ContentShell>
  ),
};

/* Partially set up — sources done, focuses and edition remain */
const PartialSetup: Story = {
  render: () => (
    <ContentShell>
      <Masthead date="Wednesday, 11 March 2026" />

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-3">
          Getting started
        </h1>
        <p className="text-sm text-ink-secondary leading-relaxed">
          A finite, curated reading experience. Set up your sources, define your interests, and create your first edition — a magazine built just for you.
        </p>
      </div>

      <div>
        <SetupStepStatic
          number={1}
          title="Add sources"
          description="Subscribe to RSS feeds and podcasts. These are the raw ingredients for your editions."
          done={true}
          actionLabel="Add your first source"
        />
        <SetupStepStatic
          number={2}
          title="Create focuses"
          description="Define topic areas like Technology, Science, or Local News. Articles are automatically classified into your focuses."
          done={false}
          actionLabel="Create a focus"
        />
        <SetupStepStatic
          number={3}
          title="Create an edition"
          description="Build a scheduled, finite digest from your focuses. Set time budgets, pick sections, and read on your terms."
          done={false}
          actionLabel="Create your first edition"
        />
        <div className="h-px bg-border" />
      </div>

      <div className="mt-6">
        <span className="font-mono text-xs tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer">
          Browse all articles →
        </span>
      </div>
    </ContentShell>
  ),
};

/* Configured with unread editions */
const WithUnreadEditions: Story = {
  render: () => (
    <ContentShell>
      <Masthead date="Wednesday, 11 March 2026" />

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">
          Your reading list
        </h1>
        <p className="text-sm text-ink-tertiary">
          3 editions waiting.
        </p>
      </div>

      <div className="flex flex-col">
        {sampleEditions.map((edition) => (
          <EditionCardStatic key={edition.id} edition={edition} />
        ))}
      </div>
      <div className="h-px bg-border" />

      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

/* Single unread edition */
const SingleEdition: Story = {
  render: () => (
    <ContentShell>
      <Masthead date="Wednesday, 11 March 2026" />

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink mb-2">
          Your reading list
        </h1>
        <p className="text-sm text-ink-tertiary">
          One edition waiting.
        </p>
      </div>

      <div className="flex flex-col">
        <EditionCardStatic edition={sampleEditions[0]!} />
      </div>
      <div className="h-px bg-border" />

      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

/* All caught up — no unread editions */
const AllRead: Story = {
  render: () => (
    <ContentShell>
      <Masthead date="Wednesday, 11 March 2026" />

      <div className="py-12 text-center">
        <div className="text-4xl text-accent/20 mb-4 select-none" aria-hidden="true">~</div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-ink mb-2">
          All read
        </h1>
        <p className="text-sm text-ink-tertiary leading-relaxed">
          You're up to date. New editions will appear here when they're generated.
        </p>
      </div>

      <QuickLinks configs={sampleConfigs} />
    </ContentShell>
  ),
};

export default meta;
export { FreshSetup, PartialSetup, WithUnreadEditions, SingleEdition, AllRead };
