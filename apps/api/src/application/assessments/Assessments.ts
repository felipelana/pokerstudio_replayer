import type { PrismaClient } from '@prisma/client';
import { coverage, isReviewed, leaks, score, type HandInput } from '@pokerstudio/shared';
import { Errors } from '../../domain/errors/index.js';
import type { AppError } from '../../shared/result.js';
import { fail, ok, type Result } from '../../shared/result.js';
import type { Clock } from '../ports/index.js';

export interface AssessmentDeps {
  prisma: PrismaClient;
  clock: Clock;
}

export interface HandAssessmentPatch {
  /** 0..100, or null to clear it. Undefined leaves it alone. */
  score?: number | null;
  markedOk?: boolean;
  comment?: string | null;
  streetComments?: Record<string, string> | null;
  tags?: string[];
}

/* ------------------------------------------------------------------ */
/* Getting hold of one                                                 */
/* ------------------------------------------------------------------ */

/**
 * The player's own reading of a session. Created on first sight, and never
 * replaced: sharing the session with a coach adds a reading beside it, it does
 * not stand in for it.
 */
export async function selfAssessment(deps: AssessmentDeps, userId: string, reviewSessionId: string) {
  const session = await deps.prisma.reviewSession.findFirst({
    where: { id: reviewSessionId, userId },
    select: { id: true },
  });
  if (!session) return undefined;

  const existing = await deps.prisma.assessment.findFirst({
    where: { reviewSessionId, role: 'SELF', userId },
  });
  if (existing) return existing;

  return deps.prisma.assessment.create({
    data: { reviewSessionId, role: 'SELF', userId },
  });
}

/**
 * The reading that belongs to one invitation. Created the first time that coach
 * opens the link, so an invitation that is never used leaves no empty reading
 * behind to be counted or reported.
 */
export async function coachAssessment(deps: AssessmentDeps, inviteId: string) {
  const invite = await deps.prisma.coachInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, reviewSessionId: true },
  });
  if (!invite) return undefined;

  const existing = await deps.prisma.assessment.findUnique({ where: { coachInviteId: inviteId } });
  if (existing) return existing;

  return deps.prisma.assessment.create({
    data: { reviewSessionId: invite.reviewSessionId, role: 'COACH', coachInviteId: inviteId },
  });
}

/* ------------------------------------------------------------------ */
/* Writing to one                                                      */
/* ------------------------------------------------------------------ */

/** A finished reading is finished: nothing in it may change again, by anyone. */
type Writable =
  | { writable: false; error: AppError }
  | { writable: true; assessment: { id: string; reviewSessionId: string } };

async function writable(deps: AssessmentDeps, assessmentId: string): Promise<Writable> {
  const assessment = await deps.prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, reviewSessionId: true, completedAt: true },
  });
  if (!assessment) return { writable: false, error: Errors.notFound('Assessment') };
  if (assessment.completedAt) return { writable: false, error: Errors.assessmentCompleted() };
  return { writable: true, assessment };
}

/**
 * What one assessor says about one hand. Writing anything at all moves the
 * reading from "not started" to "in progress"; only the assessor's own
 * deliberate act finishes it.
 */
export async function saveHandAssessment(
  deps: AssessmentDeps,
  assessmentId: string,
  handIndex: number,
  patch: HandAssessmentPatch,
): Promise<Result<{ id: string }>> {
  const guard = await writable(deps, assessmentId);
  if (!guard.writable) return fail(guard.error);

  if (patch.score !== undefined && patch.score !== null) {
    if (!Number.isInteger(patch.score) || patch.score < 0 || patch.score > 100) {
      return fail(Errors.validation('A nota vai de 0 a 100.'));
    }
  }

  const hand = await deps.prisma.handRecord.findUnique({
    where: { reviewSessionId_index: { reviewSessionId: guard.assessment.reviewSessionId, index: handIndex } },
    select: { id: true },
  });
  if (!hand) return fail(Errors.notFound('Hand'));

  // Undefined fields are left as they were; null is an explicit erasure.
  const data = {
    ...(patch.score !== undefined ? { score: patch.score } : {}),
    ...(patch.markedOk !== undefined ? { markedOk: patch.markedOk } : {}),
    ...(patch.comment !== undefined ? { comment: patch.comment } : {}),
    ...(patch.streetComments !== undefined ? { streetComments: patch.streetComments ?? undefined } : {}),
    ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
  };

  const row = await deps.prisma.handAssessment.upsert({
    where: { assessmentId_handRecordId: { assessmentId, handRecordId: hand.id } },
    create: { assessmentId, handRecordId: hand.id, ...data },
    update: data,
    select: { id: true },
  });

  await deps.prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: 'IN_PROGRESS' },
  });
  return ok(row);
}

