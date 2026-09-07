import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  listFeedback,
  listMyFeedback,
  submitFeedback,
  unreadFeedback,
  updateFeedback,
} from '../src/application/feedback/Feedback.js';

/** The box is a relational table, so this runs against Postgres. */
const url =
  process.env.TEST_DATABASE_URL ?? 'postgresql://pokerstudio:pokerstudio_dev@localhost:5432/pokerstudio_test?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url } } });

const deps = { prisma, clock: { now: () => new Date() }, dailyLimit: 3 };

let userId: string;

const newUser = async (label: string) => {
  const user = await prisma.user.create({
    data: {
      email: `feedbacker-${label}-${randomUUID()}@example.com`,
      name: 'Feedbacker',
      countryCode: 'BR',
      language: 'pt-BR',
      referralCode: randomUUID().slice(0, 8).toUpperCase(),
    },
  });
  return user.id;
};

const note = (over: Record<string, unknown> = {}) => ({
  kind: 'SUGGESTION' as const,
  subject: 'A filter for the hand list',
  body: 'It would help to filter the hand list by position, so I can review every button hand at once.',
  ...over,
});

beforeEach(async () => {
  await prisma.feedback.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: 'feedbacker' } } });
  userId = await newUser('a');
});

afterAll(async () => {
  await prisma.feedback.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: 'feedbacker' } } });
  await prisma.$disconnect();
});

describe('feedback', () => {
  it('keeps a note whole, and gives it back to whoever wrote it', async () => {
    const result = await submitFeedback(deps, userId, note({ appSurface: 'replay' }));
    expect(result.ok).toBe(true);

    const mine = await listMyFeedback(deps, userId);
    expect(mine).toHaveLength(1);
    expect(mine[0].subject).toBe('A filter for the hand list');
    expect(mine[0].body).toContain('every button hand');
    expect(mine[0].status).toBe('NEW');
  });

  it('trims what was typed, so stray whitespace never reaches the box', async () => {
    await submitFeedback(deps, userId, note({ subject: '  Spacing  ', body: '  The board spacing setting is buried.  ' }));
    const [row] = await listMyFeedback(deps, userId);
    expect(row.subject).toBe('Spacing');
    expect(row.body).toBe('The board spacing setting is buried.');
  });

  it('stops one account from flooding the box in a day', async () => {
    for (let i = 0; i < 3; i++) expect((await submitFeedback(deps, userId, note())).ok).toBe(true);
    const blocked = await submitFeedback(deps, userId, note());
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('quota_exceeded');

    // The limit is per account: someone else can still write.
    const other = await newUser('b');
    expect((await submitFeedback(deps, userId === other ? userId : other, note())).ok).toBe(true);
  });

  it('shows one account only its own notes', async () => {
    const other = await newUser('c');
    await submitFeedback(deps, userId, note({ subject: 'Mine' }));
    await submitFeedback(deps, other, note({ subject: 'Theirs' }));
    expect((await listMyFeedback(deps, userId)).map((r) => r.subject)).toEqual(['Mine']);
    expect((await listMyFeedback(deps, other)).map((r) => r.subject)).toEqual(['Theirs']);
  });

  it('lets the team answer a note, and counts what is still unread', async () => {
    const created = await submitFeedback(deps, userId, note());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await unreadFeedback(deps)).toBe(1);

    const updated = await updateFeedback(deps, created.value.id, { status: 'PLANNED', adminNote: 'Next release.' });
    expect(updated.ok).toBe(true);
    expect(await unreadFeedback(deps)).toBe(0);

    const page = await listFeedback(deps, {});
    expect(page.total).toBe(1);
    expect(page.items[0].status).toBe('PLANNED');
    expect(page.items[0].adminNote).toBe('Next release.');
    expect(page.items[0].user?.id).toBe(userId);

    // And the sender sees where their note stands.
    expect((await listMyFeedback(deps, userId))[0].status).toBe('PLANNED');
  });

  it('filters the box by state, and says so when a note is gone', async () => {
    const a = await submitFeedback(deps, userId, note({ subject: 'One' }));
    await submitFeedback(deps, userId, note({ subject: 'Two' }));
    if (a.ok) await updateFeedback(deps, a.value.id, { status: 'DONE' });

    expect((await listFeedback(deps, { status: 'DONE' })).items.map((r) => r.subject)).toEqual(['One']);
    expect((await listFeedback(deps, { status: 'NEW' })).items.map((r) => r.subject)).toEqual(['Two']);

    const missing = await updateFeedback(deps, randomUUID(), { status: 'DONE' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('not_found');
  });

  it('keeps the note when the account that wrote it is deleted', async () => {
    await submitFeedback(deps, userId, note({ subject: 'Outlives the account' }));
    await prisma.user.delete({ where: { id: userId } });

    const page = await listFeedback(deps, {});
    expect(page.total).toBe(1);
    expect(page.items[0].subject).toBe('Outlives the account');
    expect(page.items[0].user).toBeNull();
  });
});
