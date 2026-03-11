/* ── Await settled ────────────────────────────────────────
 * Waits for React Query mutations, route transitions, and
 * loading states to settle before returning control to the
 * agent. Prevents the agent from acting on stale state.
 * ──────────────────────────────────────────────────────── */

import type { QueryClient } from "@tanstack/react-query";

const SETTLE_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 100;

const hasPendingMutations = (queryClient: QueryClient): boolean => {
  const cache = queryClient.getMutationCache();
  return cache.getAll().some((m) => m.state.status === "pending");
};

const hasLoadingElements = (): boolean => {
  const loadingEls = document.querySelectorAll('[data-ai-state="loading"]');
  return loadingEls.length > 0;
};

const awaitSettled = (queryClient: QueryClient): Promise<void> =>
  new Promise<void>((resolve) => {
    const start = Date.now();

    const check = (): void => {
      const elapsed = Date.now() - start;
      if (elapsed >= SETTLE_TIMEOUT_MS) {
        resolve();
        return;
      }

      if (hasPendingMutations(queryClient) || hasLoadingElements()) {
        setTimeout(check, POLL_INTERVAL_MS);
        return;
      }

      // One final tick to let React re-render after mutations resolve
      setTimeout(resolve, 50);
    };

    // Start checking after a brief delay to let mutations begin
    setTimeout(check, 50);
  });

export { awaitSettled };
