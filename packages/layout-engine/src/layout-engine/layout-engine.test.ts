import { afterEach, describe, expect, it } from 'vitest';

import { paginate } from './layout-engine.layout.ts';
import { text } from './layout-engine.content.ts';
import type { Content, LayoutFn } from './layout-engine.types.ts';

/* ── Fixtures ─────────────────────────────────────────────────── */

const PARAGRAPH_ONE =
  'For the better part of a decade the dominant paradigm in digital reading has been the infinite scroll, ' +
  'a pattern borrowed wholesale from social timelines and applied to long-form work it never suited.';

const PARAGRAPH_TWO =
  'A growing number of designers now question whether that assumption ever served readers at all, ' +
  'and a few have started building the alternative rather than merely describing it.';

const PARAGRAPH_THREE =
  'Source budgeting, reading-time targets and a definite last page are the obvious moves once the goal ' +
  'stops being time on screen and starts being a reader who finishes and puts the thing down.';

const BODY = `${PARAGRAPH_ONE}\n${PARAGRAPH_TWO}\n${PARAGRAPH_THREE}`;

const SPEC = { width: 320, height: 220 };

const mounts: HTMLElement[] = [];

const createMount = (): HTMLElement => {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  el.style.font = '14px/20px serif';
  document.body.appendChild(el);
  mounts.push(el);
  return el;
};

const bodyLayout: LayoutFn = (items, page) => {
  page.flow(items, {
    columns: 1,
    inset: 10,
    endY: page.height - 10,
    render: () => ({
      type: 'text',
      setup: (el) => {
        el.style.font = '14px/20px serif';
      },
    }),
  });
};

const renderedText = (el: HTMLElement): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

const squash = (value: string): string => value.replace(/\s+/g, '');

afterEach(() => {
  for (const mount of mounts.splice(0)) {
    mount.remove();
  }
});

/* ── Tests ────────────────────────────────────────────────────── */

describe('paginate', () => {
  it('carries a paragraph across pages without losing or repeating text', () => {
    const content: Content[] = [text(BODY)];
    const pages = paginate({ content, spec: SPEC, layouts: [bodyLayout], mount: createMount() });

    expect(pages.length).toBeGreaterThan(1);

    // Paragraph breaks are set as vertical space rather than characters, so
    // compare without whitespace: nothing dropped, nothing set twice.
    const combined = pages.map((page) => renderedText(page.el)).join(' ');
    expect(squash(combined)).toBe(squash(BODY));
  });

  it('keeps every line inside its column', () => {
    const content: Content[] = [text(BODY)];
    const mount = createMount();
    const pages = paginate({ content, spec: SPEC, layouts: [bodyLayout], mount });

    for (const page of pages) {
      mount.appendChild(page.el);
      const pageBox = page.el.getBoundingClientRect();
      for (const line of page.el.querySelectorAll('span')) {
        const box = line.getBoundingClientRect();
        // 10px inset each side, plus a little tolerance for sub-pixel rounding.
        expect(box.left).toBeGreaterThanOrEqual(pageBox.left + 10 - 1);
        expect(box.right).toBeLessThanOrEqual(pageBox.left + SPEC.width - 10 + 1);
      }
    }
  });

  it('terminates when the content cannot be placed', () => {
    const content: Content[] = [text(BODY)];
    const pages = paginate({
      content,
      spec: SPEC,
      layouts: [bodyLayout],
      mount: createMount(),
      maxPages: 4,
    });
    expect(pages.length).toBeLessThanOrEqual(4);
  });
});

describe('container box model', () => {
  const quoteLayout =
    (padding: number): LayoutFn =>
    (items, page) => {
      page.flow(items, {
        columns: 1,
        inset: 10,
        endY: page.height - 10,
        render: () => ({
          type: 'text',
          setup: (el) => {
            el.style.font = '14px/20px serif';
            el.style.paddingLeft = `${padding}px`;
            el.style.borderLeft = '2px solid black';
          },
        }),
      });
    };

  /** Widest line on the first page, once it is on screen. */
  const widestLine = (layout: LayoutFn, mount: HTMLElement): number => {
    const pages = paginate({ content: [text(BODY)], spec: SPEC, layouts: [layout], mount });
    const first = pages[0];
    if (!first) {
      throw new Error('expected at least one page');
    }
    mount.appendChild(first.el);
    const lines = [...first.el.querySelectorAll('span')];
    return Math.max(...lines.map((line) => line.getBoundingClientRect().width));
  };

  it('takes the container’s padding and border out of the measure', () => {
    const mount = createMount();
    // 16px padding + 2px border comes off the measure, so lines are narrower.
    expect(widestLine(quoteLayout(16), mount)).toBeLessThan(widestLine(bodyLayout, mount));
  });

  it('leaves room between the border and the first character', () => {
    const mount = createMount();
    const pages = paginate({
      content: [text(BODY)],
      spec: SPEC,
      layouts: [quoteLayout(16)],
      mount,
    });

    const page = pages[0];
    if (!page) {
      throw new Error('expected at least one page');
    }
    mount.appendChild(page.el);

    const container = page.el.querySelector('div');
    const line = page.el.querySelector('span');
    if (!container || !line) {
      throw new Error('expected a flow container with lines');
    }

    const gap = line.getBoundingClientRect().left - container.getBoundingClientRect().left;
    // 2px border + 16px padding, give or take sub-pixel rounding.
    expect(gap).toBeGreaterThanOrEqual(17);
  });
});

describe('inline markup', () => {
  const spans = [
    { kind: 'bold' as const, start: 4, end: 10 },
    { kind: 'link' as const, start: 30, end: 38, href: 'https://example.com/piece' },
  ];

  it('re-applies markup to the lines it lands on', () => {
    const content: Content[] = [text(BODY, { spans })];
    const pages = paginate({ content, spec: SPEC, layouts: [bodyLayout], mount: createMount() });

    const first = pages[0];
    expect(first).toBeDefined();

    const strong = first?.el.querySelector('strong');
    const anchor = first?.el.querySelector('a');

    expect(strong?.textContent).toBe(BODY.slice(4, 10));
    expect(anchor?.textContent).toBe(BODY.slice(30, 38));
    expect(anchor?.getAttribute('href')).toBe('https://example.com/piece');
  });

  it('leaves the text itself unchanged', () => {
    const plain = paginate({
      content: [text(BODY)],
      spec: SPEC,
      layouts: [bodyLayout],
      mount: createMount(),
    });
    const marked = paginate({
      content: [text(BODY, { spans })],
      spec: SPEC,
      layouts: [bodyLayout],
      mount: createMount(),
    });

    expect(normalize(marked.map((page) => renderedText(page.el)).join(' '))).toBe(
      normalize(plain.map((page) => renderedText(page.el)).join(' ')),
    );
  });
});
