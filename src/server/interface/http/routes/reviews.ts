import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  deleteReview,
  getReview,
  listReviews,
  saveProgress,
  saveReview,
  uploadsToday,
} from '../../../application/reviews/CloudReviews.js';
import { problem } from '../errors.js';
import { requireUser } from '../context.js';
import type { AppContainer } from '../../../main-container.js';

/**
 * The review id belongs to the client — it is the local session id, so the same
 * review pushed from two machines lands on the same row. Not necessarily a
 * UUID: older browsers without crypto.randomUUID fall back to another shape.
 */
const reviewId = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const noteSchema = z.object({
  tags: z.array(z.string().max(40)).max(20).default([]),
  body: z.string().max(4000).default(''),
  includeInReport: z.boolean().optional(),
  capture: z.enum(['NONE', 'TEXT', 'IMAGE']).optional(),
  imageRef: z.string().max(200).optional(),
});

const handSchema = z.object({
  index: z.number().int().min(0),
  handId: z.string().max(80).optional(),
  rawHistory: z.string().max(200_000).optional(),
  heroPosition: z.string().max(10).optional(),
  heroVpip: z.boolean().optional(),
  result: z.enum(['WON', 'LOST', 'FOLDED']).optional(),
  potWon: z.number().optional(),
  reviewedAt: z.string().datetime().optional(),
  notes: z.array(noteSchema).max(50).optional(),
});

const reviewSchema = z.object({
  id: reviewId,
  title: z.string().min(1).max(160),
  sourceFileName: z.string().max(260).optional(),
  roomDetected: z.string().max(40).optional(),
  handCount: z.number().int().min(0).max(100_000),
  currentHandIndex: z.number().int().min(0).optional(),
  currentActionIndex: z.number().int().min(0).optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED']).optional(),
  storeHandHistory: z.boolean().optional(),
  hands: z.array(handSchema).max(5000).optional(),
});

/**
 * Reviews kept on the account (5C), so a study session started on the desktop
 * can be picked up on another machine. The replayer keeps working entirely
 * offline; this is a copy, not the source of truth.
 */
export async function reviewRoutes(app: FastifyInstance, container: AppContainer) {
  const deps = {
    prisma: container.prisma,
    clock: container.clock,
    dailyUploadLimit: container.config.REVIEW_UPLOADS_PER_DAY,
  };

  app.get('/reviews', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const result = await listReviews(deps, user.id);
    if (!result.ok) return problem(reply, result.error);
    return reply.send({
      items: result.value,
      quota: { perDay: deps.dailyUploadLimit, usedToday: await uploadsToday(deps, user.id) },
    });
  });

  app.get('/reviews/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: reviewId }).parse(request.params);
    const result = await getReview(deps, user.id, id);
    if (!result.ok) return problem(reply, result.error);
    await container.prisma.usageEvent.create({ data: { userId: user.id, type: 'REVIEW_RESUME' } });
    return reply.send(result.value);
  });

  app.put('/reviews/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: reviewId }).parse(request.params);
    const review = reviewSchema.parse({ ...(request.body as object), id });
    const result = await saveReview(deps, { userId: user.id, review });
    if (!result.ok) return problem(reply, result.error);
    return reply.status(result.value.created ? 201 : 200).send(result.value);
  });

  app.patch('/reviews/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: reviewId }).parse(request.params);
    const body = z
      .object({
        currentHandIndex: z.number().int().min(0),
        currentActionIndex: z.number().int().min(0).optional(),
        status: z.enum(['IN_PROGRESS', 'COMPLETED']).optional(),
      })
      .parse(request.body);
    const result = await saveProgress(deps, { userId: user.id, id, ...body });
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.delete('/reviews/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: reviewId }).parse(request.params);
    const result = await deleteReview(deps, user.id, id);
    if (!result.ok) return problem(reply, result.error);
    return reply.status(204).send();
  });
}
