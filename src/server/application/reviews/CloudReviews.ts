import { Errors } from '../../domain/errors/index.js';
import { fail, ok, type Result } from '../../shared/result.js';
import type { PrismaClient } from '@prisma/client';
import type { Clock } from '../ports/index.js';

export interface ReviewDeps {
  prisma: PrismaClient;
  clock: Clock;
  /** Review sessions a single account may push in one day (answer 3). */
  dailyUploadLimit: number;
}

export interface ReviewSessionInput {
  id: string;
  title: string;
  sourceFileName?: string;
  roomDetected?: string;
  handCount: number;
  currentHandIndex?: number;
  currentActionIndex?: number;
  status?: 'IN_PROGRESS' | 'COMPLETED';
  storeHandHistory?: boolean;
  hands?: {
    index: number;
    handId?: string;
    rawHistory?: string;
    heroPosition?: string;
    heroVpip?: boolean;
    result?: 'WON' | 'LOST' | 'FOLDED';
    potWon?: number;
    reviewedAt?: string;
    notes?: {
      tags: string[];
      body: string;
      includeInReport?: boolean;
      capture?: 'NONE' | 'TEXT' | 'IMAGE';
      imageRef?: string;
    }[];
  }[];
}

const startOfDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** How many review sessions this account has created since midnight UTC. */
export async function uploadsToday(deps: ReviewDeps, userId: string): Promise<number> {
  return deps.prisma.reviewSession.count({
    where: { userId, createdAt: { gte: startOfDay(deps.clock.now()) } },
  });
}

/** The list a "continue where you left off" screen needs — no hands, no notes. */
export async function listReviews(deps: ReviewDeps, userId: string) {
  const rows = await deps.prisma.reviewSession.findMany({
    where: { userId },
    orderBy: { lastOpenedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      title: true,
      sourceFileName: true,
      roomDetected: true,
      handCount: true,
      currentHandIndex: true,
      currentActionIndex: true,
      status: true,
      storeHandHistory: true,
      lastOpenedAt: true,
      completedAt: true,
      updatedAt: true,
      _count: { select: { hands: true } },
    },
  });
  return ok(rows);
}

/** One review with its hands and notes, to resume it on another device. */
export async function getReview(deps: ReviewDeps, userId: string, id: string) {
  const row = await deps.prisma.reviewSession.findFirst({
    where: { id, userId },
    include: { hands: { orderBy: { index: 'asc' }, include: { notes: true } } },
  });
  if (!row) return fail(Errors.notFound('Review'));
  return ok(row);
}

/**
 * Creates or replaces a review. The client owns the id, so pushing the same
 * review twice updates it instead of piling up copies — and only a genuinely
 * new one counts against the daily limit.
 */
export async function saveReview(
  deps: ReviewDeps,
  input: { userId: string; review: ReviewSessionInput },
): Promise<Result<{ id: string; created: boolean }>> {
  const { userId, review } = input;
  const now = deps.clock.now();

  const existing = await deps.prisma.reviewSession.findUnique({
    where: { id: review.id },
    select: { userId: true },
  });
  if (existing && existing.userId !== userId) return fail(Errors.forbidden());

  if (!existing && (await uploadsToday(deps, userId)) >= deps.dailyUploadLimit) {
    return fail(Errors.quotaExceeded('review uploads'));
  }

  // Raw hand histories are only kept when the user asked for it; without the
  // opt-in the server holds the shape of the review, not the hands themselves.
  const keepRaw = review.storeHandHistory === true;

  const hands = (review.hands ?? []).map((hand) => ({
    index: hand.index,
    handId: hand.handId,
    rawHistory: keepRaw ? hand.rawHistory : undefined,
    heroPosition: hand.heroPosition,
    heroVpip: hand.heroVpip,
    result: hand.result,
    potWon: hand.potWon,
    reviewedAt: hand.reviewedAt ? new Date(hand.reviewedAt) : undefined,
    notes: {
      create: (hand.notes ?? []).map((note) => ({
        tags: note.tags,
        body: note.body,
        includeInReport: note.includeInReport ?? false,
        capture: note.capture ?? 'NONE',
        imageRef: note.imageRef,
      })),
    },
  }));

  const header = {
    title: review.title,
    sourceFileName: review.sourceFileName,
    roomDetected: review.roomDetected,
    handCount: review.handCount,
    currentHandIndex: review.currentHandIndex ?? 0,
    currentActionIndex: review.currentActionIndex,
    status: review.status ?? ('IN_PROGRESS' as const),
    storeHandHistory: keepRaw,
    lastOpenedAt: now,
    completedAt: review.status === 'COMPLETED' ? now : null,
  };

  await deps.prisma.$transaction(async (tx) => {
    if (existing) {
      // Replacing the hands wholesale keeps the stored review identical to what
      // the client just sent, instead of merging two histories of edits.
      await tx.handRecord.deleteMany({ where: { reviewSessionId: review.id } });
      await tx.reviewSession.update({
        where: { id: review.id },
        data: { ...header, hands: { create: hands } },
      });
    } else {
      await tx.reviewSession.create({
        data: { id: review.id, userId, ...header, hands: { create: hands } },
      });
    }
    await tx.usageEvent.create({
      data: {
        userId,
        type: existing ? 'REVIEW_SAVE' : 'REVIEW_START',
        meta: { handCount: review.handCount },
      },
    });
  });

  return ok({ id: review.id, created: !existing });
}

/** The cheap write the replayer makes as the user moves through the hands. */
export async function saveProgress(
  deps: ReviewDeps,
  input: {
    userId: string;
    id: string;
    currentHandIndex: number;
    currentActionIndex?: number;
    status?: 'IN_PROGRESS' | 'COMPLETED';
  },
): Promise<Result<{ ok: true }>> {
  const now = deps.clock.now();
  const { count } = await deps.prisma.reviewSession.updateMany({
    where: { id: input.id, userId: input.userId },
    data: {
      currentHandIndex: input.currentHandIndex,
      currentActionIndex: input.currentActionIndex,
      status: input.status,
      completedAt: input.status === 'COMPLETED' ? now : undefined,
      lastOpenedAt: now,
    },
  });
  if (count === 0) return fail(Errors.notFound('Review'));

  if (input.status === 'COMPLETED') {
    await deps.prisma.usageEvent.create({
      data: { userId: input.userId, type: 'REVIEW_COMPLETE' },
    });
  }
  return ok({ ok: true });
}

export async function deleteReview(
  deps: ReviewDeps,
  userId: string,
  id: string,
): Promise<Result<{ ok: true }>> {
  const { count } = await deps.prisma.reviewSession.deleteMany({ where: { id, userId } });
  if (count === 0) return fail(Errors.notFound('Review'));
  return ok({ ok: true });
}
