/**
 * An interactive magazine demo using the real MagazineLayout component.
 * Visitors can navigate through a mini edition to experience the reading flow.
 */
import * as React from "react";
import { MagazineLayout } from "../../../web/src/components/magazine/magazine.layout.tsx";
import { MagazinePage } from "../../../web/src/components/magazine/magazine.layout.tsx";
import { MagazineArticle } from "../../../web/src/components/magazine/magazine.article.tsx";

/* ── Mock pages ──────────────────────────────────────────────────── */

const CoverPage = ({ onStart }: { onStart?: () => void }): React.ReactElement => (
  <MagazinePage className="relative justify-between !p-0 overflow-hidden">
    {/* Background image */}
    <img
      src="https://picsum.photos/seed/cover-editions/1200/800"
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
    />
    <div
      className="relative z-10 flex flex-col justify-between px-6 py-10 md:px-10 text-white min-h-[inherit]"
      style={{
        background:
          "linear-gradient(to bottom, rgba(26,32,28,0.9) 0%, rgba(26,32,28,0.5) 40%, rgba(26,32,28,0.92) 100%)",
      }}
    >
      <div className="flex items-baseline justify-between pb-3 mb-6 border-b border-white/20">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono tracking-wide uppercase text-white/90">
            Editions
          </span>
          <span className="text-xs text-white/40">/</span>
          <span className="text-xs tracking-wide uppercase text-white/70">
            Morning Briefing
          </span>
        </div>
        <span className="text-xs font-mono tracking-wide text-white/60">
          Tuesday, 11 March 2026
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="text-xs font-mono tracking-wide mb-4 text-white/70">
          Ars Technica
        </div>
        <h2 className="font-serif text-4xl md:text-5xl lg:text-[4rem] leading-none tracking-tight text-white mb-4">
          The quiet revolution in reader design
        </h2>
        <div className="text-sm text-white/60">8 min read</div>

        <button
          onClick={onStart}
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium tracking-wide px-6 py-3 rounded-full transition-all duration-normal self-start cursor-pointer bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm border border-white/20"
        >
          Start reading
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="pt-4 mt-6 border-t border-white/20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex gap-6">
          <div className="max-w-48">
            <div className="text-[10px] text-white/50 font-mono mb-1">
              Nature
            </div>
            <div className="text-xs font-serif text-white/85 leading-snug">
              JWST captures the universe's first galaxies
            </div>
          </div>
          <div className="max-w-48">
            <div className="text-[10px] text-white/50 font-mono mb-1">
              The Guardian
            </div>
            <div className="text-xs font-serif text-white/85 leading-snug">
              Europe's new data sovereignty framework
            </div>
          </div>
        </div>
        <div className="flex gap-4 text-[10px] font-mono tracking-wide text-white/50">
          <span>6 articles</span>
          <span>2 sections</span>
          <span>12 min</span>
        </div>
      </div>
    </div>
  </MagazinePage>
);

