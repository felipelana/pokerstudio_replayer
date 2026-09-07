import type { FastifyReply, FastifyRequest } from 'fastify';
import { Errors } from '../../domain/errors/index.js';
import { problem } from './errors.js';
import type { User } from '../../domain/entities/User.js';
import type { AppContainer } from '../../main-container.js';

export const SESSION_COOKIE = 'ps_session';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: User;
    currentSessionId?: string;
    twoFactorDone?: boolean;
  }
}

export function clientIp(request: FastifyRequest): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (first ?? request.ip)?.trim() || undefined;
}

/** Resolves the session cookie into `request.currentUser`, if it is still valid. */
export async function loadSession(container: AppContainer, request: FastifyRequest) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return;
  const session = await container.sessions.findByTokenHash(container.tokenGen.hash(token));
  const now = container.clock.now();
  if (!session || session.revokedAt || session.expiresAt <= now) return;

  const user = await container.users.findById(session.userId);
  if (!user || user.status === 'BLOCKED' || user.status === 'DELETED') return;

  request.currentUser = user;
  request.currentSessionId = session.id;
  request.twoFactorDone = !!session.twoFactorAt;
  await container.sessions.touch(session.id, now);
}

export function requireUser(request: FastifyRequest, reply: FastifyReply): User | undefined {
  if (!request.currentUser) {
    void problem(reply, Errors.notAuthenticated());
    return undefined;
  }
  return request.currentUser;
}

/** Admin routes need the role **and** a session where the second factor was checked. */
export function requireAdmin(request: FastifyRequest, reply: FastifyReply): User | undefined {
  const user = requireUser(request, reply);
  if (!user) return undefined;
  if (user.role !== 'ADMIN') {
    void problem(reply, Errors.forbidden());
    return undefined;
  }
  if (!request.twoFactorDone) {
    void problem(reply, Errors.twoFactorRequired());
    return undefined;
  }
  return user;
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, domain?: string, secure = false) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    domain,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, domain?: string, secure = false) {
  reply.clearCookie(SESSION_COOKIE, { path: '/', domain, httpOnly: true, sameSite: 'lax', secure });
}
