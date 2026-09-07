import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LANGUAGE_CODES } from '@pokerstudio/shared';
import { signUpUser } from '../../../application/auth/SignUpUser.js';
import { loginUser } from '../../../application/auth/LoginUser.js';
import { verifyEmail } from '../../../application/auth/VerifyEmail.js';
import { requestPasswordReset, resetPassword } from '../../../application/auth/ResetPassword.js';
import { Errors } from '../../../domain/errors/index.js';
import { problem } from '../errors.js';
import { clearSessionCookie, clientIp, requireUser, setSessionCookie } from '../context.js';
import type { AppContainer } from '../../../main-container.js';
import type { User } from '../../../domain/entities/User.js';

const signupSchema = z.object({
  email: z.string().min(3),
  password: z.string(),
  name: z.string().min(1),
  countryCode: z.string().length(2),
  language: z.enum(LANGUAGE_CODES),
  phone: z.string().optional(),
  phoneCountry: z.string().length(2).optional(),
  marketingOptIn: z.boolean().optional(),
  acceptedTerms: z.boolean(),
  referralCode: z.string().optional(),
  captchaToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

/** Public shape of a user — no hashes, no internal flags. */
function toMe(user: User, identities: string[]) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    countryCode: user.countryCode,
    language: user.language,
    phoneE164: user.phoneE164,
    role: user.role,
    status: user.status,
    plan: user.plan,
    emailVerified: !!user.emailVerifiedAt,
    referralCode: user.referralCode,
    // A password is a way in like any other, so the client sees it listed
    // alongside the linked providers.
    identities: user.passwordHash ? ['PASSWORD', ...identities] : identities,
  };
}

export async function authRoutes(app: FastifyInstance, container: AppContainer) {
  const cookieOpts = { domain: container.config.COOKIE_DOMAIN, secure: container.config.isProduction };

  app.post('/auth/signup', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const body = signupSchema.parse(request.body);
    const result = await signUpUser(
      {
        users: container.users,
        tokens: container.tokens,
        referrals: container.referrals,
        log: container.log,
        hasher: container.hasher,
        clock: container.clock,
        tokenGen: container.tokenGen,
        email: container.email,
        captcha: container.captcha,
        breach: container.breach,
        adminEmails: container.config.adminEmails,
        requireVerification: container.requireVerification,
      },
      { ...body, ip: clientIp(request), userAgent: request.headers['user-agent'] },
    );
    if (!result.ok) return problem(reply, result.error);

    // With verification disabled the account is usable right away.
    if (!container.requireVerification) {
      const login = await loginUser(loginDeps(container), {
        email: body.email,
        password: body.password,
        ip: clientIp(request),
        userAgent: request.headers['user-agent'],
      });
      if (login.ok) setSessionCookie(reply, login.value.token, login.value.expiresAt, cookieOpts.domain, cookieOpts.secure);
    }
    return reply.status(201).send({ id: result.value.user.id, emailVerificationRequired: container.requireVerification });
  });

  app.post('/auth/login', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await loginUser(loginDeps(container), {
      ...body,
      ip: clientIp(request),
      userAgent: request.headers['user-agent'],
    });
    if (!result.ok) return problem(reply, result.error);
    setSessionCookie(reply, result.value.token, result.value.expiresAt, cookieOpts.domain, cookieOpts.secure);
    const identities = await container.identities.listForUser(result.value.user.id);
    return reply.send(toMe(result.value.user, identities));
  });

  app.post('/auth/logout', async (request, reply) => {
    if (request.currentSessionId) {
      await container.sessions.revoke(request.currentSessionId);
      await container.log.record({ userId: request.currentUser?.id, event: 'LOGOUT', ip: clientIp(request) });
    }
    clearSessionCookie(reply, cookieOpts.domain, cookieOpts.secure);
    return reply.status(204).send();
  });

  app.post('/auth/verify-email', async (request, reply) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(request.body);
    const result = await verifyEmail(container, token, clientIp(request));
    if (!result.ok) return problem(reply, result.error);
    return reply.send({ ok: true });
  });

  app.post('/auth/forgot-password', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const body = z.object({ email: z.string().min(3), captchaToken: z.string().optional() }).parse(request.body);
    const result = await requestPasswordReset(resetDeps(container), { ...body, ip: clientIp(request) });
    if (!result.ok) return problem(reply, result.error);
    // Always the same answer, whether or not the address exists.
    return reply.send({ ok: true });
  });

  app.post('/auth/reset-password', async (request, reply) => {
    const body = z.object({ token: z.string().min(10), password: z.string() }).parse(request.body);
    const result = await resetPassword(resetDeps(container), { ...body, ip: clientIp(request) });
    if (!result.ok) return problem(reply, result.error);
    return reply.send({ ok: true });
  });

  app.get('/auth/me', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const identities = await container.identities.listForUser(user.id);
    return reply.send(toMe(user, identities));
  });

  app.get('/auth/sessions', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const sessions = await container.sessions.listForUser(user.id);
    return reply.send(
      sessions.map((s) => ({
        id: s.id,
        current: s.id === request.currentSessionId,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        ip: s.ip,
        userAgent: s.userAgent,
      })),
    );
  });

  app.delete('/auth/sessions/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const own = (await container.sessions.listForUser(user.id)).some((s) => s.id === id);
    if (!own) return problem(reply, Errors.notFound('Session'));
    await container.sessions.revoke(id);
    return reply.status(204).send();
  });
}

function loginDeps(container: AppContainer) {
  return {
    users: container.users,
    sessions: container.sessions,
    attempts: container.attempts,
    log: container.log,
    hasher: container.hasher,
    clock: container.clock,
    tokenGen: container.tokenGen,
    ua: container.ua,
    geo: container.geo,
    requireVerification: container.requireVerification,
  };
}

function resetDeps(container: AppContainer) {
  return {
    users: container.users,
    tokens: container.tokens,
    sessions: container.sessions,
    log: container.log,
    hasher: container.hasher,
    clock: container.clock,
    tokenGen: container.tokenGen,
    email: container.email,
    captcha: container.captcha,
    breach: container.breach,
  };
}
