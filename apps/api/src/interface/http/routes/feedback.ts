import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listFeedback,
  listMyFeedback,
  submitFeedback,
  unreadFeedback,
  updateFeedback,
} from '../../../application/feedback/Feedback.js';
import { problem } from '../errors.js';
import { requireAdmin, requireUser } from '../context.js';
import type { AppContainer } from '../../../main-container.js';

const KINDS = ['SUGGESTION', 'IMPROVEMENT', 'PROBLEM', 'OTHER'] as const;
const STATUSES = ['NEW', 'READ', 'PLANNED', 'DONE', 'DECLINED'] as const;

/**
 * Suggestions and improvements, written by whoever uses the tool and read by
 * whoever builds it. One box: the account writes into it, the team works
 * through it.
 */
export async function feedbackRoutes(app: FastifyInstance, container: AppContainer) {
  const deps = { prisma: container.prisma, clock: container.clock };

  app.post('/feedback', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const body = z
      .object({
        kind: z.enum(KINDS).default('SUGGESTION'),
        subject: z.string().trim().min(3).max(160),
        body: z.string().trim().min(10).max(4000),
        appSurface: z.string().max(40).optional(),
        appVersion: z.string().max(40).optional(),
      })
      .parse(request.body);
    const result = await submitFeedback(deps, user.id, body);
    if (!result.ok) return problem(reply, result.error);
    return reply.code(201).send(result.value);
  });

  /** What this account has already sent, and where each note stands. */
  app.get('/feedback/mine', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    return reply.send({ items: await listMyFeedback(deps, user.id) });
  });

  app.get('/admin/feedback', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const query = z
      .object({
        status: z.enum(STATUSES).optional(),
        kind: z.enum(KINDS).optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
      })
      .parse(request.query);
    const page = await listFeedback(deps, query);
    return reply.send({ ...page, unread: await unreadFeedback(deps) });
  });

  app.patch('/admin/feedback/:id', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const patch = z
      .object({ status: z.enum(STATUSES).optional(), adminNote: z.string().max(2000).optional() })
      .parse(request.body);
    const result = await updateFeedback(deps, id, patch);
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });
}
