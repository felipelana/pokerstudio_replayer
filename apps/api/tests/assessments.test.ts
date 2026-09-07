import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assessmentDetail,
  coachAssessment,
  completeAssessment,
  saveAssessmentProgress,
  saveHandAssessment,
  selfAssessment,
  sessionAssessments,
} from '../src/application/assessments/Assessments.js';
import {
  createInvite,
  inviteState,
  listInvites,
  openInvite,
  revokeInvite,
  saveShareSettings,
  shareSettings,
} from '../src/application/assessments/CoachInvites.js';
import { argon2Hasher } from '../src/infrastructure/crypto/index.js';

const url =
  process.env.TEST_DATABASE_URL ?? 'postgresql://pokerstudio:pokerstudio_dev@localhost:5432/pokerstudio_test?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url } } });

let now = new Date('2026-09-07T12:00:00Z');
const clock = { now: () => now };

// The real hasher, because one of these tests is about what actually reaches
// the database — a stand-in would only be testing itself.
const hasher = argon2Hasher;

const deps = { prisma, clock };
const inviteDeps = { prisma, clock, hasher };

let userId: string;
let otherUserId: string;
let sessionId: string;

/** A session of four hands: three the hero played, one they folded. */
async function seedSession(ownerId: string) {
  const session = await prisma.reviewSession.create({
    data: { userId: ownerId, title: 'Sunday Storm', handCount: 4 },
  });
  await prisma.handRecord.createMany({
    data: [
      { reviewSessionId: session.id, index: 0, handId: 'h0', heroVpip: true },
      { reviewSessionId: session.id, index: 1, handId: 'h1', heroVpip: true },
      { reviewSessionId: session.id, index: 2, handId: 'h2', heroVpip: true },
      { reviewSessionId: session.id, index: 3, handId: 'h3', heroVpip: false },
    ],
  });
  return session.id;
}

const newUser = async (label: string) => {
  const user = await prisma.user.create({
    data: {
      email: `assessor-${label}-${randomUUID()}@example.com`,
      name: 'Assessor',
      countryCode: 'BR',
      language: 'pt-BR',
      referralCode: randomUUID().slice(0, 8).toUpperCase(),
    },
  });
  return user.id;
};

beforeEach(async () => {
  now = new Date('2026-09-07T12:00:00Z');
  await prisma.assessment.deleteMany({});
  await prisma.coachInvite.deleteMany({});
  await prisma.reviewSession.deleteMany({});
  await prisma.shareSettings.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: 'assessor' } } });
  userId = await newUser('player');
  otherUserId = await newUser('stranger');
  sessionId = await seedSession(userId);
});

afterAll(async () => {
  await prisma.assessment.deleteMany({});
  await prisma.coachInvite.deleteMany({});
  await prisma.reviewSession.deleteMany({});
  await prisma.shareSettings.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: 'assessor' } } });
  await prisma.$disconnect();
});

/** Invite a coach and get straight to their own assessment. */
async function inviteCoach(name: string, password = 'Ab3xKp7z') {
  const created = await createInvite(inviteDeps, userId, { reviewSessionId: sessionId, coachName: name, password });
  if (!created.ok) throw new Error(created.error.message);
  const assessment = await coachAssessment(deps, created.value.id);
  return { invite: created.value, assessment: assessment! };
}

describe('one session, several readings', () => {
  it('gives the player one self-assessment and keeps giving them the same one', async () => {
    const first = await selfAssessment(deps, userId, sessionId);
    const second = await selfAssessment(deps, userId, sessionId);
    expect(first?.id).toBe(second?.id);
    expect(first?.role).toBe('SELF');
    expect(await prisma.assessment.count({ where: { reviewSessionId: sessionId } })).toBe(1);
  });

  it('refuses a session that belongs to someone else', async () => {
    expect(await selfAssessment(deps, otherUserId, sessionId)).toBeUndefined();
  });

  it('keeps the self-assessment untouched when the session is shared', async () => {
    const self = await selfAssessment(deps, userId, sessionId);
    await saveHandAssessment(deps, self!.id, 0, { score: 70, comment: 'thin value' });

    await inviteCoach('Ana');

    const after = await assessmentDetail(deps, self!.id);
    expect(after?.rows[0].assessment?.score).toBe(70);
    expect(after?.rows[0].assessment?.comment).toBe('thin value');
  });

  it('keeps two coaches of the same name apart', async () => {
    const a = await inviteCoach('João');
    const b = await inviteCoach('João');
    expect(a.assessment.id).not.toBe(b.assessment.id);

    await saveHandAssessment(deps, a.assessment.id, 0, { score: 20 });
    await saveHandAssessment(deps, b.assessment.id, 0, { score: 90 });

    expect((await assessmentDetail(deps, a.assessment.id))?.rows[0].assessment?.score).toBe(20);
    expect((await assessmentDetail(deps, b.assessment.id))?.rows[0].assessment?.score).toBe(90);
  });

  it('remembers where each assessor stopped, separately', async () => {
    const self = await selfAssessment(deps, userId, sessionId);
    const coach = await inviteCoach('Ana');
    await saveAssessmentProgress(deps, self!.id, { handIndex: 3, frameIndex: 12 });
    await saveAssessmentProgress(deps, coach.assessment.id, { handIndex: 1, frameIndex: 4 });

    const all = await sessionAssessments(deps, userId, sessionId);
    const mine = all?.items.find((i) => i.role === 'SELF');
    const theirs = all?.items.find((i) => i.role === 'COACH');
    expect([mine?.currentHandIndex, mine?.currentFrameIndex]).toEqual([3, 12]);
    expect([theirs?.currentHandIndex, theirs?.currentFrameIndex]).toEqual([1, 4]);
  });

  it('shows the player every reading, coaches included, as they are saved', async () => {
    const self = await selfAssessment(deps, userId, sessionId);
    const coach = await inviteCoach('Ana');
    await saveHandAssessment(deps, self!.id, 0, { score: 60 });
    await saveHandAssessment(deps, coach.assessment.id, 0, { score: 40 });

    const all = await sessionAssessments(deps, userId, sessionId);
    expect(all?.items).toHaveLength(2);
    expect(all?.items.find((i) => i.role === 'COACH')?.coachName).toBe('Ana');
    // Still in progress, and already visible to the player.
    expect(all?.items.every((i) => i.status === 'IN_PROGRESS')).toBe(true);
    expect(all?.items.map((i) => i.summary.score.value).sort()).toEqual([40, 60]);
  });
});

