import createClient from 'openapi-fetch';

import type { paths } from './api.types.ts';

// --- Utility types for extracting API shapes ---

type ApiResponse<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { 'application/json': infer R } } };
}
  ? R
  : never;

type ApiBody<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody: { content: { 'application/json': infer B } };
}
  ? B
  : never;

/**
 * The page contract every growable list endpoint returns. `limit: null` means the
 * endpoint returned every row (see the server's pagination module).
 */
type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number | null;
};

// --- Client ---

const client = createClient<paths>();

/**
 * Auth header from a raw token, for the few call sites that hold a token rather
 * than using the `useAuthHeaders` hook (auth bootstrap, settings sections).
 */
const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

export type { paths, ApiResponse, ApiBody, Page };
export { client, bearer };
