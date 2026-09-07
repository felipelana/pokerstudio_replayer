import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { blockUser, listUsers, revokeUserSessions, unblockUser } from '../../../application/admin/ManageUsers.js';
import { problem } from '../errors.js';
import { requireAdmin } from '../context.js';
import type { AppContainer } from '../../../main-container.js';

/** Everything under /admin needs role ADMIN and a session with 2FA checked. */
export async function adminRoutes(app: FastifyInstance, container: AppContainer) {
  const deps = { users: container.users, sessions: container.sessions, log: container.log, clock: container.clock };

  app.get('/admin/users', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const query = z
      .object({
        q: z.string().optional(),
        status: z.enum(['PENDING', 'ACTIVE', 'BLOCKED', 'DELETED']).optional(),
        country: z.string().length(2).optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
      })
      .parse(request.query);
    const result = await listUsers(deps, query);
    if (!result.ok) return problem(reply, result.error);
    return reply.send({
      total: result.value.total,
      items: result.value.items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.status,
        role: u.role,
        plan: u.plan,
        countryCode: u.countryCode,
        createdAt: u.createdAt,
        emailVerified: !!u.emailVerifiedAt,
      })),
    });
  });

  app.get('/admin/users/:id', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await container.users.findById(id);
    if (!user) return problem(reply, { code: 'not_found', message: 'User not found.', status: 404 });
    const [sessions, logs, identities, referrals] = await Promise.all([
      container.sessions.listForUser(id),
      container.log.list({ userId: id, page: 1, pageSize: 50 }),
      container.identities.listForUser(id),
      container.referrals.listForUser(id),
    ]);
    return reply.send({
      user: { ...user, passwordHash: undefined },
      sessions,
      logs: logs.items,
      identities: user.passwordHash ? ['PASSWORD', ...identities] : identities,
      referrals,
    });
  });

  app.post('/admin/users/:id/block', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { reason } = z.object({ reason: z.string().min(3) }).parse(request.body);
    const result = await blockUser(deps, { adminId: admin.id, userId: id, reason });
    if (!result.ok) return problem(reply, result.error);
    return reply.send({ ok: true });
  });

  app.post('/admin/users/:id/unblock', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await unblockUser(deps, { adminId: admin.id, userId: id });
    if (!result.ok) return problem(reply, result.error);
    return reply.send({ ok: true });
  });

  app.post('/admin/users/:id/revoke-sessions', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await revokeUserSessions(deps, { adminId: admin.id, userId: id });
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.get('/admin/access-logs', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const query = z
      .object({
        userId: z.string().uuid().optional(),
        event: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
      })
      .parse(request.query);
    const result = await container.log.list({
      ...query,
      page: Math.max(1, query.page ?? 1),
      pageSize: Math.min(200, query.pageSize ?? 50),
    });
    return reply.send(result);
  });

  app.get('/admin/stats', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [byStatus, byPlan, signups, logins, devices, skins] = await Promise.all([
      container.prisma.user.groupBy({ by: ['status'], _count: true }),
      container.prisma.user.groupBy({ by: ['plan'], _count: true }),
      container.prisma.$queryRaw`SELECT date_trunc('day', "createdAt")::date AS day, count(*)::int AS value
        FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      container.prisma.$queryRaw`SELECT date_trunc('day', "createdAt")::date AS day, count(*)::int AS value
        FROM "AccessLog" WHERE event IN ('LOGIN_OK','ADMIN_LOGIN_OK') AND "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      container.prisma.accessLog.groupBy({ by: ['deviceType'], _count: true, where: { createdAt: { gte: since } } }),
      container.prisma.usageEvent.groupBy({
        by: ['skinId'],
        _count: true,
        where: { type: 'SKIN_APPLIED', createdAt: { gte: since } },
        orderBy: { _count: { skinId: 'desc' } },
        take: 10,
      }),
    ]);
    return reply.send({ byStatus, byPlan, signups, logins, devices, topSkins: skins });
  });

  app.get('/admin/export/users.csv', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const { items } = await container.users.list({ page: 1, pageSize: 10000 });
    const header = 'id,email,name,status,role,plan,country,language,createdAt\n';
    const rows = items
      .map((u) =>
        [u.id, u.email, csv(u.name), u.status, u.role, u.plan, u.countryCode, u.language, u.createdAt.toISOString()].join(','),
      )
      .join('\n');
    return reply.type('text/csv').header('content-disposition', 'attachment; filename="users.csv"').send(header + rows);
  });

  app.get('/admin/email-outbox', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const rows = await container.prisma.emailOutbox.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return reply.send(rows);
  });
}

function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
