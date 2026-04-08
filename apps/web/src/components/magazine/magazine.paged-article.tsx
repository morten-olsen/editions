/**
 * Magazine Paged Article
 *
 * Renders a single page of a paged article layout. Each page fits the viewport
 * with no vertical scroll. Text segments are rendered as positioned DOM spans
 * with inline markup restored from InlineSpan data.
 */

import * as React from 'react';
import { motion } from 'motion/react';

import type { ArticlePage, ArticleOpener, PaginateResult } from './magazine.paginate.ts';
import type { MeasuredTextSegment } from './magazine.measure.ts';
import type { InlineSpan, TextSegment } from './magazine.segments.ts';
import { MagazinePage } from './magazine.layout.tsx';

/* ── Constants ────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

/** Height reserved for the bottom navigation bar */
const NAV_BAR_HEIGHT = 56;

/* ── Article style (visual variety) ───────────────────────────── */

type ArticleStyle = 'standard' | 'feature' | 'minimal';

/* ── Inline markup rendering ──────────────────────────────────── */

/**
 * Find where a line's text starts in the original segment text.
 * Uses indexOf with a search-start hint to handle repeated substrings.
 */
const findLineOffset = (fullText: string, lineText: string, searchFrom: number): number => {
  if (lineText.length === 0) return searchFrom;
  const idx = fullText.indexOf(lineText, searchFrom);
  // Fallback: if exact match fails (rare edge case with whitespace normalization),
  // use the search-from position
  return idx >= 0 ? idx : searchFrom;
};

/**
 * Render a line's text with inline markup spans applied.
 */
