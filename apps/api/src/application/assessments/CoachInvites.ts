import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { validateCoachPassword } from '@pokerstudio/shared';
import { Errors } from '../../domain/errors/index.js';
import { fail, ok, type Result } from '../../shared/result.js';
import type { Clock, Hasher } from '../ports/index.js';

export interface InviteDeps {
  prisma: PrismaClient;
  clock: Clock;
  hasher: Hasher;
}

/** Long enough that guessing is hopeless, short enough to paste in a message. */
const TOKEN_BYTES = 24;

const DEFAULTS = { defaultHours: 24, maxHours: 168 };

/** How long a link may last, as the administration currently has it set. */
export async function shareSettings(prisma: PrismaClient): Promise<{ defaultHours: number; maxHours: number }> {
  const row = await prisma.shareSettings.findUnique({ where: { id: 1 } });
  return row ? { defaultHours: row.defaultHours, maxHours: row.maxHours } : DEFAULTS;
}

export async function saveShareSettings(
  prisma: PrismaClient,
  patch: { defaultHours: number; maxHours: number },
): Promise<Result<{ defaultHours: number; maxHours: number }>> {
  if (patch.defaultHours < 1 || patch.maxHours < 1) return fail(Errors.validation('Os prazos são de pelo menos uma hora.'));
  if (patch.defaultHours > patch.maxHours) return fail(Errors.validation('O prazo padrão não pode passar do prazo máximo.'));
  const row = await prisma.shareSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...patch },
    update: patch,
  });
  return ok({ defaultHours: row.defaultHours, maxHours: row.maxHours });
}

/**
 * A way in for one coach: a link, a password and a deadline.
 *
 * The password is hashed before it is stored and is returned to the caller
 * exactly once, here, so the player can hand it over. It never goes into the
 * URL, and never into a log.
 */
export async function createInvite(
  deps: InviteDeps,
  userId: string,
  input: { reviewSessionId: string; coachName: string; password: string; expiresAt?: Date },
): Promise<Result<{ id: string; token: string; expiresAt: Date; coachName: string }>> {
  const session = await deps.prisma.reviewSession.findFirst({
    where: { id: input.reviewSessionId, userId },
    select: { id: true },
  });
  if (!session) return fail(Errors.notFound('Review'));

  const problems = validateCoachPassword(input.password);
  if (problems.length > 0) return fail(Errors.validation(problems.join(' ')));

  const { defaultHours, maxHours } = await shareSettings(deps.prisma);
  const now = deps.clock.now();
  const latest = new Date(now.getTime() + maxHours * 3600_000);
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + defaultHours * 3600_000);
  if (expiresAt <= now) return fail(Errors.validation('A expiração precisa estar no futuro.'));
  if (expiresAt > latest) {
    return fail(Errors.validation(`O prazo máximo é de ${maxHours} horas a partir de agora.`));
  }

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const invite = await deps.prisma.coachInvite.create({
    data: {
      reviewSessionId: input.reviewSessionId,
      createdById: userId,
      coachName: input.coachName.trim(),
      token,
      passwordHash: await deps.hasher.hash(input.password),
      expiresAt,
    },
    select: { id: true, token: true, expiresAt: true, coachName: true },
  });
  return ok(invite);
}

/** The links on one session, for the player who made them. */
export async function listInvites(deps: InviteDeps, userId: string, reviewSessionId: string) {
  const session = await deps.prisma.reviewSession.findFirst({
    where: { id: reviewSessionId, userId },
    select: { id: true },
  });
  if (!session) return undefined;
  return deps.prisma.coachInvite.findMany({
    where: { reviewSessionId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      coachName: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      assessment: { select: { id: true, status: true, completedAt: true } },
    },
  });
}

/**
 * Taking a link back. The way in closes at once; everything the coach already
 * wrote stays exactly where it is.
 */
export async function revokeInvite(deps: InviteDeps, userId: string, inviteId: string): Promise<Result<{ id: string }>> {
  const invite = await deps.prisma.coachInvite.findFirst({
    where: { id: inviteId, createdById: userId },
    select: { id: true, revokedAt: true },
  });
  if (!invite) return fail(Errors.notFound('Invite'));
  if (invite.revokedAt) return ok({ id: invite.id });
  const row = await deps.prisma.coachInvite.update({
    where: { id: inviteId },
    data: { revokedAt: deps.clock.now() },
    select: { id: true },
  });
  return ok(row);
}

export type InviteState = 'ok' | 'revoked' | 'expired' | 'unknown';

/**
 * Is this link usable right now? Asked on every single coach request, not once
 * at sign-in, so a browser left open past the deadline is turned away too.
 */
export async function inviteState(
  deps: InviteDeps,
  inviteId: string,
): Promise<{ state: InviteState; invite?: { id: string; reviewSessionId: string; coachName: string; expiresAt: Date } }> {
  const invite = await deps.prisma.coachInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, reviewSessionId: true, coachName: true, expiresAt: true, revokedAt: true },
  });
  if (!invite) return { state: 'unknown' };
  if (invite.revokedAt) return { state: 'revoked' };
  if (invite.expiresAt <= deps.clock.now()) return { state: 'expired' };
  return { state: 'ok', invite };
}

/**
 * The coach's way in: the token from the link, and the password they were
 * given. Both are checked here, on the server, along with the deadline and any
 * revocation — the answer is deliberately the same whichever part is wrong.
 */
export async function openInvite(
  deps: InviteDeps,
  token: string,
  password: string,
): Promise<Result<{ inviteId: string; coachName: string; expiresAt: Date }>> {
  const invite = await deps.prisma.coachInvite.findUnique({
    where: { token },
    select: { id: true, coachName: true, passwordHash: true, expiresAt: true, revokedAt: true },
  });
  if (!invite) return fail(Errors.invalidCredentials());
  if (invite.revokedAt) return fail(Errors.shareRevoked());
  if (invite.expiresAt <= deps.clock.now()) return fail(Errors.shareExpired());
  if (!(await deps.hasher.verify(invite.passwordHash, password))) return fail(Errors.invalidCredentials());
  return ok({ inviteId: invite.id, coachName: invite.coachName, expiresAt: invite.expiresAt });
}
