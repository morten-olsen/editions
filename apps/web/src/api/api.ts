import createClient from 'openapi-fetch';

import type { paths } from './api.types.ts';

// --- Utility types for extracting API shapes ---

type ApiResponse<
  P extends keyof paths,
  M extends keyof paths[P],
> = paths[P][M] extends { responses: { 200: { content: { 'application/json': infer R } } } }
  ? R
  : never;

type ApiBody<
  P extends keyof paths,
  M extends keyof paths[P],
> = paths[P][M] extends { requestBody: { content: { 'application/json': infer B } } }
  ? B
  : never;

// --- Client ---

const client = createClient<paths>();

export type { paths, ApiResponse, ApiBody };
export { client };