const renderLineWithSpans = (
  _fullText: string,
  spans: InlineSpan[],
  lineText: string,
  lineStart: number,
  lineKey: string,
): React.ReactNode => {
  const lineEnd = lineStart + lineText.length;

  // Find spans that intersect this line's character range
  const activeSpans = spans
    .filter((s) => s.start < lineEnd && s.end > lineStart)
    .map((s) => ({
      ...s,
      start: Math.max(0, s.start - lineStart),
      end: Math.min(lineText.length, s.end - lineStart),
    }))
    .sort((a, b) => a.start - b.start);

  if (activeSpans.length === 0) {
    return lineText;
  }

  const elements: React.ReactNode[] = [];
  let pos = 0;

  for (const span of activeSpans) {
    if (span.start > pos) {
      elements.push(lineText.slice(pos, span.start));
    }

    const spanText = lineText.slice(span.start, span.end);
    const key = `${lineKey}-${span.kind}-${span.start}`;

    switch (span.kind) {
      case 'bold':
        elements.push(<strong key={key} className="font-semibold text-ink">{spanText}</strong>);
        break;
      case 'italic':
        elements.push(<em key={key}>{spanText}</em>);
        break;
      case 'code':
        elements.push(
          <code key={key} className="font-mono text-[0.875em] bg-surface-sunken px-1 py-0.5 rounded">
            {spanText}
          </code>,
        );
        break;
      case 'link':
        elements.push(
          <a key={key} href={span.href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            {spanText}
          </a>,
        );
        break;
    }

    pos = span.end;
  }

  if (pos < lineText.length) {
    elements.push(lineText.slice(pos));
  }

  return <>{elements}</>;
};

/* ── Font size extraction ──────────────────────────────────────── */

/**
 * Extract the font-size, font-weight, and font-style from a canvas font shorthand.
 * e.g. "16px Newsreader" → { fontSize: 16 }
 *      "500 28px Newsreader" → { fontSize: 28, fontWeight: 500 }
 *      "italic 20px Newsreader" → { fontSize: 20, fontStyle: 'italic' }
 */
const parseFontShorthand = (font: string): { fontSize: number; fontWeight?: number; fontStyle?: string } => {
  const parts = font.split(/\s+/);
  let fontStyle: string | undefined;
  let fontWeight: number | undefined;
  let fontSize = 16;

  for (const part of parts) {
    if (part === 'italic' || part === 'oblique') {
      fontStyle = part;
    } else if (/^\d+$/.test(part)) {
      fontWeight = Number(part);
    } else if (/^\d+(\.\d+)?px$/.test(part)) {
      fontSize = parseFloat(part);
    }
  }

  return { fontSize, fontWeight, fontStyle };
};

/* ── Text region renderer ─────────────────────────────────────── */

type TextRegionProps = {
  measured: MeasuredTextSegment;
  lineRange?: { start: number; end: number };
  isDropCap?: boolean;
};

const TextRegion = ({ measured, lineRange, isDropCap }: TextRegionProps): React.ReactElement => {
  const { segment, lines, fontEntry } = measured;
  const start = lineRange?.start ?? 0;
  const end = lineRange?.end ?? lines.length;
  const visibleLines = lines.slice(start, end);

  const className = getTextSegmentClassName(segment);
  const { fontSize, fontWeight, fontStyle } = parseFontShorthand(fontEntry.font);

  // Build character offsets by searching for each line in the original text
  let searchFrom = 0;
  // Fast-forward searchFrom to account for lines before our range
  for (let i = 0; i < start; i++) {
    const line = lines[i];
    if (line) {
      const offset = findLineOffset(segment.text, line.text, searchFrom);
      searchFrom = offset + line.text.length;
    }
  }

  return (
    <div
      className={className}
      style={{
        fontSize,
        lineHeight: `${fontEntry.lineHeight}px`,
        fontWeight: fontWeight ?? undefined,
        fontStyle: fontStyle ?? undefined,
      }}
    >
      {visibleLines.map((line, i) => {
        const lineIdx = start + i;
        const lineOffset = findLineOffset(segment.text, line.text, searchFrom);
        searchFrom = lineOffset + line.text.length;

        const isFirstLine = lineIdx === 0 && isDropCap;

        return (
          <span key={lineIdx} className="block" style={{ height: fontEntry.lineHeight }}>
            {isFirstLine && line.text.length > 0 ? (
              <>
                <span className="float-left text-[3.2em] font-serif font-semibold leading-[0.8] mr-2 mt-0.5 text-ink">
                  {line.text[0]}
                </span>
                {renderLineWithSpans(segment.text, segment.inlineSpans, line.text.slice(1), lineOffset + 1, `l${lineIdx}`)}
              </>
            ) : (
              renderLineWithSpans(segment.text, segment.inlineSpans, line.text, lineOffset, `l${lineIdx}`)
            )}
          </span>
        );
      })}
    </div>
  );
};

/* ── Segment CSS classes ──────────────────────────────────────── */

const getTextSegmentClassName = (segment: TextSegment): string => {
  switch (segment.kind) {
    case 'heading':
      return 'font-serif font-medium tracking-tight text-ink';
    case 'blockquote':
      return 'font-serif italic text-ink-secondary border-l-2 border-accent pl-4';
    case 'paragraph':
    default:
      return 'font-serif text-ink-secondary';
  }
};

/* ── Image region renderer ────────────────────────────────────── */

const ImageRegion = ({ src, alt, height }: { src: string; alt: string; height: number }): React.ReactElement => (
  <div className="rounded-lg overflow-hidden bg-surface-sunken" style={{ height }}>
    <img src={src} alt={alt} className="w-full h-full object-cover" />
  </div>
);

/* ── HR region renderer ───────────────────────────────────────── */

const HrRegion = (): React.ReactElement => (
  <div className="flex items-center justify-center h-6">
    <div className="w-12 h-px bg-border-strong" />
  </div>
);

/* ── Article opener variants ──────────────────────────────────── */

type OpenerProps = {
  opener: ArticleOpener;
  style: ArticleStyle;
  imageHeight?: number;
};

const ArticlePageOpener = ({ opener, style, imageHeight }: OpenerProps): React.ReactElement => {
  if (style === 'feature') {
    return <FeatureOpener opener={opener} imageHeight={imageHeight} />;
  }
  if (style === 'minimal') {
    return <MinimalOpener opener={opener} />;
  }
  return <StandardOpener opener={opener} imageHeight={imageHeight} />;
};

/** Standard opener: source → title → byline → image → divider */
const StandardOpener = ({ opener, imageHeight }: { opener: ArticleOpener; imageHeight?: number }): React.ReactElement => (
  <div className="mb-4">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: easeOut }}
      className="text-xs font-mono tracking-wide text-accent mb-2">{opener.sourceName}</motion.div>
    <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
      className="font-serif text-2xl md:text-3xl tracking-tight leading-tight text-ink mb-2">{opener.title}</motion.h2>
    <OpenerByline opener={opener} delay={0.2} />
    {opener.imageUrl && imageHeight && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.15 }}
        className="rounded-lg overflow-hidden bg-surface-sunken my-3" style={{ height: imageHeight }}>
        <img src={opener.imageUrl} alt="" className="w-full h-full object-cover" />
      </motion.div>
    )}
    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.25 }}
      className="w-12 h-px bg-border-strong origin-left mb-3" />
  </div>
);

/** Feature opener: large title with accent treatment, image below */
const FeatureOpener = ({ opener, imageHeight }: { opener: ArticleOpener; imageHeight?: number }): React.ReactElement => (
  <div className="mb-4">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: easeOut }}
      className="text-xs font-mono tracking-widest text-accent uppercase mb-3">{opener.sourceName}</motion.div>
    <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut, delay: 0.1 }}
      className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight leading-none text-ink mb-3">{opener.title}</motion.h2>
    {opener.summary && (
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: easeOut, delay: 0.2 }}
        className="font-serif text-lg leading-relaxed text-ink-secondary mb-3 max-w-prose">{opener.summary}</motion.p>
    )}
    <OpenerByline opener={opener} delay={0.25} />
    {opener.imageUrl && imageHeight && (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}
        className="rounded-lg overflow-hidden bg-surface-sunken my-3" style={{ height: imageHeight }}>
        <img src={opener.imageUrl} alt="" className="w-full h-full object-cover" />
      </motion.div>
    )}
    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
      className="w-16 h-px bg-accent origin-left mb-3" />
  </div>
);

