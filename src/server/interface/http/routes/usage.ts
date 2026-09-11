import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContainer } from '../../../main-container.js';

const USAGE_TYPES = [
  'APP_OPEN',
  'HAND_IMPORT',
  'REVIEW_START',
  'REPORT_EXPORT',
  'SKIN_APPLIED',
] as const;

/**
 * Usage measurement. The client only calls this after the visitor accepted
 * non-essential storage, and the anonymous id is theirs, not ours: nothing here
 * identifies a person who is not signed in.
 */
export async function usageRoutes(app: FastifyInstance, container: AppContainer) {
  app.post(
    '/usage',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = z
        .object({
          type: z.enum(USAGE_TYPES),
          anonId: z
            .string()
            .min(8)
            .max(64)
            .regex(/^[A-Za-z0-9_-]+$/)
            .optional(),
          skinId: z.string().max(64).optional(),
          meta: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        })
        .parse(request.body);

      const userId = request.currentUser?.id;
      // Neither a session nor an anonymous id means nothing to attach it to.
      if (!userId && !body.anonId) return reply.status(204).send();

      await container.prisma.usageEvent.create({
        data: {
          userId,
          anonId: userId ? undefined : body.anonId,
          type: body.type,
          skinId: body.skinId,
          meta: body.meta,
        },
      });
      return reply.status(204).send();
    },
  );
}
