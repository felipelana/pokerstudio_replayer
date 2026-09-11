import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  disableTotp,
  startTotpEnrollment,
  useRecoveryCode,
  verifyTotp,
} from '../../../application/auth/TwoFactor.js';
import { Errors } from '../../../domain/errors/index.js';
import { problem } from '../errors.js';
import { clientIp, requireUser } from '../context.js';
import type { AppContainer } from '../../../main-container.js';

/**
 * Second factor for administrators. These routes deliberately sit *outside*
 * `requireAdmin`: an admin who has not passed the second factor yet still needs
 * to reach them, otherwise enrolment could never happen.
 */
export async function twoFactorRoutes(app: FastifyInstance, container: AppContainer) {
  const deps = {
    twoFactor: container.twoFactor,
    sessions: container.sessions,
    log: container.log,
    totp: container.totp,
    clock: container.clock,
    tokenGen: container.tokenGen,
    cipher: container.cipher,
    issuer: 'PokerStudio Replayer',
  };

  /** The role is required; a verified second factor is not. */
  const requireAdminRole = (
    request: Parameters<typeof requireUser>[0],
    reply: Parameters<typeof requireUser>[1],
  ) => {
    const user = requireUser(request, reply);
    if (!user) return undefined;
    if (user.role !== 'ADMIN') {
      void problem(reply, Errors.forbidden());
      return undefined;
    }
    return user;
  };

  app.get('/admin/2fa', async (request, reply) => {
    const user = requireAdminRole(request, reply);
    if (!user) return;
    const enrollment = await container.twoFactor.find(user.id);
    return reply.send({
      enrolled: !!enrollment?.confirmedAt,
      pending: !!enrollment && !enrollment.confirmedAt,
      verified: !!request.twoFactorDone,
      recoveryCodesLeft: enrollment?.confirmedAt
        ? await container.twoFactor.countRecoveryCodes(user.id)
        : 0,
    });
  });

  app.post('/admin/2fa/enroll', async (request, reply) => {
    const user = requireAdminRole(request, reply);
    if (!user) return;
    const result = await startTotpEnrollment(deps, user);
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.post('/admin/2fa/verify', async (request, reply) => {
    const user = requireAdminRole(request, reply);
    if (!user) return;
    const { code } = z.object({ code: z.string().min(6).max(10) }).parse(request.body);
    const result = await verifyTotp(deps, {
      user,
      sessionId: request.currentSessionId!,
      code,
      ip: clientIp(request),
    });
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.post('/admin/2fa/recovery', async (request, reply) => {
    const user = requireAdminRole(request, reply);
    if (!user) return;
    const { code } = z.object({ code: z.string().min(6).max(20) }).parse(request.body);
    const result = await useRecoveryCode(deps, {
      user,
      sessionId: request.currentSessionId!,
      code,
      ip: clientIp(request),
    });
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.delete('/admin/2fa', async (request, reply) => {
    const user = requireAdminRole(request, reply);
    if (!user) return;
    const { code } = z.object({ code: z.string().min(6).max(10) }).parse(request.body);
    const result = await disableTotp(deps, { user, code, ip: clientIp(request) });
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });
}
