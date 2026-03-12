import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAuthHook } from '../auth/auth.middleware.ts';
import { DatabaseService } from '../database/database.ts';
import { VotesService, rankArticles } from '../votes/votes.ts';
import { computeScore } from '../votes/votes.scoring.ts';
import type { Services } from '../services/services.ts';

// --- Schemas ---

const feedArticleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  url: z.string().nullable(),
  title: z.string(),
  author: z.string().nullable(),
  summary: z.string().nullable(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  consumptionTimeSeconds: z.number().nullable(),
  mediaUrl: z.string().nullable(),
  mediaType: z.string().nullable(),
  sourceType: z.string(),
  readAt: z.string().nullable(),
  progress: z.number(),
  createdAt: z.string(),
  score: z.number(),
  vote: z.union([z.literal(1), z.literal(-1)]).nullable(),
  sourceName: z.string(),
});

const feedPageSchema = z.object({
  articles: z.array(feedArticleSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

const feedQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['top', 'recent']).default('top'),
  status: z.enum(['unread', 'read', 'all']).default('all'),
  from: z.string().optional(),
  to: z.string().optional(),
});

// --- Routes ---

const createFeedRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    fastify.route({
      method: 'GET',
      url: '/feed',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        querystring: feedQuerySchema,
        response: {
          200: feedPageSchema,
        },
      },
      handler: async (req, _reply) => {
        const db = await services.get(DatabaseService).getInstance();
        const userId = req.user.sub;
        const { offset, limit, sort, status, from, to } = req.query;

        const baseQuery = () => {
          let q = db
            .selectFrom('articles')
            .innerJoin('sources', 'sources.id', 'articles.source_id')
            .where('sources.user_id', '=', userId);

          if (status === 'unread') {
            q = q.where('articles.read_at', 'is', null);
          } else if (status === 'read') {
            q = q.where('articles.read_at', 'is not', null);
          }

          if (from) {
            q = q.where('articles.published_at', '>=', from);
          }
          if (to) {
            q = q.where('articles.published_at', '<=', to);
          }

          return q;
        };

        const countResult = await baseQuery().select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();

        if (sort === 'recent') {
          const rows = await baseQuery()
            .select([
              'articles.id',
              'articles.source_id',
              'articles.url',
              'articles.title',
              'articles.author',
              'articles.summary',
              'articles.image_url',
              'articles.published_at',
              'articles.consumption_time_seconds',
              'articles.media_url',
              'articles.media_type',
              'articles.read_at',
              'articles.progress',
              'articles.created_at',
              'sources.name as source_name',
              'sources.type as source_type',
            ])
            .orderBy('articles.published_at', 'desc')
            .offset(offset)
            .limit(limit)
            .execute();

          const votesService = services.get(VotesService);
          const articleIds = rows.map((r) => r.id);
          const votesMap = await votesService.getVotesByArticleIds(userId, articleIds, null);

          return {
            articles: rows.map((row) => {
              const votes = votesMap.get(row.id);
              return {
                id: row.id,
                sourceId: row.source_id,
                url: row.url,
                title: row.title,
                author: row.author,
                summary: row.summary,
                imageUrl: row.image_url,
                publishedAt: row.published_at,
                consumptionTimeSeconds: row.consumption_time_seconds,
                mediaUrl: row.media_url,
                mediaType: row.media_type,
                sourceType: row.source_type,
                readAt: row.read_at,
                progress: row.progress,
                createdAt: row.created_at,
                score: 0,
                vote: votes?.global ?? null,
                sourceName: row.source_name,
              };
            }),
            total: Number(countResult.count),
            offset,
            limit,
          };
        }

        // "top" sort — fetch all, score, then paginate
        const rows = await baseQuery()
          .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
          .select([
            'articles.id',
            'articles.source_id',
            'articles.url',
            'articles.title',
            'articles.author',
            'articles.summary',
            'articles.image_url',
            'articles.published_at',
            'articles.consumption_time_seconds',
            'articles.media_url',
            'articles.media_type',
            'articles.read_at',
            'articles.progress',
            'articles.created_at',
            'article_embeddings.embedding',
            'sources.name as source_name',
            'sources.type as source_type',
          ])
          .execute();

        const votesService = services.get(VotesService);
        const [globalContext, userWeights] = await Promise.all([
          votesService.loadVoteContext(userId, null),
          votesService.loadUserScoringWeights(userId),
        ]);

        const candidates = rows.map((row) => {
          const embeddingBuf = row.embedding as Buffer | null;
          const embedding = embeddingBuf
            ? new Float32Array(embeddingBuf.buffer, embeddingBuf.byteOffset, embeddingBuf.byteLength / 4)
            : null;

          return {
            articleId: row.id,
            similarity: 1, // no focus confidence for global feed
            nli: null,
            publishedAt: row.published_at,
            embedding,
            sourceId: row.source_id,
            url: row.url,
            title: row.title,
            author: row.author,
            summary: row.summary,
            imageUrl: row.image_url,
            consumptionTimeSeconds: row.consumption_time_seconds,
            mediaUrl: row.media_url,
            mediaType: row.media_type,
            sourceType: row.source_type,
            readAt: row.read_at,
            progress: row.progress,
            createdAt: row.created_at,
            sourceName: row.source_name,
          };
        });

        const ranked = rankArticles(candidates, globalContext, userWeights.global);
        const page = ranked.slice(offset, offset + limit);

        const articleIds = page.map((c) => c.articleId);
        const votesMap = await votesService.getVotesByArticleIds(userId, articleIds, null);

        return {
          articles: page.map((c) => {
            const votes = votesMap.get(c.articleId);
            return {
              id: c.articleId,
              sourceId: c.sourceId,
              url: c.url,
              title: c.title,
              author: c.author,
              summary: c.summary,
              imageUrl: c.imageUrl,
              publishedAt: c.publishedAt,
              consumptionTimeSeconds: c.consumptionTimeSeconds,
              mediaUrl: c.mediaUrl,
              mediaType: c.mediaType,
              sourceType: c.sourceType,
              readAt: c.readAt,
              progress: c.progress,
              createdAt: c.createdAt,
              score: computeScore(c, globalContext, userWeights.global),
              vote: votes?.global ?? null,
              sourceName: c.sourceName,
            };
          }),
          total: Number(countResult.count),
          offset,
          limit,
        };
      },
    });
  };

export { createFeedRoutes };
