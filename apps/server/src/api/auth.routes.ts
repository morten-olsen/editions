import { z } from "zod/v4";

import {
  AuthService,
  InvalidCredentialsError,
  UsernameExistsError,
} from "../auth/auth.ts";
import { createAuthHook } from "../auth/auth.middleware.ts";
import { ConfigService } from "../config/config.ts";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

const credentialsSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8).max(256),
});

const authResponseSchema = z.object({
  id: z.string(),
  role: z.string(),
  token: z.string(),
});

const userResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const createAuthRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    fastify.route({
      method: "POST",
      url: "/auth/register",
      schema: {
        body: credentialsSchema,
        response: {
          201: authResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const config = services.get(ConfigService).config;
        if (!config.auth.allowSignups) {
          return reply.code(403).send({ error: "Signups are disabled" });
        }
        const auth = services.get(AuthService);
        try {
          const result = await auth.register(req.body.username, req.body.password);
          return reply.code(201).send(result);
        } catch (err) {
          if (err instanceof UsernameExistsError) {
            return reply.code(409).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    fastify.route({
      method: "POST",
      url: "/auth/login",
      schema: {
        body: credentialsSchema,
        response: {
          200: authResponseSchema,
          401: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const auth = services.get(AuthService);
        try {
          const result = await auth.login(req.body.username, req.body.password);
          return reply.send(result);
        } catch (err) {
          if (err instanceof InvalidCredentialsError) {
            return reply.code(401).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    const authenticate = createAuthHook(services);

    fastify.route({
      method: "GET",
      url: "/auth/me",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: userResponseSchema,
          401: errorResponseSchema,
        },
      },
      handler: async (req, _reply) => {
        return {
          id: req.user.sub,
          username: req.user.username,
          role: req.user.role,
        };
      },
    });
  };

export { createAuthRoutes };
