/**
 * Showcase wrappers for guide pages. Each renders real app components
 * with mock data, hydrated via `client:visible` in MDX.
 */
import * as React from "react";
import { SourceCard } from "../../../web/src/components/source-card.tsx";
import { ArticleCard } from "../../../web/src/components/article-card.tsx";
import { VoteControls } from "../../../web/src/components/vote-controls.tsx";
import { Button } from "../../../web/src/components/button.tsx";
import { EditionSection } from "../../../web/src/components/edition-section.tsx";

/* ── Sources guide ──────────────────────────────────────────────── */

const ShowcaseSourceList = (): React.ReactElement => (
  <div className="grid gap-3 p-6">
    <SourceCard
      id="1"
      name="Ars Technica"
      url="https://feeds.arstechnica.com/arstechnica/index"
      lastFetchedAt="2026-03-11T09:15:00Z"
    />
    <SourceCard
      id="2"
      name="Nature"
      url="https://www.nature.com/nature.rss"
      lastFetchedAt="2026-03-11T08:42:00Z"
    />
    <SourceCard
      id="3"
      name="Software Unscripted"
      url="https://feeds.simplecast.com/software-unscripted"
      lastFetchedAt="2026-03-10T22:00:00Z"
    />
    <SourceCard
      id="4"
      name="Simon Willison's Weblog"
      url="https://simonwillison.net/atom/everything/"
      lastFetchedAt="2026-03-11T07:30:00Z"
    />
  </div>
);

const ShowcaseArticleCards = (): React.ReactElement => {
  const [vote, setVote] = React.useState<1 | -1 | null>(null);

  return (
    <div className="grid gap-3 p-6">
      <ArticleCard
        id="a1"
        title="The quiet revolution in reader design"
        sourceName="Ars Technica"
        author="Sarah Chen"
        summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span."
        publishedAt="2026-03-11T06:00:00Z"
        consumptionTimeSeconds={480}
        imageUrl="https://picsum.photos/seed/reader-card/400/300"
        vote={vote}
        onVote={setVote}
      />
      <ArticleCard
        id="a2"
        title="Building finite feeds: architecture for calm software"
        sourceName="Software Unscripted"
        sourceType="podcast"
        summary="A deep technical conversation about building reading software that respects attention."
        publishedAt="2026-03-10T14:00:00Z"
        consumptionTimeSeconds={2700}
        imageUrl="https://picsum.photos/seed/podcast-card/400/400"
        compact
      />
    </div>
  );
};

/* ── Focuses guide ──────────────────────────────────────────────── */

const ShowcaseFocusBadges = (): React.ReactElement => (
  <div className="flex flex-wrap gap-2 justify-center py-8 px-6">
    {[
      "Technology",
      "Climate & Energy",
      "Science",
      "Machine Learning Research",
      "Indie Web",
      "European Policy",
    ].map((name) => (
      <span
        key={name}
        className="inline-flex items-center text-sm px-4 py-2 rounded-full border border-border bg-surface text-ink-secondary font-serif"
      >
        {name}
      </span>
    ))}
  </div>
);

const ShowcaseClassification = (): React.ReactElement => (
  <div className="p-6">
    <div className="text-xs font-mono tracking-wide text-ink-faint mb-4">Classification result</div>
    <div className="grid gap-3">
      {[
        { focus: "Technology", score: 0.94, match: true },
        { focus: "Climate & Energy", score: 0.12, match: false },
        { focus: "Science", score: 0.67, match: true },
        { focus: "European Policy", score: 0.03, match: false },
      ].map((r) => (
        <div key={r.focus} className="flex items-center gap-3">
          <span className="font-serif text-sm text-ink w-40 shrink-0">{r.focus}</span>
          <div className="flex-1 h-2 rounded-full bg-surface-sunken overflow-hidden">
            <div
              className={`h-full rounded-full ${r.match ? "bg-accent" : "bg-ink-faint/30"}`}
              style={{ width: `${r.score * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-ink-tertiary w-10 text-right tabular-nums">
            {(r.score * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
    <div className="mt-4 text-xs text-ink-faint">
      Article: "The quiet revolution in reader design" — Ars Technica
    </div>
  </div>
);

const ShowcaseFocusVoting = (): React.ReactElement => {
  const [globalVote, setGlobalVote] = React.useState<1 | -1 | null>(null);
  const [focusVote, setFocusVote] = React.useState<1 | -1 | null>(null);

  return (
    <div className="p-6 grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-ink">Global feed</div>
          <div className="text-xs text-ink-tertiary">Is this a good article?</div>
        </div>
        <VoteControls value={globalVote} onVote={setGlobalVote} />
      </div>
      <div className="border-t border-border" />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-ink">Technology focus</div>
          <div className="text-xs text-ink-tertiary">Does this belong here?</div>
        </div>
        <VoteControls value={focusVote} onVote={setFocusVote} label="Relevance" />
      </div>
    </div>
  );
};

/* ── Editions guide ─────────────────────────────────────────────── */

const ShowcaseEditionConfig = (): React.ReactElement => (
  <div className="p-6">
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="font-serif text-lg text-ink">Morning Briefing</div>
        <div className="text-xs font-mono text-ink-tertiary">Daily at 7:00 AM · last 24 hours</div>
      </div>
      <Button variant="primary" size="sm">Generate</Button>
    </div>
    <div className="grid gap-3">
      {[
        { focus: "Technology", budget: "5 articles", priority: "High" },
        { focus: "Science", budget: "15 min reading", priority: "Normal" },
        { focus: "Indie Web", budget: "3 articles", priority: "Normal" },
      ].map((s) => (
        <div
          key={s.focus}
          className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border bg-surface"
        >
          <span className="font-serif text-sm text-ink">{s.focus}</span>
          <div className="flex items-center gap-4 text-xs font-mono text-ink-tertiary">
            <span>{s.budget}</span>
            <span className={s.priority === "High" ? "text-accent" : ""}>{s.priority}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ShowcaseEditionSection = (): React.ReactElement => (
  <div className="p-4">
    <EditionSection
      focusName="Technology"
      index={0}
      articles={[
        {
          id: "e1",
          title: "The quiet revolution in reader design",
          sourceName: "Ars Technica",
          author: "Sarah Chen",
          summary: "How a new generation of reading apps is rethinking the relationship between content and interface.",
          publishedAt: "2026-03-11T06:00:00Z",
          consumptionTimeSeconds: 480,
          imageUrl: "https://picsum.photos/seed/reader-card/400/300",
        },
        {
          id: "e2",
          title: "TypeScript 6.0 introduces pattern matching",
          sourceName: "Hacker News",
          summary: "The long-awaited pattern matching RFC lands in TypeScript.",
          publishedAt: "2026-03-10T12:00:00Z",
          consumptionTimeSeconds: 180,
        },
        {
          id: "e3",
          title: "Why SQLite is the database you didn't know you needed",
          sourceName: "Hacker News",
          author: "Richard Hipp",
          summary: "A deep dive into why embedded databases are making a comeback.",
          publishedAt: "2026-03-09T18:00:00Z",
          consumptionTimeSeconds: 720,
          imageUrl: "https://picsum.photos/seed/sqlite-card/400/300",
        },
      ]}
    />
  </div>
);

/* ── Exports ────────────────────────────────────────────────────── */

export {
  ShowcaseSourceList,
  ShowcaseArticleCards,
  ShowcaseFocusBadges,
  ShowcaseClassification,
  ShowcaseFocusVoting,
  ShowcaseEditionConfig,
  ShowcaseEditionSection,
};