const TocPage = (): React.ReactElement => (
  <MagazinePage>
    <div className="max-w-wide mx-auto w-full">
      <div className="mb-10">
        <div className="text-xs font-mono tracking-wide text-accent uppercase mb-2">
          Contents
        </div>
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          Morning Briefing
        </h2>
      </div>

      <div className="grid gap-8">
        {[
          {
            num: "01",
            name: "Technology",
            articles: [
              { title: "The quiet revolution in reader design", source: "Ars Technica", time: "8m" },
              { title: "TypeScript 6.0 introduces pattern matching", source: "Hacker News", time: "3m" },
            ],
          },
          {
            num: "02",
            name: "Science",
            articles: [
              { title: "JWST captures the universe's first galaxies", source: "Nature", time: "6m" },
              { title: "Building finite feeds (podcast)", source: "Software Unscripted", time: "45m" },
            ],
          },
        ].map((s) => (
          <div key={s.num}>
            <div className="flex items-baseline gap-3 mb-3 border-b border-border pb-2">
              <span className="text-xl font-mono text-accent">{s.num}</span>
              <span className="font-serif text-lg text-ink">{s.name}</span>
            </div>
            <div className="grid gap-1.5 pl-8 border-l border-border">
              {s.articles.map((a) => (
                <div
                  key={a.title}
                  className="flex items-baseline gap-3"
                >
                  <span className="font-serif text-sm text-ink-secondary leading-snug flex-1">
                    {a.title}
                  </span>
                  <span className="flex-shrink-0 border-b border-dotted border-ink-faint/40 min-w-6 translate-y-[-2px]" />
                  <span className="text-xs font-mono text-ink-faint shrink-0">
                    {a.source} · {a.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </MagazinePage>
);

const SectionPage = ({
  name,
  index,
  count,
  minutes,
}: {
  name: string;
  index: number;
  count: number;
  minutes: number;
}): React.ReactElement => (
  <MagazinePage className="items-center text-center">
    <div className="max-w-content mx-auto relative">
      <div className="text-[6rem] md:text-[10rem] font-mono leading-none text-accent/15 select-none mb-[-0.5rem]">
        {String(index).padStart(2, "0")}
      </div>
      <h2 className="font-serif text-3xl md:text-5xl tracking-tight text-ink mb-3">
        {name}
      </h2>
      <div className="text-xs font-mono tracking-wide text-ink-tertiary">
        {count} articles · {minutes} min
      </div>
      <div className="w-12 h-px bg-accent mx-auto mt-6" />
    </div>
  </MagazinePage>
);

const FinalePage = (): React.ReactElement => (
  <MagazinePage className="items-center text-center">
    <div className="max-w-prose mx-auto">
      <div className="text-5xl text-accent/20 mb-6 select-none">~</div>
      <h2 className="font-serif text-2xl tracking-tight text-ink mb-2">
        You're all caught up
      </h2>
      <div className="text-sm text-ink-tertiary mb-8">
        4 articles · 12 minutes well spent
      </div>
      <div className="text-xs font-mono tracking-wide text-ink-faint">
        End of Morning Briefing
      </div>
    </div>
  </MagazinePage>
);

/* ── Interactive magazine ────────────────────────────────────────── */

const InteractiveMagazine = (): React.ReactElement => {
  const [page, setPage] = React.useState(0);

  const toc = [
    {
      sectionName: "Technology",
      sectionPage: 2,
      articles: [
        { title: "The quiet revolution in reader design", page: 3 },
        { title: "TypeScript 6.0 introduces pattern matching", page: 4 },
      ],
    },
    {
      sectionName: "Science",
      sectionPage: 5,
      articles: [
        { title: "JWST captures the universe's first galaxies", page: 6 },
        { title: "Building finite feeds (podcast)", page: 7 },
      ],
    },
  ];

  return (
    <div className="magazine-showcase">
      <MagazineLayout page={page} onPageChange={setPage} toc={toc}>
        <CoverPage onStart={() => setPage(1)} />
        <TocPage />
        <SectionPage name="Technology" index={1} count={2} minutes={11} />
        {/* Hero layout — position 0 */}
        <MagazineArticle
          title="The quiet revolution in reader design"
          sourceName="Ars Technica"
          author="Sarah Chen"
          publishedAt="2026-03-11"
          consumptionTimeSeconds={480}
          imageUrl="https://picsum.photos/seed/reader-mag/800/600"
          positionInSection={0}
          summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span. The old paradigm of infinite scroll is giving way to something more intentional."
          content="<p>For the better part of a decade, the dominant paradigm in digital reading has been the infinite scroll. But a growing number of designers are questioning whether the stream ever served the reader at all.</p><p>The thesis is simple: reading should end. A newspaper has a back page. A magazine has a final spread. Even a book, no matter how long, eventually runs out of pages. Digital reading abandoned this constraint somewhere around 2012, and we've been paying for it ever since.</p><p>A new wave of tools is pushing back. Apps like Editions, Readwise Reader, and Matter are experimenting with finite feeds — curated collections that respect the reader's time. You open them, you read, and at some point the app tells you: you're done. Go do something else.</p><p>The design implications are profound. Without infinite scroll, every article competes for a limited number of slots. Curation becomes the product, not the firehose. And the interface can finally be designed for reading — not for engagement, retention, or time-on-screen.</p>"
        />
        {/* Editorial layout — position 1 */}
        <MagazineArticle
          title="TypeScript 6.0 introduces pattern matching"
          sourceName="Hacker News"
          author="Anders Hejlsberg"
          publishedAt="2026-03-10"
          consumptionTimeSeconds={180}
          imageUrl="https://picsum.photos/seed/typescript-mag/800/450"
          positionInSection={1}
          summary="The long-awaited pattern matching RFC lands in TypeScript, bringing exhaustive checks and destructuring to a new level."
          content="<p>Pattern matching has been the most requested TypeScript feature for half a decade. With version 6.0, it's finally real — and the implementation goes further than most expected.</p><p>The new match expression supports literal patterns, type narrowing, array destructuring, and guard clauses. Combined with TypeScript's existing discriminated unions, it makes exhaustive state handling nearly effortless. Early feedback from beta testers suggests it eliminates entire categories of switch-statement bugs.</p>"
        />
        <SectionPage name="Science" index={2} count={2} minutes={51} />
        {/* Compact layout — position 2 */}
        <MagazineArticle
          title="JWST captures the universe's first galaxies"
          sourceName="Nature"
          author="Dr. Priya Natarajan"
          publishedAt="2026-03-09"
          consumptionTimeSeconds={360}
          imageUrl="https://picsum.photos/seed/jwst-mag/800/800"
          positionInSection={2}
          summary="New observations from the James Webb Space Telescope have revealed the earliest galaxies ever seen, forming just 300 million years after the Big Bang."
          content="<p>The images, released Thursday in a special Nature supplement, show structures that challenge existing models of galaxy formation. Several of the newly discovered galaxies appear far more massive and structured than theory predicts for objects just 300 million years after the Big Bang.</p><p>&quot;We expected to see small, irregular blobs,&quot; said Dr. Priya Natarajan of Yale. &quot;Instead we're seeing disk-like structures with clear spiral arms. Our models will need significant revision.&quot;</p><p>The findings have immediate implications for dark matter research, as the early formation of large galaxies places new constraints on the timeline of cosmic structure assembly.</p>"
        />
        {/* Podcast layout */}
        <MagazineArticle
          title="Building finite feeds: architecture for calm software"
          sourceName="Software Unscripted"
          publishedAt="2026-03-08"
          consumptionTimeSeconds={2700}
          imageUrl="https://picsum.photos/seed/podcast-cover/800/800"
          sourceType="podcast"
          summary="A conversation about designing software that respects the reader's time and attention. Why the infinite scroll failed, and what the alternative looks like."
        />
        <FinalePage />
      </MagazineLayout>
    </div>
  );
};

export { InteractiveMagazine };