/** Minimal opener: subtle section rule, compact typography */
const MinimalOpener = ({ opener }: { opener: ArticleOpener }): React.ReactElement => (
  <div className="mb-4">
    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.4, ease: easeOut }}
      className="w-8 h-px bg-border-strong origin-left mb-3" />
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: easeOut, delay: 0.1 }}
      className="text-xs font-mono tracking-wide text-ink-tertiary mb-2">{opener.sourceName}</motion.div>
    <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut, delay: 0.15 }}
      className="font-serif text-xl md:text-2xl tracking-tight leading-snug text-ink mb-2">{opener.title}</motion.h2>
    <OpenerByline opener={opener} delay={0.2} />
  </div>
);

/** Shared byline row */
const OpenerByline = ({ opener, delay }: { opener: ArticleOpener; delay: number }): React.ReactElement => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: easeOut, delay }}
    className="flex items-center gap-3 text-xs text-ink-tertiary mb-2">
    {opener.author && <span>By {opener.author}</span>}
    {opener.consumptionTimeSeconds && (
      <>
        {opener.author && <span className="text-ink-faint">·</span>}
        <span>{Math.round(opener.consumptionTimeSeconds / 60)} min {opener.sourceType === 'podcast' ? 'listen' : 'read'}</span>
      </>
    )}
  </motion.div>
);

/* ── PagedArticlePage ─────────────────────────────────────────── */

type PagedArticlePageProps = {
  page: ArticlePage;
  opener: ArticleOpener;
  layout: PaginateResult['layout'];
  footer?: React.ReactNode;
  /** Visual style for variety across articles */
  style?: ArticleStyle;
};

const PagedArticlePage = ({
  page,
  opener,
  layout,
  footer,
  style = 'standard',
}: PagedArticlePageProps): React.ReactElement => {
  const { contentWidth, columnWidth, columnGap, padding, pageContentHeight, openerHeight } = layout;

  // Extra bottom padding for the nav bar
  const effectiveBottomPadding = padding.bottom + NAV_BAR_HEIGHT;
  const effectiveContentHeight = pageContentHeight - NAV_BAR_HEIGHT;

  return (
    <MagazinePage className="!p-0 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="relative h-screen flex flex-col"
        style={{
          paddingTop: padding.top,
          paddingBottom: effectiveBottomPadding,
          paddingLeft: padding.horizontal,
          paddingRight: padding.horizontal,
        }}
      >
        {/* Opener on first page */}
        {page.isFirstPage && (
          <div style={{ width: contentWidth }}>
            <ArticlePageOpener
              opener={opener}
              style={style}
              imageHeight={opener.imageUrl ? Math.min(contentWidth / (16 / 9), effectiveContentHeight * 0.25) : undefined}
            />
          </div>
        )}

        {/* Column container */}
        {page.regions.length > 0 && (
          <div
            className="relative flex-1"
            style={{
              width: contentWidth,
              maxHeight: page.isFirstPage
                ? effectiveContentHeight - openerHeight - (page.isLastPage ? 100 : 0)
                : effectiveContentHeight - (page.isLastPage ? 100 : 0),
            }}
          >
            {page.regions.map((region, rIdx) => {
              const x = region.column === 0 ? 0 : columnWidth + columnGap;

              return (
                <div
                  key={rIdx}
                  className="absolute"
                  style={{ top: region.y, left: x, width: columnWidth }}
                >
                  <RegionRenderer
                    region={region}
                    isDropCap={
                      page.isFirstPage &&
                      rIdx === 0 &&
                      region.measured.segment.kind === 'paragraph' &&
                      !!(region.measured.segment as TextSegment).isFirstParagraph
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Footer on last page */}
        {page.isLastPage && footer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.2 }}
            className="mt-auto pt-4"
            style={{ width: contentWidth }}
          >
            {footer}
          </motion.div>
        )}
      </motion.div>
    </MagazinePage>
  );
};

/* ── Region renderer ──────────────────────────────────────────── */

type RegionRendererProps = {
  region: ArticlePage['regions'][number];
  isDropCap?: boolean;
};

const RegionRenderer = ({ region, isDropCap }: RegionRendererProps): React.ReactElement | null => {
  const { measured } = region;

  switch (measured.segment.kind) {
    case 'paragraph':
    case 'heading':
    case 'blockquote':
      return (
        <TextRegion
          measured={measured as MeasuredTextSegment}
          lineRange={region.lineRange}
          isDropCap={isDropCap}
        />
      );

    case 'image':
      return <ImageRegion src={measured.segment.src} alt={measured.segment.alt} height={measured.height} />;

    case 'hr':
      return <HrRegion />;

    case 'spacing':
      return null;
  }
};

/* ── Style rotation helper ────────────────────────────────────── */

/** Rotate article styles for visual variety, like the old hero/editorial/compact rotation */
const styleForPosition = (positionInSection: number): ArticleStyle => {
  const variant = positionInSection % 3;
  if (variant === 0) return 'feature';
  if (variant === 1) return 'standard';
  return 'minimal';
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { PagedArticlePageProps, ArticleStyle };
export { PagedArticlePage, ArticlePageOpener, TextRegion, RegionRenderer, styleForPosition, NAV_BAR_HEIGHT };