describe('the numbers on a real session', () => {
  it('counts coverage against the hands the hero played, and scores what was scored', async () => {
    const self = await selfAssessment(deps, userId, sessionId);
    await saveHandAssessment(deps, self!.id, 0, { score: 80 });
    await saveHandAssessment(deps, self!.id, 1, { markedOk: true });
    await saveHandAssessment(deps, self!.id, 3, { score: 40 }); // the folded hand

    const detail = await assessmentDetail(deps, self!.id);
    expect(detail?.summary.coverage).toEqual({ reviewed: 2, total: 3, percent: (2 / 3) * 100 });
    expect(detail?.summary.pending).toBe(1);
    // The folded hand carries a score, so it counts towards the score only.
    expect(detail?.summary.score).toEqual({ value: 60, scored: 2 });
  });

  it('holds a score of zero apart from no score at all', async () => {
    const self = await selfAssessment(deps, userId, sessionId);
    await saveHandAssessment(deps, self!.id, 0, { score: 0 });
    await saveHandAssessment(deps, self!.id, 1, { comment: 'come back to this' });

    const detail = await assessmentDetail(deps, self!.id);
    expect(detail?.rows[0].assessment?.score).toBe(0);
    expect(detail?.rows[1].assessment?.score).toBeNull();
    expect(detail?.summary.score).toEqual({ value: 0, scored: 1 });
    expect(detail?.summary.coverage.reviewed).toBe(2);
  });

  it('refuses a score outside 0 to 100', async () => {
    const self = await selfAssessment(deps, userId, sessionId);
    const tooHigh = await saveHandAssessment(deps, self!.id, 0, { score: 101 });
    const negative = await saveHandAssessment(deps, self!.id, 0, { score: -1 });
    expect(tooHigh.ok).toBe(false);
    expect(negative.ok).toBe(false);
  });
});