/** Where this assessor stopped. Their own place, not shared with anyone else. */
export async function saveAssessmentProgress(
  deps: AssessmentDeps,
  assessmentId: string,
  position: { handIndex?: number; frameIndex?: number },
): Promise<Result<{ id: string }>> {
  const guard = await writable(deps, assessmentId);
  if (!guard.writable) return fail(guard.error);
  const row = await deps.prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      ...(position.handIndex !== undefined ? { currentHandIndex: position.handIndex } : {}),
      ...(position.frameIndex !== undefined ? { currentFrameIndex: position.frameIndex } : {}),
    },
    select: { id: true },
  });
  return ok(row);
}

/**
 * Finishing. A partial reading may be finished on purpose — the caller is shown
 * what is still pending first — and after this nothing in it can be changed or
 * reopened, by the player or by the coach, whether or not a link is still live.
 * One coach finishing says nothing about anyone else's reading.
 */
export async function completeAssessment(deps: AssessmentDeps, assessmentId: string): Promise<Result<{ id: string }>> {
  const guard = await writable(deps, assessmentId);
  if (!guard.writable) return fail(guard.error);
  const row = await deps.prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: 'COMPLETED', completedAt: deps.clock.now() },
    select: { id: true },
  });
  return ok(row);
}

/* ------------------------------------------------------------------ */
/* Reading one                                                         */
/* ------------------------------------------------------------------ */

/** Every hand of the session, with what this one assessor said about it. */
export async function assessmentDetail(deps: AssessmentDeps, assessmentId: string) {
  const assessment = await deps.prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      invite: { select: { coachName: true, expiresAt: true, revokedAt: true } },
      session: { select: { id: true, title: true, handCount: true, roomDetected: true } },
      hands: { select: { handRecordId: true, score: true, markedOk: true, comment: true, streetComments: true, tags: true } },
    },
  });
  if (!assessment) return undefined;

  const hands = await deps.prisma.handRecord.findMany({
    where: { reviewSessionId: assessment.reviewSessionId },
    orderBy: { index: 'asc' },
    select: { id: true, index: true, handId: true, heroPosition: true, heroVpip: true, result: true },
  });

  const byHand = new Map(assessment.hands.map((h) => [h.handRecordId, h]));
  const rows = hands.map((hand) => ({
    index: hand.index,
    handId: hand.handId,
    heroPosition: hand.heroPosition,
    heroVpip: hand.heroVpip,
    result: hand.result,
    assessment: byHand.get(hand.id) ?? null,
  }));

  return { assessment, rows, summary: summarise(rows) };
}

/** The numbers for a set of hands, worked out by the shared rules. */
export function summarise(rows: { heroVpip: boolean | null; assessment: unknown }[]) {
  const input: HandInput[] = rows.map((r) => ({
    heroVpip: r.heroVpip,
    assessment: (r.assessment ?? undefined) as HandInput['assessment'],
  }));
  const cov = coverage(input);
  return {
    score: score(input),
    coverage: cov,
    pending: cov.total - cov.reviewed,
    leaks: leaks(input),
    reviewedHands: input.filter((h) => isReviewed(h.assessment)).length,
  };
}

/**
 * Every reading of one session, for the player who owns it: their own, and each
 * coach's. A coach never calls this — they only ever see their own.
 */
export async function sessionAssessments(deps: AssessmentDeps, userId: string, reviewSessionId: string) {
  const session = await deps.prisma.reviewSession.findFirst({
    where: { id: reviewSessionId, userId },
    select: { id: true, title: true, handCount: true },
  });
  if (!session) return undefined;

  const assessments = await deps.prisma.assessment.findMany({
    where: { reviewSessionId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    include: {
      invite: { select: { id: true, coachName: true, expiresAt: true, revokedAt: true } },
      hands: { select: { handRecordId: true, score: true, markedOk: true, comment: true, streetComments: true, tags: true } },
    },
  });

  const hands = await deps.prisma.handRecord.findMany({
    where: { reviewSessionId },
    orderBy: { index: 'asc' },
    select: { id: true, heroVpip: true },
  });

  return {
    session,
    items: assessments.map((a) => {
      const byHand = new Map(a.hands.map((h) => [h.handRecordId, h]));
      const rows = hands.map((h) => ({ heroVpip: h.heroVpip, assessment: byHand.get(h.id) ?? null }));
      return {
        id: a.id,
        role: a.role,
        status: a.status,
        completedAt: a.completedAt,
        currentHandIndex: a.currentHandIndex,
        currentFrameIndex: a.currentFrameIndex,
        coachName: a.invite?.coachName,
        inviteId: a.invite?.id,
        expiresAt: a.invite?.expiresAt,
        revokedAt: a.invite?.revokedAt,
        summary: summarise(rows),
      };
    }),
  };
}
