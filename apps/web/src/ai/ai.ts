/* ── AI Assistant — public API ────────────────────────────
 * Re-exports everything needed by the rest of the app.
 * Import from this file, not from submodules.
 * ──────────────────────────────────────────────────────── */

export { AiProvider, useAi } from "./ai.provider.tsx";
export { AiChatDrawer, AiToggleButton } from "./ai.chat.tsx";
export { AiCursor } from "./ai.cursor.tsx";
export type { AiConfig } from "./ai.types.ts";