describe('finishing', () => {
  it('locks the reading for good, and says why', async () => {
    const self = await selfAssessment(deps, userId, sessionId);
    await saveHandAssessment(deps, self!.id, 0, { score: 55 });
    expect((await completeAssessment(deps, self!.id)).ok).toBe(true);

    const blocked = await saveHandAssessment(deps, self!.id, 1, { score: 90 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('assessment_completed');

    // Not by finishing it again, either.
    expect((await completeAssessment(deps, self!.id)).ok).toBe(false);
    // And the hand that was never scored stays unscored.
    expect((await assessmentDetail(deps, self!.id))?.summary.score.scored).toBe(1);
  });

  it('finishes one coach without touching anyone else', async () => {
    const self = await selfAssessment(deps, userId, sessionId);
    const ana = await inviteCoach('Ana');
    const bruno = await inviteCoach('Bruno');
    await completeAssessment(deps, ana.assessment.id);

    const all = await sessionAssessments(deps, userId, sessionId);
    const byName = (name?: string) => all?.items.find((i) => i.coachName === name);
    expect(byName('Ana')?.status).toBe('COMPLETED');
    expect(byName('Bruno')?.status).toBe('NOT_STARTED');
    expect(all?.items.find((i) => i.role === 'SELF')?.status).toBe('NOT_STARTED');

    // The others can still write.
    expect((await saveHandAssessment(deps, bruno.assessment.id, 0, { score: 70 })).ok).toBe(true);
    expect((await saveHandAssessment(deps, self!.id, 0, { score: 70 })).ok).toBe(true);
  });

  it('keeps a finished reading locked even while the link is still live', async () => {
    const ana = await inviteCoach('Ana');
    await completeAssessment(deps, ana.assessment.id);
    expect((await inviteState(inviteDeps, ana.invite.id)).state).toBe('ok');
    expect((await saveHandAssessment(deps, ana.assessment.id, 0, { score: 10 })).ok).toBe(false);
  });
});

describe('the way in for a coach', () => {
  it('hands the password over once and stores only its hash', async () => {
    const { invite } = await inviteCoach('Ana', 'Ab3xKp7z');
    const row = await prisma.coachInvite.findUnique({ where: { id: invite.id } });
    expect(row?.passwordHash).not.toContain('Ab3xKp7z');
    expect(invite.token).toHaveLength(32);
    // The token is what travels; the password is not part of it.
    expect(invite.token).not.toContain('Ab3xKp7z');
  });

  it('refuses a password that breaks the rule, naming the rule', async () => {
    const weak = await createInvite(inviteDeps, userId, { reviewSessionId: sessionId, coachName: 'Ana', password: 'ab34kpzz' });
    expect(weak.ok).toBe(false);
    if (!weak.ok) expect(weak.error.message).toContain('sequência');
  });

  it('opens only with the right token and password', async () => {
    const { invite } = await inviteCoach('Ana', 'Ab3xKp7z');
    expect((await openInvite(inviteDeps, invite.token, 'Ab3xKp7z')).ok).toBe(true);
    expect((await openInvite(inviteDeps, invite.token, 'Zz9yQw4m')).ok).toBe(false);
    expect((await openInvite(inviteDeps, 'not-a-token', 'Ab3xKp7z')).ok).toBe(false);
  });

  it('closes at the deadline, for a fresh visit and for a browser left open', async () => {
    const { invite } = await inviteCoach('Ana');
    now = new Date(invite.expiresAt.getTime() + 1000);

    const reopened = await openInvite(inviteDeps, invite.token, 'Ab3xKp7z');
    expect(reopened.ok).toBe(false);
    if (!reopened.ok) expect(reopened.error.code).toBe('share_expired');
    // The same check answers a request from a session that was already open.
    expect((await inviteState(inviteDeps, invite.id)).state).toBe('expired');
  });

  it('closes at once when revoked, and keeps everything already written', async () => {
    const { invite, assessment } = await inviteCoach('Ana');
    await saveHandAssessment(deps, assessment.id, 0, { score: 65, comment: 'fold here' });

    expect((await revokeInvite(inviteDeps, userId, invite.id)).ok).toBe(true);
    expect((await inviteState(inviteDeps, invite.id)).state).toBe('revoked');
    expect((await openInvite(inviteDeps, invite.token, 'Ab3xKp7z')).ok).toBe(false);

    const detail = await assessmentDetail(deps, assessment.id);
    expect(detail?.rows[0].assessment?.score).toBe(65);
    expect(detail?.rows[0].assessment?.comment).toBe('fold here');
    // Expired or revoked, a partial reading stays partial — not completed.
    expect(detail?.assessment.status).toBe('IN_PROGRESS');
  });

  it('lets only the player who made a link revoke it', async () => {
    const { invite } = await inviteCoach('Ana');
    expect((await revokeInvite(inviteDeps, otherUserId, invite.id)).ok).toBe(false);
    expect((await inviteState(inviteDeps, invite.id)).state).toBe('ok');
  });

  it('shows the player their links and refuses a stranger', async () => {
    await inviteCoach('Ana');
    expect((await listInvites(inviteDeps, userId, sessionId))).toHaveLength(1);
    expect(await listInvites(inviteDeps, otherUserId, sessionId)).toBeUndefined();
  });
});

describe('how long a link may last', () => {
  it('starts at a day, and no further than a week', async () => {
    expect(await shareSettings(prisma)).toEqual({ defaultHours: 24, maxHours: 168 });
    const { invite } = await inviteCoach('Ana');
    expect(invite.expiresAt.getTime() - now.getTime()).toBe(24 * 3600_000);
  });

  it('refuses a deadline past the limit, and names the limit', async () => {
    const tooFar = await createInvite(inviteDeps, userId, {
      reviewSessionId: sessionId,
      coachName: 'Ana',
      password: 'Ab3xKp7z',
      expiresAt: new Date(now.getTime() + 8 * 24 * 3600_000),
    });
    expect(tooFar.ok).toBe(false);
    if (!tooFar.ok) expect(tooFar.error.message).toContain('168');
  });

  it('applies a new limit to new links only', async () => {
    const before = await inviteCoach('Ana');
    expect((await saveShareSettings(prisma, { defaultHours: 2, maxHours: 6 })).ok).toBe(true);

    const after = await inviteCoach('Bruno');
    expect(after.invite.expiresAt.getTime() - now.getTime()).toBe(2 * 3600_000);
    // The link made under the old settings keeps the deadline it was given.
    const stored = await prisma.coachInvite.findUnique({ where: { id: before.invite.id } });
    expect(stored).toBeTruthy();
    expect(stored ? stored.expiresAt.getTime() - now.getTime() : 0).toBe(24 * 3600_000);
  });

  it('refuses a default longer than the maximum', async () => {
    expect((await saveShareSettings(prisma, { defaultHours: 48, maxHours: 24 })).ok).toBe(false);
  });
});
