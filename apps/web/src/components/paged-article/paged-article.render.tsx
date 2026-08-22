/**
 * Paged Article — Render
 *
 * Renders a Page as absolutely positioned regions. No flow layout —
 * every element is placed at exact coordinates by the layout engine.
 * The renderer just paints what it's told.
 */

import * as React from 'react';

import type {
  Page,
  Region,
  TextRegion,
  ImageRegion,
  RuleRegion,
  SeparatorRegion,
  PageConfig,
} from './paged-article.layouts.ts';
import { contentWidth as cw } from './paged-article.layouts.ts';
import type { InlineSpan } from './paged-article.segments.ts';

/* ── Page renderer ────────────────────────────────────────────── */

type PageRendererProps = {
  page: Page;
  config: PageConfig;
  footer?: React.ReactNode;
  isLastPage?: boolean;
};

const PageRenderer = ({ page, config, footer, isLastPage }: PageRendererProps): React.ReactElement => {
  const contentWidth = cw(config);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: config.height,
        paddingTop: config.padding.top,
        paddingBottom: config.padding.bottom + config.navHeight,
        paddingLeft: config.padding.horizontal,
        paddingRight: config.padding.horizontal,
      }}
    >
      <div className="relative" style={{ width: contentWidth, height: '100%' }}>
        {page.regions.map((region, i) => (
          <RegionRenderer key={i} region={region} />
        ))}
      </div>

      {isLastPage && footer && (
        <div
          className="absolute left-0 right-0"
          style={{
            bottom: config.padding.bottom + config.navHeight,
            paddingLeft: config.padding.horizontal,
            paddingRight: config.padding.horizontal,
          }}
        >
          <div style={{ width: contentWidth }}>{footer}</div>
        </div>
      )}
    </div>
  );
};

/* ── Region renderer ──────────────────────────────────────────── */

const RegionRenderer = ({ region }: { region: Region }): React.ReactElement => {
  const base: React.CSSProperties = {
    position: 'absolute',
    top: region.y,
    left: region.x,
  };

  switch (region.kind) {
    case 'text':
      return <TextRenderer region={region} style={{ ...base, width: region.width }} />;
    case 'image':
      return <ImageRenderer region={region} style={{ ...base, width: region.width }} />;
    case 'rule':
      return <RuleRenderer region={region} style={{ ...base, width: region.width }} />;
    case 'separator':
      return <SeparatorRenderer region={region} style={base} />;
  }
};

/* ── Text renderer ────────────────────────────────────────────── */

const TextRenderer = ({ region, style }: { region: TextRegion; style: React.CSSProperties }): React.ReactElement => {
  const { text, inlineSpans, allLines, font, lineHeight, startLine, endLine, role } = region;
  const visible = allLines.slice(startLine, endLine);
  const { fontSize, fontWeight, fontStyle, fontFamily } = parseFontShorthand(font);

  let searchFrom = 0;
  for (let i = 0; i < startLine; i++) {
    const line = allLines[i];
    if (line) {
      searchFrom = findLineOffset(text, line.text, searchFrom) + line.text.length;
    }
  }

  return (
    <div
      style={{ ...style, fontSize, lineHeight: `${lineHeight}px`, fontWeight, fontStyle, fontFamily }}
      className={roleClass(role)}
    >
      {visible.map((line, i) => {
        const lineIdx = startLine + i;
        const offset = findLineOffset(text, line.text, searchFrom);
        searchFrom = offset + line.text.length;

        return (
          <span key={lineIdx} className="block overflow-hidden" style={{ height: lineHeight, whiteSpace: 'nowrap' }}>
            {renderSpans(inlineSpans, line.text, offset, `l${lineIdx}`)}
          </span>
        );
      })}
    </div>
  );
};

/* ── Role → CSS class ─────────────────────────────────────────── */

const roleClass = (role: TextRegion['role']): string => {
  switch (role) {
    case 'title':
      return 'tracking-tight text-ink';
    case 'source':
      return 'tracking-wide text-accent uppercase';
    case 'summary':
      return 'text-ink-secondary';
    case 'byline':
      return 'text-ink-tertiary';
    case 'heading':
      return 'tracking-tight text-ink';
    case 'blockquote':
      return 'text-ink-secondary border-l-2 border-accent pl-4';
    case 'dropcap':
      return 'text-ink';
    case 'body':
      return 'text-ink-secondary';
  }
};

