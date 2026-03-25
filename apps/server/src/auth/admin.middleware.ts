import type { FastifyReply, FastifyRequest } from 'fastify';

const createAdminHook =
  () =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (req.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }
  };

export { createAdminHook };
