import { z } from 'zod/v4';

/**
 * The page contract shared by every list endpoint that can grow with usage.
 *
 * Deliberately covers the *shape* only, not the query: the feed and focus feeds
 * page in memory (scoring needs embeddings, so SQL can't order the candidates)
 * while everything else pages in SQL. Forcing one query helper over both would
 * be a false abstraction — the shape is what callers depend on.
 *
 * `limit: null` means "no limit was applied — these are all the rows". Endpoints
 * that always page return a number; an endpoint serving both a picker (needs
 * every row) and a list view (needs a page) returns null for the former.
 */
type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number | null;
};

/**
 * Paging options for a service method. `limit: undefined` means "the method's
 * own default" — each service documents its default in its signature, so the
 * default lives next to the query that honours it rather than in the route.
 *
 * A method that can return every row widens `limit` to `number | null` itself;
 * most can't, and shouldn't advertise an option they don't support.
 */
type PageOptions = {
  offset?: number;
  limit?: number;
};

const MAX_PAGE_LIMIT = 100;

type PagedSchema<T extends z.ZodType> = z.ZodObject<{
  items: z.ZodArray<T>;
  total: z.ZodNumber;
  offset: z.ZodNumber;
  limit: z.ZodNullable<z.ZodNumber>;
}>;

const pagedSchema = <T extends z.ZodType>(itemSchema: T): PagedSchema<T> =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    offset: z.number(),
    limit: z.number().nullable(),
  });

/**
 * `?offset=&limit=` for any paged endpoint. An omitted `limit` falls through to
 * the service default — which is a page size for most endpoints and "everything"
 * for the ones a picker reads.
 */
const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
});

/** Builds a `Page<T>` from rows plus a Kysely count result. */
const toPage = <T>({
  items,
  total,
  offset,
  limit,
}: {
  items: T[];
  total: number | bigint | string;
  offset: number;
  limit: number | null;
}): Page<T> => ({
  items,
  total: Number(total),
  offset,
  limit,
});

export type { Page, PageOptions, PagedSchema };
export { pagedSchema, paginationQuerySchema, toPage, MAX_PAGE_LIMIT };
