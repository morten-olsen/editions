/**
 * An interactive magazine demo built on the real reader. Articles are typeset
 * into pages exactly as they are in the app, so a visitor turning pages here
 * is experiencing the product rather than a mock-up of it.
 *
 * The demo does not take the keyboard — arrow keys belong to the page it is
 * embedded in.
 */
import * as React from 'react';

import { MagazinePage } from '../../../web/src/components/magazine/magazine.layout.tsx';
import {
  articleContent,
  bodyLayout,
  formatFor,
  openerLayout,
  PagedSurface,
  useArticlePagination,
  useElementSize,
  useFontsReady,
} from '../../../web/src/components/reader/reader.ts';
import type { ArticleInput, Sheet } from '../../../web/src/components/reader/reader.ts';

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
          'linear-gradient(to bottom, rgba(26,32,28,0.9) 0%, rgba(26,32,28,0.5) 40%, rgba(26,32,28,0.92) 100%)',
      }}
    >
      <div className="flex items-baseline justify-between pb-3 mb-6 border-b border-white/20">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono tracking-wide uppercase text-white/90">Editions</span>
          <span className="text-xs text-white/40">/</span>
          <span className="text-xs tracking-wide uppercase text-white/70">Morning Briefing</span>
        </div>
        <span className="text-xs font-mono tracking-wide text-white/60">Tuesday, 11 March 2026</span>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="text-xs font-mono tracking-wide mb-4 text-white/70">Ars Technica</div>
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
            <div className="text-[10px] text-white/50 font-mono mb-1">Nature</div>
            <div className="text-xs font-serif text-white/85 leading-snug">
              JWST captures the universe's first galaxies
            </div>
          </div>
          <div className="max-w-48">
            <div className="text-[10px] text-white/50 font-mono mb-1">The Guardian</div>
            <div className="text-xs font-serif text-white/85 leading-snug">Europe's new data sovereignty framework</div>
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
        <div className="text-xs font-mono tracking-wide text-accent uppercase mb-2">Contents</div>
        <h2 className="font-serif text-3xl tracking-tight text-ink">Morning Briefing</h2>
      </div>

      <div className="grid gap-8">
        {[
          {
            num: '01',
            name: 'Technology',
            articles: [
              { title: 'The quiet revolution in reader design', source: 'Ars Technica', time: '8m' },
              { title: 'TypeScript 6.0 introduces pattern matching', source: 'Hacker News', time: '3m' },
            ],
          },
          {
            num: '02',
            name: 'Science',
            articles: [
              { title: "JWST captures the universe's first galaxies", source: 'Nature', time: '6m' },
              { title: 'Building finite feeds (podcast)', source: 'Software Unscripted', time: '45m' },
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
                <div key={a.title} className="flex items-baseline gap-3">
                  <span className="font-serif text-sm text-ink-secondary leading-snug flex-1">{a.title}</span>
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
        {String(index).padStart(2, '0')}
      </div>
      <h2 className="font-serif text-3xl md:text-5xl tracking-tight text-ink mb-3">{name}</h2>
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
      <h2 className="font-serif text-2xl tracking-tight text-ink mb-2">You're all caught up</h2>
      <div className="text-sm text-ink-tertiary mb-8">4 articles · 12 minutes well spent</div>
      <div className="text-xs font-mono tracking-wide text-ink-faint">End of Morning Briefing</div>
    </div>
  </MagazinePage>
);

/* ── Demo articles ───────────────────────────────────────────────── */

const ARTICLES: (ArticleInput & { id: string })[] = [
  {
    id: 'reader-design',
    title: 'The quiet revolution in reader design',
    sourceName: 'Ars Technica',
    author: 'Sarah Chen',
    publishedAt: '2026-03-11',
    consumptionTimeSeconds: 480,
    imageUrl: 'https://picsum.photos/seed/reader-mag/1200/750',
    summary:
      "How a new generation of reading apps is rethinking the relationship between content, interface and the reader's attention.",
    content: `For the better part of a decade the dominant paradigm in digital reading has been the infinite scroll. A growing number of designers are questioning whether the stream ever served the reader at all.

The thesis is simple: reading should end. A newspaper has a back page. A magazine has a final spread. Even a book, however long, eventually runs out of pages. Digital reading abandoned that constraint somewhere around 2012, and we have been paying for it since.

## Finite by design

A new wave of tools is pushing back. Curated collections that respect the reader's time: you open them, you read, and at some point the app tells you that you are done.

> Without infinite scroll, every article competes for a limited number of slots. Curation becomes the product, not the firehose.

The design implications are considerable. The interface can finally be built for reading rather than for engagement, retention or time on screen.`,
  },
  {
    id: 'pattern-matching',
    title: 'TypeScript 6.0 introduces pattern matching',
    sourceName: 'Hacker News',
    author: 'Anders Hejlsberg',
    publishedAt: '2026-03-10',
    consumptionTimeSeconds: 180,
    imageUrl: 'https://picsum.photos/seed/typescript-mag/1200/675',
    summary: 'The long-awaited pattern matching RFC lands, bringing exhaustive checks to a new level.',
    content: `Pattern matching has been the most requested TypeScript feature for half a decade. With version 6.0 it is finally real, and the implementation goes further than most expected.

The new \`match\` expression supports literal patterns, type narrowing, array destructuring and guard clauses. Combined with discriminated unions it makes exhaustive state handling nearly effortless, and early feedback suggests it removes whole categories of switch-statement bugs.`,
  },
  {
    id: 'jwst',
    title: "JWST captures the universe's first galaxies",
    sourceName: 'Nature',
    author: 'Dr Priya Natarajan',
    publishedAt: '2026-03-09',
    consumptionTimeSeconds: 360,
    imageUrl: 'https://picsum.photos/seed/jwst-mag/1200/750',
    summary:
      'New observations reveal the earliest galaxies ever seen, forming just 300 million years after the Big Bang.',
    content: `The images show structures that challenge existing models of galaxy formation. Several of the newly discovered galaxies appear far more massive and more organised than theory predicts for objects so young.

"We expected to see small, irregular blobs," said Dr Priya Natarajan. "Instead we are seeing disk-like structures with clear spiral arms. Our models will need significant revision."

The findings bear directly on dark matter research: the early formation of large galaxies places new constraints on the timeline of cosmic structure assembly.`,
  },
];

/* ── Interactive magazine ────────────────────────────────────────── */

const LAYOUTS = [openerLayout, bodyLayout];

const TYPESET = ARTICLES.map((article) => ({ id: article.id, content: articleContent(article) }));

const SECTIONS = [
  { name: 'Technology', count: 2, minutes: 11, articles: ['reader-design', 'pattern-matching'] },
  { name: 'Science', count: 1, minutes: 6, articles: ['jwst'] },
];

const InteractiveMagazine = (): React.ReactElement => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);
  const fontsReady = useFontsReady();
  const format = React.useMemo(() => formatFor(size), [size]);

  const typeset = useArticlePagination({
    articles: TYPESET,
    layouts: LAYOUTS,
    page: format.page,
    enabled: fontsReady,
  });

  const [page, setPage] = React.useState(0);

  const sheets = React.useMemo<Sheet[]>(() => {
    const built: Sheet[] = [
      { key: 'cover', node: <CoverPage onStart={() => setPage(1)} /> },
      { key: 'toc', node: <TocPage /> },
    ];

    SECTIONS.forEach((section, index) => {
      built.push({
        key: `section-${section.name}`,
        node: <SectionPage name={section.name} index={index + 1} count={section.count} minutes={section.minutes} />,
      });

      for (const id of section.articles) {
        (typeset.get(id) ?? []).forEach((result, position) => {
          built.push({ key: `${id}-${position}`, element: result.el });
        });
      }
    });

    built.push({ key: 'finale', node: <FinalePage /> });
    return built;
  }, [typeset]);

  return (
    <div className="magazine-showcase">
      <PagedSurface
        containerRef={containerRef}
        format={format}
        sheets={sheets}
        index={Math.min(page, Math.max(sheets.length - 1, 0))}
        onTurn={setPage}
        coverAlone
        keyboard={false}
        className="rounded-xl border border-border"
      />
    </div>
  );
};

export { InteractiveMagazine };
