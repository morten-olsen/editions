import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Services } from '../services/services.ts';

import { ApiKeysService, InvalidApiKeyError, satisfiesScope } from './api-keys.ts';
import type { ApiKeyScope, VerifiedApiKey } from './api-keys.ts';

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyRequest {
    apiKey: VerifiedApiKey;
  }
}

type ApiKeyHookOptions = {
  /** Minimum scope the key must hold. Defaults to `read`. */
  minScope?: ApiKeyScope;
};

/**
 * Validates `Authorization: Bearer ek_...` and populates `req.apiKey`.
 *
 * Mirrors `auth/auth.middleware.ts` but for machine clients. Responds with
 * `WWW-Authenticate` on 401 so MCP clients can tell a missing credential from a
 * rejected one.
 */
const createApiKeyHook =
  (services: Services, { minScope = 'read' }: ApiKeyHookOptions = {}) =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply
        .code(401)
        .header('WWW-Authenticate', 'Bearer realm="editions"')
        .send({ error: 'Missing or invalid Authorization header' });
    }

    try {
      req.apiKey = await services.get(ApiKeysService).verify(header.slice(7));
    } catch (err) {
      if (err instanceof InvalidApiKeyError) {
        return reply
          .code(401)
          .header('WWW-Authenticate', 'Bearer realm="editions", error="invalid_token"')
          .send({ error: err.message });
      }
      throw err;
    }

    if (!satisfiesScope(req.apiKey.scope, minScope)) {
      return reply.code(403).send({
        error: `This API key has scope "${req.apiKey.scope}"; "${minScope}" or higher is required`,
      });
    }
  };

export type { ApiKeyHookOptions };
export { createApiKeyHook };
