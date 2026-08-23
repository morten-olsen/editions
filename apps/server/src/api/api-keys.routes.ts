import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { ApiKeyNotFoundError, ApiKeysService } from '../api-keys/api-keys.ts';
import { createAuthHook } from '../auth/auth.middleware.ts';
import type { Services } from '../services/services.ts';

// --- Schemas ---

const apiKeyScopeSchema = z.enum(['read', 'write', 'admin']).describe('read < write < admin; scopes are cumulative.');

const apiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  scope: apiKeyScopeSchema,
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});
z.globalRegistry.add(apiKeySchema, { id: 'ApiKey' });

const createdApiKeySchema = apiKeySchema.extend({
  key: z.string().describe('The full secret. Shown once here and never retrievable again.'),
});
z.globalRegistry.add(createdApiKeySchema, { id: 'CreatedApiKey' });

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scope: apiKeyScopeSchema.default('write'),
  expiresAt: z.iso.datetime().nullable().default(null),
});

const idParamSchema = z.object({ id: z.string() });

const errorResponseSchema = z.object({ error: z.string() });

// --- Routes ---

const createApiKeysRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    // These routes are authenticated with the user's JWT, never with an API key —
    // a key must not be able to mint another key or widen its own scope.
    fastify.route({
      method: 'GET',
      url: '/api-keys',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(apiKeySchema) },
      },
      handler: async (req, _reply) => {
        return services.get(ApiKeysService).list(req.user.sub);
      },
    });

    fastify.route({
      method: 'POST',
      url: '/api-keys',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: createApiKeySchema,
        response: { 201: createdApiKeySchema },
      },
      handler: async (req, reply) => {
        const created = await services.get(ApiKeysService).create({
          userId: req.user.sub,
          name: req.body.name,
          scope: req.body.scope,
          expiresAt: req.body.expiresAt,
        });
        return reply.code(201).send(created);
      },
    });

    fastify.route({
      method: 'DELETE',
      url: '/api-keys/:id',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: { 204: z.undefined(), 404: errorResponseSchema },
      },
      handler: async (req, reply) => {
        try {
          await services.get(ApiKeysService).revoke(req.user.sub, req.params.id);
          return reply.code(204).send();
        } catch (err) {
          if (err instanceof ApiKeyNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    });
  };

export { createApiKeysRoutes };