/* ── Image renderer ───────────────────────────────────────────── */

const ImageRenderer = ({ region, style }: { region: ImageRegion; style: React.CSSProperties }): React.ReactElement => (
  <div
    style={{ ...style, height: region.height }}
    className={`bg-surface-sunken overflow-hidden ${region.rounded ? 'rounded-lg' : ''}`}
  >
    <img src={region.src} alt={region.alt} className="w-full h-full object-cover" />
  </div>
);

/* ── Rule renderer ────────────────────────────────────────────── */

const RuleRenderer = ({ region, style }: { region: RuleRegion; style: React.CSSProperties }): React.ReactElement => (
  <div style={{ ...style, height: 1 }} className={region.accent ? 'bg-accent' : 'bg-border-strong'} />
);

/* ── Separator renderer (column divider) ──────────────────────── */

const SeparatorRenderer = ({
  region,
  style,
}: {
  region: SeparatorRegion;
  style: React.CSSProperties;
}): React.ReactElement => (
  <div
    style={{ ...style, width: 1, height: region.height }}
    className="bg-linear-to-b from-transparent via-border/40 to-transparent"
  />
);

/* ── Inline span rendering ────────────────────────────────────── */

const findLineOffset = (fullText: string, lineText: string, searchFrom: number): number => {
  if (lineText.length === 0) {
    return searchFrom;
  }
  const idx = fullText.indexOf(lineText, searchFrom);
  return idx >= 0 ? idx : searchFrom;
};

const renderSpans = (spans: InlineSpan[], lineText: string, lineStart: number, lineKey: string): React.ReactNode => {
  const lineEnd = lineStart + lineText.length;

  const active = spans
    .filter((s) => s.start < lineEnd && s.end > lineStart)
    .map((s) => ({
      ...s,
      start: Math.max(0, s.start - lineStart),
      end: Math.min(lineText.length, s.end - lineStart),
    }))
    .sort((a, b) => a.start - b.start);

  if (active.length === 0) {
    return lineText;
  }

  const out: React.ReactNode[] = [];
  let pos = 0;

  for (const span of active) {
    if (span.start > pos) {
      out.push(lineText.slice(pos, span.start));
    }
    const t = lineText.slice(span.start, span.end);
    const key = `${lineKey}-${span.kind}-${span.start}`;

    switch (span.kind) {
      case 'bold':
        out.push(
          <strong key={key} className="font-semibold text-ink">
            {t}
          </strong>,
        );
        break;
      case 'italic':
        out.push(<em key={key}>{t}</em>);
        break;
      case 'code':
        out.push(
          <code key={key} className="font-mono text-[0.875em] bg-surface-sunken px-1 py-0.5 rounded">
            {t}
          </code>,
        );
        break;
      case 'link':
        out.push(
          <a
            key={key}
            href={span.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {t}
          </a>,
        );
        break;
    }
    pos = span.end;
  }

  if (pos < lineText.length) {
    out.push(lineText.slice(pos));
  }
  return <>{out}</>;
};

/* ── Font shorthand parsing ───────────────────────────────────── */

const parseFontShorthand = (
  font: string,
): { fontSize: number; fontWeight?: number; fontStyle?: string; fontFamily?: string } => {
  let fontStyle: string | undefined;
  let fontWeight: number | undefined;
  let fontSize = 16;
  let fontFamily: string | undefined;

  const sizeMatch = font.match(/(\d+(?:\.\d+)?)px\s+(.*)/);
  const sizeText = sizeMatch?.[1];
  if (sizeMatch && sizeText !== undefined) {
    fontSize = parseFloat(sizeText);
    fontFamily = sizeMatch[2];
  }

  const prefix = sizeText !== undefined ? font.slice(0, font.indexOf(sizeText + 'px')).trim() : '';
  for (const part of prefix.split(/\s+/)) {
    if (part === 'italic' || part === 'oblique') {
      fontStyle = part;
    } else if (/^\d+$/.test(part)) {
      fontWeight = Number(part);
    }
  }

  return { fontSize, fontWeight, fontStyle, fontFamily };
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { PageRendererProps };
export { PageRenderer, RegionRenderer, TextRenderer };
