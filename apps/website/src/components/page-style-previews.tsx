/**
 * Renders four MagazineArticle layout variants as scaled-down page thumbnails.
 * Each is rendered at full size inside a scaled container to look like a
 * miniature magazine page.
 */
import * as React from "react";
import { MagazineArticle } from "../../../web/src/components/magazine/magazine.article.tsx";

const articles = [
  {
    title: "The quiet revolution in reader design",
    sourceName: "Ars Technica",
    author: "Sarah Chen",
    publishedAt: "2026-03-11",
    consumptionTimeSeconds: 480,
    imageUrl: "https://picsum.photos/seed/reader-mag/800/600",
    positionInSection: 0,
    summary:
      "A growing number of designers are questioning whether the infinite scroll ever served the reader at all.",
  },
  {
    title: "TypeScript 6.0 introduces pattern matching",
    sourceName: "Hacker News",
    author: "Anders Hejlsberg",
    publishedAt: "2026-03-10",
    consumptionTimeSeconds: 180,
    imageUrl: "https://picsum.photos/seed/typescript-mag/800/450",
    positionInSection: 1,
    summary:
      "The long-awaited pattern matching RFC lands in TypeScript.",
  },
  {
    title: "JWST captures the universe's first galaxies",
    sourceName: "Nature",
    author: "Dr. Priya Natarajan",
    publishedAt: "2026-03-09",
    consumptionTimeSeconds: 360,
    imageUrl: "https://picsum.photos/seed/jwst-mag/800/800",
    positionInSection: 2,
    summary:
      "New observations have revealed the earliest galaxies ever seen.",
  },
  {
    title: "Building finite feeds: architecture for calm software",
    sourceName: "Software Unscripted",
    publishedAt: "2026-03-08",
    consumptionTimeSeconds: 2700,
    imageUrl: "https://picsum.photos/seed/podcast-cover/800/800",
    sourceType: "podcast" as const,
    summary:
      "A conversation about designing software that respects the reader's time.",
  },
];

const LABELS = ["Hero", "Editorial", "Compact", "Podcast"];

const PageStylePreviews = (): React.ReactElement => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {articles.map((article, i) => (
      <div key={i} className="flex flex-col gap-2">
        <div className="page-preview relative rounded-xl border border-border bg-surface shadow overflow-hidden aspect-[3/4]">
          <div
            className="absolute inset-0 origin-top-left"
            style={{
              width: "200%",
              height: "200%",
              transform: "scale(0.5)",
              pointerEvents: "none",
            }}
          >
            <MagazineArticle {...article} />
          </div>
        </div>
        <div className="text-center text-xs font-mono tracking-wide text-ink-faint">
          {LABELS[i]}
        </div>
      </div>
    ))}
  </div>
);

export { PageStylePreviews };
