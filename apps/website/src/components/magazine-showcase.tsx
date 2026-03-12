/**
 * Wrapper components that render real app magazine components with mock data.
 * These are imported into Astro pages with `client:visible` for animations.
 */
import * as React from 'react';

import { MagazineCover } from '../../../web/src/components/magazine/magazine.cover.tsx';
import { MagazineSection } from '../../../web/src/components/magazine/magazine.section.tsx';
import { MagazineFinale } from '../../../web/src/components/magazine/magazine.finale.tsx';
import { MagazineToc } from '../../../web/src/components/magazine/magazine.toc.tsx';
import { MagazineArticle } from '../../../web/src/components/magazine/magazine.article.tsx';
import { MagazinePage } from '../../../web/src/components/magazine/magazine.layout.tsx';
import { Button } from '../../../web/src/components/button.tsx';
import { VoteControls } from '../../../web/src/components/vote-controls.tsx';

/* ── Showcase: Cover ─────────────────────────────────────────────── */

const ShowcaseCover = (): React.ReactElement => (
  <MagazinePage className="relative justify-between !min-h-0 !p-0 overflow-hidden">
    <div
      className="relative z-10 flex flex-col justify-between px-6 py-10 md:px-10 text-white min-h-[32rem]"
      style={{
        background:
          'linear-gradient(to bottom, rgba(26,32,28,0.85) 0%, rgba(26,32,28,0.5) 40%, rgba(26,32,28,0.9) 100%)',
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

      <div className="flex-1 flex flex-col justify-center max-w-wide">
        <div className="text-xs font-mono tracking-wide mb-4 text-white/70">Ars Technica</div>
        <h2 className="font-serif text-4xl md:text-5xl lg:text-[4rem] leading-none tracking-tight text-white mb-4">
          The quiet revolution in reader design
        </h2>
        <div className="text-sm text-white/60">8 min read</div>
        <div className="mt-6">
          <span className="inline-flex items-center gap-2 text-sm font-medium tracking-wide px-5 py-2.5 rounded-full bg-white/15 text-white border border-white/20">
            Start reading <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>

      <div className="pt-4 mt-6 border-t border-white/20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex gap-6">
          <div className="max-w-48">
            <div className="text-[10px] text-white/50 font-mono mb-1">Nature</div>
            <div className="text-xs font-serif text-white/85 leading-snug">
              JWST captures the universe's first galaxies in unprecedented detail
            </div>
          </div>
          <div className="max-w-48">
            <div className="text-[10px] text-white/50 font-mono mb-1">The Guardian</div>
            <div className="text-xs font-serif text-white/85 leading-snug">Europe's new data sovereignty framework</div>
          </div>
        </div>
        <div className="flex gap-4 text-[10px] font-mono tracking-wide text-white/50">
          <span>8 articles</span>
          <span>3 sections</span>
          <span>14 min</span>
        </div>
      </div>
    </div>
  </MagazinePage>
);

/* ── Showcase: Section divider ───────────────────────────────────── */

const ShowcaseSection = (): React.ReactElement => (
  <MagazinePage className="items-center text-center !min-h-0 !py-16">
    <div className="max-w-content mx-auto relative">
      <div className="text-[6rem] md:text-[8rem] font-mono leading-none text-accent/15 select-none mb-[-0.5rem]">
        01
      </div>
      <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-ink mb-3">Technology</h2>
      <div className="text-xs font-mono tracking-wide text-ink-tertiary">4 articles · 14 min</div>
      <div className="w-12 h-px bg-accent mx-auto mt-6" />
    </div>
  </MagazinePage>
);

/* ── Showcase: Finale ────────────────────────────────────────────── */

const ShowcaseFinale = (): React.ReactElement => (
  <MagazinePage className="items-center text-center !min-h-0 !py-16">
    <div className="max-w-prose mx-auto">
      <div className="text-5xl text-accent/20 mb-6 select-none">~</div>
      <h2 className="font-serif text-2xl tracking-tight text-ink mb-2">You're all caught up</h2>
      <div className="text-sm text-ink-tertiary mb-8">8 articles · 14 minutes well spent</div>
      <Button variant="primary" size="md" className="rounded-full px-6">
        Mark as read
      </Button>
      <div className="text-xs font-mono tracking-wide text-ink-faint mt-6">End of Morning Briefing</div>
    </div>
  </MagazinePage>
);

/* ── Showcase: Article (Hero layout) ─────────────────────────────── */

const ShowcaseArticleHero = (): React.ReactElement => (
  <MagazinePage className="!min-h-0 !py-12">
    <div className="max-w-wide mx-auto w-full grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
      <div>
        <div className="flex items-center gap-2 text-xs font-mono tracking-wide text-accent mb-3">
          <span>Ars Technica</span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-tertiary">11 March 2026</span>
        </div>
        <h3 className="font-serif text-2xl md:text-3xl tracking-tight leading-tight text-ink mb-4">
          The quiet revolution in reader design
        </h3>
        <p className="font-serif text-base leading-relaxed text-ink-secondary mb-4">
          For the better part of a decade, the dominant paradigm in digital reading has been the infinite scroll. But a
          growing number of designers are questioning whether the stream ever served the reader at all.
        </p>
        <div className="text-xs text-ink-tertiary">8 min read</div>
      </div>
      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-surface-sunken">
        <div className="w-full h-full bg-linear-to-br from-accent/10 to-accent/5 flex items-center justify-center">
          <span className="text-sm font-mono text-ink-faint">article image</span>
        </div>
      </div>
    </div>
  </MagazinePage>
);

/* ── Showcase: Article (Compact layout) ──────────────────────────── */

const ShowcaseArticleCompact = (): React.ReactElement => (
  <MagazinePage className="!min-h-0 !py-10">
    <div className="max-w-prose mx-auto w-full">
      <div className="text-xs font-mono tracking-wide text-accent mb-4 text-center">MIT Tech Review</div>
      <h3 className="font-serif text-2xl md:text-3xl tracking-tight leading-tight text-ink text-center mb-4">
        New battery chemistry promises 10x capacity
      </h3>
      <div className="w-10 h-px bg-border-strong mx-auto mb-4" />
      <p className="font-serif text-sm leading-relaxed text-ink-secondary text-center mb-3">
        Researchers at Stanford have demonstrated a solid-state lithium-sulfur cell that could make electric flight
        practical for short-haul routes.
      </p>
      <div className="flex items-center justify-center gap-3 text-xs text-ink-tertiary">
        <span>10 March 2026</span>
        <span className="text-ink-faint">·</span>
        <span>4 min read</span>
      </div>
    </div>
  </MagazinePage>
);

/* ── Showcase: Podcast ──────────────────────────────────────────── */

const ShowcasePodcast = (): React.ReactElement => {
  const bars = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39;
    const envelope = Math.sin(t * Math.PI);
    const variation = Math.sin(t * 11.3) * 0.3 + Math.sin(t * 7.1) * 0.2;
    return Math.max(4, Math.round(32 * envelope * (0.5 + variation)));
  });

  return (
    <MagazinePage className="items-center text-center !min-h-0 !py-10">
      <div className="max-w-prose mx-auto">
        <div className="flex items-center justify-center gap-2 text-xs font-mono tracking-wide text-accent mb-5">
          <span className="uppercase">Podcast</span>
          <span className="text-ink-faint">·</span>
          <span>Software Unscripted</span>
        </div>

        <div className="mx-auto mb-5 w-32 h-32 rounded-lg overflow-hidden bg-surface-sunken shadow-lg">
          <div className="w-full h-full bg-linear-to-br from-accent/20 to-accent/5 flex items-center justify-center">
            <span className="text-2xl">🎙️</span>
          </div>
        </div>

        <h3 className="font-serif text-xl md:text-2xl tracking-tight leading-tight text-ink text-center mb-3">
          Building finite feeds: architecture for calm software
        </h3>

        <div className="flex justify-center mb-3">
          <div className="flex items-center gap-[2px] h-8">
            {bars.map((h, i) => (
              <div key={i} className="w-[2.5px] rounded-full bg-accent/20" style={{ height: h }} />
            ))}
          </div>
        </div>

        <span className="text-xs font-mono tracking-wide text-ink-tertiary">45 min listen</span>
      </div>
    </MagazinePage>
  );
};

/* ── Showcase: Vote controls ─────────────────────────────────────── */

const ShowcaseVotes = (): React.ReactElement => {
  const [vote, setVote] = React.useState<1 | -1 | null>(null);
  return (
    <div className="flex items-center justify-center gap-4 py-6">
      <span className="text-sm text-ink-tertiary">Relevance</span>
      <VoteControls value={vote} onVote={setVote} />
    </div>
  );
};

/* ── Showcase: Button row ────────────────────────────────────────── */

const ShowcaseButtons = (): React.ReactElement => (
  <div className="flex flex-wrap items-center justify-center gap-3 py-6">
    <Button variant="primary" size="sm">
      Subscribe
    </Button>
    <Button variant="secondary" size="sm">
      Manage sources
    </Button>
    <Button variant="ghost" size="sm">
      Skip for now
    </Button>
  </div>
);

/* ── Exports ─────────────────────────────────────────────────────── */

export {
  ShowcaseCover,
  ShowcaseSection,
  ShowcaseFinale,
  ShowcaseArticleHero,
  ShowcaseArticleCompact,
  ShowcasePodcast,
  ShowcaseVotes,
  ShowcaseButtons,
};
