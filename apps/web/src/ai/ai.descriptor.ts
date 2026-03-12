/* ── Page descriptor ──────────────────────────────────────
 * Reads data-ai-* attributes from the DOM and builds a
 * structured JSON representation of the current page.
 * ──────────────────────────────────────────────────────── */

import type { AiNode, AiPageDescriptor } from './ai.types.ts';

const AI_SELECTOR = '[data-ai-id]';

const readNode = (el: Element, depth: number, maxDepth: number): AiNode => {
  const id = el.getAttribute('data-ai-id') ?? '';
  const role = el.getAttribute('data-ai-role') ?? 'unknown';
  const label = el.getAttribute('data-ai-label') ?? undefined;
  const value = el.getAttribute('data-ai-value') ?? undefined;
  const state = el.getAttribute('data-ai-state') ?? undefined;
  const error = el.getAttribute('data-ai-error') ?? undefined;

  const childEls = el.querySelectorAll(`:scope ${AI_SELECTOR}`);
  // Filter to direct ai-children (not nested deeper under another ai node)
  const directChildren: Element[] = [];
  for (const child of childEls) {
    const closestParent = child.parentElement?.closest(AI_SELECTOR);
    if (closestParent === el) {
      directChildren.push(child);
    }
  }

  // Calculate max available depth below this node
  const depthAvailable = calculateDepthAvailable(el);

  const node: AiNode = { id, role };
  if (label) {
    node.label = label;
  }
  if (value) {
    node.value = value;
  }
  if (state) {
    node.state = state;
  }
  if (error) {
    node.error = error;
  }

  if (directChildren.length > 0 && depth < maxDepth) {
    node.children = directChildren.map((child) => readNode(child, depth + 1, maxDepth));
  } else if (directChildren.length > 0) {
    node.items = directChildren.length;
    if (depthAvailable > 0) {
      node.depth_available = depthAvailable;
    }
  }

  return node;
};

const calculateDepthAvailable = (el: Element): number => {
  const children = el.querySelectorAll(`:scope ${AI_SELECTOR}`);
  if (children.length === 0) {
    return 0;
  }

  let maxChildDepth = 0;
  for (const child of children) {
    const closestParent = child.parentElement?.closest(AI_SELECTOR);
    if (closestParent === el) {
      const childDepth = 1 + calculateDepthAvailable(child);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }
  }
  return maxChildDepth;
};

const collectErrors = (root: Element): AiNode[] => {
  const errorEls = root.querySelectorAll('[data-ai-error]');
  const errors: AiNode[] = [];

  for (const el of errorEls) {
    const id = el.getAttribute('data-ai-id') ?? el.closest(AI_SELECTOR)?.getAttribute('data-ai-id') ?? 'unknown';
    const error = el.getAttribute('data-ai-error') ?? '';
    const label = el.getAttribute('data-ai-label') ?? undefined;
    errors.push({ id, role: 'error', error, label });
  }

  return errors;
};

const queryPage = (depth = 1): AiPageDescriptor => {
  const route = window.location.hash.replace(/^#/, '') || '/';

  // Find page title
  const titleEl = document.querySelector("[data-ai-role='heading']") ?? document.querySelector("[data-ai-role='page']");
  const title = titleEl?.getAttribute('data-ai-label') ?? document.title;

  // Collect all errors regardless of depth
  const errors = collectErrors(document.body);

  // Find top-level annotated elements
  const allAnnotated = document.querySelectorAll(AI_SELECTOR);
  const topLevel: Element[] = [];
  for (const el of allAnnotated) {
    const parent = el.parentElement?.closest(AI_SELECTOR);
    if (!parent) {
      topLevel.push(el);
    }
  }

  const nodes = topLevel.map((el) => readNode(el, 1, depth));

  return { route, title, errors, nodes };
};

const queryElement = (id: string, depth = 2): AiNode | null => {
  const el = document.querySelector(`[data-ai-id="${CSS.escape(id)}"]`);
  if (!el) {
    return null;
  }
  return readNode(el, 1, depth);
};

const getElementHtml = (id: string, maxLength = 2000): string | null => {
  const el = document.querySelector(`[data-ai-id="${CSS.escape(id)}"]`);
  if (!el) {
    return null;
  }
  const html = el.outerHTML;
  if (html.length <= maxLength) {
    return html;
  }
  return html.slice(0, maxLength) + '\n<!-- truncated -->';
};

export { queryPage, queryElement, getElementHtml };
