import type { FastifyInstance } from 'fastify';
import type { AppContainer } from '../../../main-container.js';

/**
 * What is running here, and is it able to answer?
 *
 * The deploy pipeline reads this immediately after a release: an `ok` that
 * carries the commit it just pushed is the proof the new image is the one
 * serving traffic, and anything else triggers the rollback. The admin footer
 * reads the same route, so a person looking at the screen can tell staging
 * from production without checking the address bar.
 *
 * It is deliberately anonymous — a health check that needs a session is not a
 * health check — and it says nothing a stranger could use.
 */
export async function healthRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
  const { config } = container;

  app.get('/health', async (_request, reply) => {
    // A release must never be read from a cache.
    reply.header('cache-control', 'no-store');
    return {
      ok: true,
      env: config.APP_ENV,
      version: config.APP_VERSION,
      commit: config.APP_COMMIT,
      builtAt: config.APP_BUILT_AT ?? null,
      time: new Date().toISOString(),
    };
  });
}
