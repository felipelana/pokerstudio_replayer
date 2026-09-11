import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteReview,
  getReview,
  listReviews,
  saveProgress,
  saveReview,
  uploadsToday,
} from '../../src/server/application/reviews/CloudReviews.js';

/** Reviews live entirely in relational tables, so this runs against Postgres. */
const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://pokerstudio:pokerstudio_dev@localhost:5432/pokerstudio_test?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url } } });

const deps = { prisma, clock: { now: () => new Date() }, dailyUploadLimit: 3 };

let userId: string;

beforeEach(async () => {
  await prisma.reviewSession.deleteMany({});
  await prisma.usageEvent.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: 'reviewer' } } });
  const user = await prisma.user.create({
    data: {
      email: `reviewer-${randomUUID()}@example.com`,
      name: 'Reviewer',
      countryCode: 'BR',
      language: 'pt-BR',
      referralCode: randomUUID().slice(0, 8).toUpperCase(),
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.reviewSession.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: 'reviewer' } } });
  await prisma.$disconnect();
});

const review = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  title: 'Sunday Storm',
  sourceFileName: 'HH20260907.txt',
  roomDetected: 'POKERSTARS',
  handCount: 2,
  storeHandHistory: true,
  hands: [
    {
      index: 0,
      handId: '2500000001',
      rawHistory: 'PokerStars Hand #2500000001',
      heroPosition: 'BTN',
      result: 'WON' as const,
      potWon: 1200,
      notes: [{ tags: ['sizing'], body: 'Bet too small on the turn.', includeInReport: true }],
    },
    {
      index: 1,
      handId: '2500000002',
      rawHistory: 'PokerStars Hand #2500000002',
      result: 'FOLDED' as const,
    },
  ],
  ...over,
});

describe('reviews in the cloud', () => {
  it('saves a review with its hands and notes, and reads it back', async () => {
    const input = review();
    const saved = await saveReview(deps, { userId, review: input });
    expect(saved.ok && saved.value.created).toBe(true);

    const got = await getReview(deps, userId, input.id);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.hands).toHaveLength(2);
    expect(got.value.hands[0].notes[0].body).toBe('Bet too small on the turn.');
    expect(got.value.hands[0].rawHistory).toContain('PokerStars Hand');
  });

  it('keeps no raw history when the user did not opt in', async () => {
    const input = review({ storeHandHistory: false });
    await saveReview(deps, { userId, review: input });

    const got = await getReview(deps, userId, input.id);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.storeHandHistory).toBe(false);
    expect(got.value.hands.every((h) => h.rawHistory === null)).toBe(true);
    // The shape of the review is still there.
    expect(got.value.hands[0].result).toBe('WON');
  });

  it('replaces the hands when the same review is pushed again', async () => {
    const input = review();
    await saveReview(deps, { userId, review: input });
    const again = await saveReview(deps, {
      userId,
      review: { ...input, handCount: 1, hands: [{ index: 0, handId: '2500000001', notes: [] }] },
    });

    expect(again.ok && again.value.created).toBe(false);
    const got = await getReview(deps, userId, input.id);
    expect(got.ok && got.value.hands).toHaveLength(1);
    // Pushing again is not a new upload.
    expect(await uploadsToday(deps, userId)).toBe(1);
  });

  it('stops at the daily upload limit but still accepts updates', async () => {
    const ids = [review(), review(), review()];
    for (const one of ids) expect((await saveReview(deps, { userId, review: one })).ok).toBe(true);

    const overLimit = await saveReview(deps, { userId, review: review() });
    expect(overLimit.ok).toBe(false);
    if (!overLimit.ok) expect(overLimit.error.code).toBe('quota_exceeded');

    // An existing review can still be saved — the limit counts new ones.
    expect((await saveReview(deps, { userId, review: { ...ids[0], title: 'Renamed' } })).ok).toBe(
      true,
    );
  });

  it('records progress and marks the review complete', async () => {
    const input = review();
    await saveReview(deps, { userId, review: input });

    expect(
      (
        await saveProgress(deps, {
          userId,
          id: input.id,
          currentHandIndex: 1,
          currentActionIndex: 4,
        })
      ).ok,
    ).toBe(true);
    const mid = await getReview(deps, userId, input.id);
    expect(mid.ok && mid.value.currentHandIndex).toBe(1);
    expect(mid.ok && mid.value.currentActionIndex).toBe(4);

    await saveProgress(deps, { userId, id: input.id, currentHandIndex: 1, status: 'COMPLETED' });
    const done = await getReview(deps, userId, input.id);
    expect(done.ok && done.value.status).toBe('COMPLETED');
    expect(done.ok && done.value.completedAt).not.toBeNull();
  });

  it('never shows or touches another account’s review', async () => {
    const input = review();
    await saveReview(deps, { userId, review: input });

    const other = await prisma.user.create({
      data: {
        email: `reviewer-other-${randomUUID()}@example.com`,
        name: 'Other',
        countryCode: 'BR',
        language: 'pt-BR',
        referralCode: randomUUID().slice(0, 8).toUpperCase(),
      },
    });

    expect((await getReview(deps, other.id, input.id)).ok).toBe(false);
    expect(
      (await saveProgress(deps, { userId: other.id, id: input.id, currentHandIndex: 9 })).ok,
    ).toBe(false);
    expect((await deleteReview(deps, other.id, input.id)).ok).toBe(false);

    const stolen = await saveReview(deps, {
      userId: other.id,
      review: { ...input, title: 'Mine now' },
    });
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) expect(stolen.error.code).toBe('forbidden');

    const listed = await listReviews(deps, other.id);
    expect(listed.ok && listed.value).toHaveLength(0);
  });

  it('deletes a review together with its hands and notes', async () => {
    const input = review();
    await saveReview(deps, { userId, review: input });
    expect((await deleteReview(deps, userId, input.id)).ok).toBe(true);
    expect(await prisma.handRecord.count()).toBe(0);
    expect(await prisma.reviewNote.count()).toBe(0);
  });
});
