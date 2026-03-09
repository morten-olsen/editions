import { AuthService, InvalidTokenError } from "./auth.ts";

import type { TokenPayload } from "./auth.ts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Services } from "../services/services.ts";

declare module "fastify" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyRequest {
    user: TokenPayload;
  }
}

const createAuthHook = (services: Services) =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing or invalid Authorization header" });
    }

    const token = header.slice(7);
    try {
      req.user = await services.get(AuthService).verifyToken(token);
    } catch (err) {
      if (err instanceof InvalidTokenError) {
        return reply.code(401).send({ error: err.message });
      }
      throw err;
    }
  };

export { createAuthHook };
