import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { blockUser, listUsers, revokeUserSessions, unblockUser } from '../../../application/admin/ManageUsers.js';
import { readEmailSettings, saveEmailSettings, sendTestEmail } from '../../../application/admin/EmailSettings.js';
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

  const emailDeps = { prisma: container.prisma, log: container.log, clock: container.clock, cipher: container.cipher };

  app.get('/admin/email-settings', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const result = await readEmailSettings(emailDeps);
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.post('/admin/email-settings', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const settings = z
      .object({
        provider: z.enum(['NONE', 'RESEND', 'SMTP']),
        fromAddress: z.string().email().optional(),
        fromName: z.string().max(80).optional(),
        replyTo: z.string().email().optional(),
        secret: z.string().max(200).optional(),
        smtpHost: z.string().max(200).optional(),
        smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
        smtpUser: z.string().max(200).optional(),
        smtpSecure: z.boolean().optional(),
        requireVerification: z.boolean(),
      })
      .parse(request.body);
    const result = await saveEmailSettings(emailDeps, { adminId: admin.id, settings });
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.post('/admin/email-settings/test', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const { to } = z.object({ to: z.string().email() }).parse(request.body);
    const result = await sendTestEmail(emailDeps, { to });
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.get('/admin/email-outbox', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const rows = await container.prisma.emailOutbox.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return reply.send(rows);
  });

  /* ---------------------------------------------------------------- */
  /* Error logs                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * What has been going wrong, most recent first. The summary above the table
   * is counted over the last 24 hours, because the question an administrator
   * opens this screen with is 'is something broken right now'.
   */
  app.get('/admin/error-logs', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const query = z
      .object({
        level: z.enum(['WARN', 'ERROR', 'FATAL']).optional(),
        source: z.enum(['SERVER', 'CLIENT']).optional(),
        env: z.string().max(20).optional(),
        q: z.string().max(200).optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(50),
      })
      .parse(request.query);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [result, summary] = await Promise.all([
      container.errors.list(query),
      container.errors.summarise(since),
    ]);
    return reply.send({ total: result.total, items: result.items, summary });
  });

  /** The whole of one failure, stack included. */
  app.get('/admin/error-logs/:id', async (request, reply) => {
    const admin = requireAdmin(request, reply);
    if (!admin) return;
    const { id } = z.object({ id: z.string().regex(/^[0-9]+$/) }).parse(request.params);
    const row = await container.errors.find(id);
    if (!row) return problem(reply, { code: 'not_found', message: 'Error log not found.', status: 404 });
    return reply.send(row);
  });
}

function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
