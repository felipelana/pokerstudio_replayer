import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  deleteUserSkin,
  listUserSkins,
  saveUserSkin,
} from '../../../application/skins/UserSkins.js';
import { problem } from '../errors.js';
import { requireUser } from '../context.js';
import type { AppContainer } from '../../../main-container.js';

const skinSchema = z.object({
  skinId: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  data: z.unknown().transform((v) => v ?? null),
  isDefault: z.boolean().optional(),
});

/**
 * Per-user skins: the editor saves here so a customisation follows the account
 * across devices instead of living only in that browser's IndexedDB.
 */
export async function skinRoutes(app: FastifyInstance, container: AppContainer) {
  app.get('/skins', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const result = await listUserSkins(container, user.id);
    if (!result.ok) return problem(reply, result.error);
    return reply.send(
      result.value.map((s) => ({
        id: s.skinId,
        name: s.name,
        data: s.data,
        updatedAt: s.updatedAt.toISOString(),
      })),
    );
  });

  app.put('/skins', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const body = skinSchema.parse(request.body);
    const result = await saveUserSkin(container, { userId: user.id, ...body });
    if (!result.ok) return problem(reply, result.error);
    await container.prisma.usageEvent.create({
      data: { userId: user.id, type: 'SKIN_SAVED', skinId: body.skinId },
    });
    return reply.send({
      id: result.value.skinId,
      name: result.value.name,
      updatedAt: result.value.updatedAt.toISOString(),
    });
  });

  app.delete('/skins/:skinId', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { skinId } = z.object({ skinId: z.string().min(1) }).parse(request.params);
    const result = await deleteUserSkin(container, user.id, skinId);
    if (!result.ok) return problem(reply, result.error);
    return reply.status(204).send();
  });
}
