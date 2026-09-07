import type { PrismaClient } from '@prisma/client';
import { Errors } from '../../domain/errors/index.js';
import { fail, ok, type Result } from '../../shared/result.js';
import type { Clock } from '../ports/index.js';

export type FeedbackKind = 'SUGGESTION' | 'IMPROVEMENT' | 'PROBLEM' | 'OTHER';
export type FeedbackStatus = 'NEW' | 'READ' | 'PLANNED' | 'DONE' | 'DECLINED';

export interface FeedbackDeps {
  prisma: PrismaClient;
  clock: Clock;
  /** Notes one account may leave in a day, so the box cannot be flooded. */
  dailyLimit?: number;
}

const DAILY_LIMIT = 20;

const startOfDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export interface NewFeedback {
  kind: FeedbackKind;
  subject: string;
  body: string;
  appSurface?: string;
  appVersion?: string;
}

/**
 * A reader tells us what the tool should do next. Kept whole: the text is not
 * summarised, tagged or routed anywhere on the way in — a person reads it.
 */
export async function submitFeedback(
  deps: FeedbackDeps,
  userId: string,
  input: NewFeedback,
): Promise<Result<{ id: string }>> {
  const limit = deps.dailyLimit ?? DAILY_LIMIT;
  const today = await deps.prisma.feedback.count({
    where: { userId, createdAt: { gte: startOfDay(deps.clock.now()) } },
  });
  if (today >= limit) return fail(Errors.quotaExceeded('feedback'));

  const row = await deps.prisma.feedback.create({
    data: {
      userId,
      kind: input.kind,
      subject: input.subject.trim(),
      body: input.body.trim(),
      appSurface: input.appSurface,
      appVersion: input.appVersion,
    },
    select: { id: true },
  });
  return ok(row);
}

/** What one account has sent, so a reader can see their own notes and replies. */
export async function listMyFeedback(deps: FeedbackDeps, userId: string) {
  return deps.prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, kind: true, subject: true, body: true, status: true, createdAt: true },
  });
}

export interface FeedbackQuery {
  status?: FeedbackStatus;
  kind?: FeedbackKind;
  page?: number;
  pageSize?: number;
}

/** The whole box, newest first, for the team. */
export async function listFeedback(deps: FeedbackDeps, query: FeedbackQuery) {
  const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
  };
  const [total, items] = await Promise.all([
    deps.prisma.feedback.count({ where }),
    deps.prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        kind: true,
        subject: true,
        body: true,
        status: true,
        adminNote: true,
        appSurface: true,
        appVersion: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);
  return { total, page, pageSize, items };
}

/** The team's answer to one note: where it stands, and why. */
export async function updateFeedback(
  deps: FeedbackDeps,
  id: string,
  patch: { status?: FeedbackStatus; adminNote?: string },
): Promise<Result<{ id: string }>> {
  const existing = await deps.prisma.feedback.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return fail(Errors.notFound('Feedback'));
  const row = await deps.prisma.feedback.update({
    where: { id },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.adminNote !== undefined ? { adminNote: patch.adminNote } : {}),
    },
    select: { id: true },
  });
  return ok(row);
}

/** How many notes are still waiting to be read, for the badge on the tab. */
export async function unreadFeedback(deps: FeedbackDeps): Promise<number> {
  return deps.prisma.feedback.count({ where: { status: 'NEW' } });
}
