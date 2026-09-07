import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { loadSession } from './context.js';
import { registerErrorHandler } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { skinRoutes } from './routes/skins.js';
import { adminRoutes } from './routes/admin.js';
import { referralRoutes } from './routes/referrals.js';
import type { AppContainer } from '../../main-container.js';

/** Methods that change state must carry the header and a same-site origin. */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildServer(container: AppContainer): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: container.config.isProduction ? 'info' : 'debug' },
    trustProxy: true,
    disableRequestLogging: false,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: container.config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  });
  await app.register(cookie, { secret: container.config.SESSION_SECRET });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  registerErrorHandler(app, container.config.isProduction);

  // CORS is deliberately narrow: only the product's own origins.
  const allowedOrigins = new Set([container.config.APP_URL, 'http://localhost:5173']);
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      reply.header('access-control-allow-origin', origin);
      reply.header('access-control-allow-credentials', 'true');
      reply.header('access-control-allow-headers', 'content-type,x-requested-with');
      reply.header('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (request.method === 'OPTIONS') return reply.status(204).send();
  });

  // CSRF: a cross-site form cannot set this header, and the origin must match.
  app.addHook('preHandler', async (request, reply) => {
    if (!UNSAFE.has(request.method)) return;
    const origin = request.headers.origin;
    const requestedWith = request.headers['x-requested-with'];
    if (origin && !allowedOrigins.has(origin)) {
      return reply.status(403).type('application/problem+json').send({
        type: 'https://pokerstudio.com.br/errors/csrf',
        title: 'Cross-site request rejected.',
        status: 403,
        code: 'csrf',
      });
    }
    if (requestedWith !== 'XMLHttpRequest') {
      return reply.status(403).type('application/problem+json').send({
        type: 'https://pokerstudio.com.br/errors/csrf',
        title: 'Missing X-Requested-With header.',
        status: 403,
        code: 'csrf',
      });
    }
  });

  app.addHook('preHandler', async (request) => {
    await loadSession(container, request);
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(
    async (api) => {
      await authRoutes(api, container);
      await skinRoutes(api, container);
      await adminRoutes(api, container);
      await referralRoutes(api, container);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
