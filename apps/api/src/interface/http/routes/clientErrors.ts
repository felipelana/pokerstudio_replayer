import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordError } from '../../../application/observability/RecordError.js';
import type { AppContainer } from '../../../main-container.js';

/**
 * What only the browser can see: a render that threw, a promise nobody caught.
 * The server never learns about those on its own, and they are exactly the
 * failures a player notices and an administrator does not.
 *
 * The route is deliberately open — an app that has just crashed may have no
 * session left to prove itself with — so it is held down instead: a small body,
 * a hard rate limit, a level the caller may not invent, and the same redaction
 * every other stored failure goes through. Nothing here is trusted; it is
 * recorded, which is a different thing.
 */
const body = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(8_000).optional(),
  /** The page the person was on, not a server route. */
  route: z.string().max(200).optional(),
  level: z.enum(['WARN', 'ERROR']).default('ERROR'),
  context: z.record(z.unknown()).optional(),
});

export async function clientErrorRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
  app.post(
    '/client-errors',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      bodyLimit: 16 * 1024,
    },
    async (request, reply) => {
      const input = body.parse(request.body);
      await recordError(
        {
          errors: container.errors,
          env: container.config.APP_ENV,
          release: container.config.APP_VERSION,
          onFailure: (err) => request.log.error({ err }, 'could not store a client error'),
        },
        {
          source: 'CLIENT',
          level: input.level,
          message: input.message,
          stack: input.stack,
          route: input.route,
          requestId: request.id,
          userId: request.currentUser?.id,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          context: input.context,
        },
      );
      // Nothing to say back: the browser is already in trouble.
      return reply.status(204).send();
    },
  );
}
