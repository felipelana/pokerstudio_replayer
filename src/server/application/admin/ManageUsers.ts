import { Errors } from '../../domain/errors/index.js';
import { fail, ok, type Result } from '../../shared/result.js';
import type {
  AccessLogRepository,
  SessionRepository,
  UserRepository,
} from '../../domain/repositories/index.js';
import type { Clock } from '../ports/index.js';
import type { User, UserStatus } from '../../domain/entities/User.js';

export interface AdminDeps {
  users: UserRepository;
  sessions: SessionRepository;
  log: AccessLogRepository;
  clock: Clock;
}

export async function listUsers(
  deps: AdminDeps,
  filter: { q?: string; status?: UserStatus; country?: string; page?: number; pageSize?: number },
): Promise<Result<{ items: User[]; total: number }>> {
  return ok(
    await deps.users.list({
      q: filter.q,
      status: filter.status,
      country: filter.country,
      page: Math.max(1, filter.page ?? 1),
      pageSize: Math.min(100, filter.pageSize ?? 25),
    }),
  );
}

/**
 * Blocks a user and drops their sessions in the same step, so the next request
 * they make is already rejected.
 */
export async function blockUser(
  deps: AdminDeps,
  input: { adminId: string; userId: string; reason: string },
): Promise<Result<User>> {
  if (!input.reason.trim()) return fail(Errors.forbidden());
  const target = await deps.users.findById(input.userId);
  if (!target) return fail(Errors.notFound('User'));

  const updated = await deps.users.update(target.id, {
    status: 'BLOCKED',
    blockedReason: input.reason.trim(),
  });
  const revoked = await deps.sessions.revokeAllForUser(target.id);
  await deps.log.record({
    userId: target.id,
    email: target.email,
    event: 'ADMIN_BLOCK',
    detail: { by: input.adminId, reason: input.reason.trim(), sessionsRevoked: revoked },
  });
  return ok(updated);
}

export async function unblockUser(
  deps: AdminDeps,
  input: { adminId: string; userId: string },
): Promise<Result<User>> {
  const target = await deps.users.findById(input.userId);
  if (!target) return fail(Errors.notFound('User'));
  const updated = await deps.users.update(target.id, {
    status: 'ACTIVE',
    blockedReason: undefined,
  });
  await deps.log.record({
    userId: target.id,
    email: target.email,
    event: 'ADMIN_UNBLOCK',
    detail: { by: input.adminId },
  });
  return ok(updated);
}

export async function revokeUserSessions(
  deps: AdminDeps,
  input: { adminId: string; userId: string },
): Promise<Result<{ revoked: number }>> {
  const target = await deps.users.findById(input.userId);
  if (!target) return fail(Errors.notFound('User'));
  const revoked = await deps.sessions.revokeAllForUser(target.id);
  await deps.log.record({
    userId: target.id,
    event: 'SESSION_REVOKE',
    detail: { by: input.adminId, revoked },
  });
  return ok({ revoked });
}
