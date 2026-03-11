/* ── Agent tool implementations ───────────────────────────
 * Each tool returns a string result for the LLM.
 * Actions (click, fillInput) trigger the virtual cursor
 * and wait for mutations to settle before returning.
 * ──────────────────────────────────────────────────────── */

import type { QueryClient } from "@tanstack/react-query";
import type { AiToolDefinition } from "./ai.types.ts";
import { queryPage, queryElement, getElementHtml } from "./ai.descriptor.ts";
import { getTutorialContent } from "./ai.tutorials.ts";
import { awaitSettled } from "./ai.settled.ts";

type ToolContext = {
  queryClient: QueryClient;
  navigate: (path: string) => void;
  moveCursor: (targetId: string) => Promise<void>;
};

/* ── Tool definitions (sent to the LLM) ──────────────── */

const toolDefinitions: AiToolDefinition[] = [
  {
    name: "queryPage",
    description: "Get a structured JSON snapshot of the current page. Returns annotated UI elements at the given depth. Errors are always included regardless of depth.",
    parameters: {
      type: "object",
      properties: {
        depth: { type: "number", description: "How many levels deep to expand (default: 1). Higher values show more detail but use more tokens.", default: 1 },
      },
    },
  },
  {
    name: "queryElement",
    description: "Get detailed information about a specific annotated element and its children.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The data-ai-id of the element to inspect" },
        depth: { type: "number", description: "How many levels deep to expand children (default: 2)", default: 2 },
      },
      required: ["id"],
    },
  },
  {
    name: "getElementHtml",
    description: "Get the raw HTML of a specific element, truncated to 2000 characters. Useful for reading text content or inspecting form state when the structured descriptor isn't enough.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The data-ai-id of the element" },
      },
      required: ["id"],
    },
  },
  {
    name: "click",
    description: "Click an annotated UI element. The virtual cursor will move to the element, then click it. Waits for any resulting mutations or navigation to complete before returning.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The data-ai-id of the element to click" },
      },
      required: ["id"],
    },
  },
  {
    name: "fillInput",
    description: "Set the value of a form input, textarea, or select. The virtual cursor moves to the element, then fills it. Dispatches input/change events so React state updates.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The data-ai-id of the input element" },
        value: { type: "string", description: "The value to set" },
      },
      required: ["id", "value"],
    },
  },
  {
    name: "navigate",
    description: "Navigate to a route path. Use when you know the destination and don't need to click through navigation links. Waits for the route transition to complete.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "The route path to navigate to, e.g. '/sources' or '/editions/new'" },
      },
      required: ["path"],
    },
  },
  {
    name: "getTutorial",
    description: "Load a tutorial document to learn how a feature works. Call this before attempting an unfamiliar workflow. Tutorials explain concepts and describe the step-by-step UI flow.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Tutorial ID: getting-started, sources, focuses, editions, feed, bookmarks, scoring, or settings" },
      },
      required: ["id"],
    },
  },
];

/* ── Agent click flag ────────────────────────────────── */

let agentClicking = false;

const isAgentClick = (): boolean => agentClicking;

/* ── Tool execution ──────────────────────────────────── */

const executeTool = async (
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> => {
  switch (name) {
    case "queryPage": {
      const depth = (args.depth as number) ?? 1;
      const descriptor = queryPage(depth);
      return JSON.stringify(descriptor, null, 2);
    }

    case "queryElement": {
      const id = args.id as string;
      const depth = (args.depth as number) ?? 2;
      const node = queryElement(id, depth);
      if (!node) return JSON.stringify({ error: `Element "${id}" not found on the current page.` });
      return JSON.stringify(node, null, 2);
    }

    case "getElementHtml": {
      const id = args.id as string;
      const html = getElementHtml(id);
      if (!html) return JSON.stringify({ error: `Element "${id}" not found on the current page.` });
      return html;
    }

    case "click": {
      const id = args.id as string;
      const el = document.querySelector(`[data-ai-id="${CSS.escape(id)}"]`);
      if (!el) return JSON.stringify({ error: `Element "${id}" not found on the current page.` });

      await ctx.moveCursor(id);

      // For checkbox/toggle roles, find the actual clickable element inside
      const role = el.getAttribute("data-ai-role");
      let clickTarget: Element = el;
      if (role === "checkbox" || role === "toggle") {
        const inner = el.querySelector("label, input[type='checkbox'], button[role='checkbox'], [data-checked], [data-unchecked]");
        if (inner) clickTarget = inner;
      }

      // Dispatch click (flag so global listener ignores it)
      agentClicking = true;
      if (clickTarget instanceof HTMLElement) {
        clickTarget.click();
      } else {
        clickTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
      agentClicking = false;

      await awaitSettled(ctx.queryClient);

      // Return a fresh page snapshot
      const page = queryPage(1);
      return JSON.stringify({ result: "clicked", page }, null, 2);
    }

    case "fillInput": {
      const id = args.id as string;
      const value = args.value as string;
      const el = document.querySelector(`[data-ai-id="${CSS.escape(id)}"]`);
      if (!el) return JSON.stringify({ error: `Element "${id}" not found on the current page.` });

      await ctx.moveCursor(id);

      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        // Use native setter to bypass React's synthetic event system
        const nativeSetter = Object.getOwnPropertyDescriptor(
          el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (el instanceof HTMLSelectElement) {
        el.value = value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        return JSON.stringify({ error: `Element "${id}" is not an input, textarea, or select.` });
      }

      await awaitSettled(ctx.queryClient);
      return JSON.stringify({ result: "filled", value });
    }

    case "navigate": {
      const path = args.path as string;
      ctx.navigate(path);
      await awaitSettled(ctx.queryClient);
      const page = queryPage(1);
      return JSON.stringify({ result: "navigated", page }, null, 2);
    }

    case "getTutorial": {
      const id = args.id as string;
      const content = await getTutorialContent(id);
      return content;
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
};

export { toolDefinitions, executeTool, isAgentClick };
export type { ToolContext };
