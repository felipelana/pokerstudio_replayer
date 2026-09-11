import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server/interface/http/server.js';
import { createContainer } from '../../src/server/main-container.js';
import { loadConfig } from '../../src/server/shared/config.js';
import { tokenGenerator } from '../../src/server/infrastructure/crypto/index.js';

/**
 * The whole point of a coach link, exercised through HTTP: what a coach can
 * reach, what they cannot, and what happens the moment the link stops being
 * valid — including from a browser that was already open.
 */
const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://pokerstudio:pokerstudio_dev@localhost:5432/pokerstudio_test?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url } } });

let app: FastifyInstance;
let playerCookie: string;
let strangerCookie: string;
let reviewId: string;
let selfAssessmentId: string;

const PASSWORD = 'Ab3xKp7z';
/** Every write needs the header the CSRF guard looks for. */
const CSRF = { 'x-requested-with': 'XMLHttpRequest' } as const;
const sending = (cookie?: string) => ({ headers: { ...(cookie ? { cookie } : {}), ...CSRF } });

/** Opening a link is rate limited per address, so each coach gets their own. */
let machine = 0;
const fromOwnMachine = () => `10.0.${Math.floor(++machine / 250)}.${machine % 250}`;

/** The cookie a response sets, ready to send back on the next request. */
const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [String(raw ?? '')];
  return list.map((c) => c.split(';')[0]).join('; ');
};

async function signedInUser(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `coachtest-${label}-${randomUUID()}@example.com`,
      name: label,
      countryCode: 'BR',
      language: 'pt-BR',
      status: 'ACTIVE',
      referralCode: randomUUID().slice(0, 8).toUpperCase(),
    },
  });
  const token = tokenGenerator.create();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: tokenGenerator.hash(token),
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    },
  });
  return { id: user.id, cookie: `ps_session=${token}` };
}

beforeAll(async () => {
  process.env.DATABASE_URL = url;
  const config = loadConfig({
    ...process.env,
    DATABASE_URL: url,
    SESSION_SECRET: 'x'.repeat(32),
    ENCRYPTION_KEY: 'a'.repeat(64),
    NODE_ENV: 'test',
  } as NodeJS.ProcessEnv);
  const container = await createContainer(config, prisma);
  app = await buildServer(container);
  await app.ready();
});

beforeEach(async () => {
  await prisma.assessment.deleteMany({});
  await prisma.coachInvite.deleteMany({});
  await prisma.reviewSession.deleteMany({});
  await prisma.session.deleteMany({ where: { user: { email: { contains: 'coachtest' } } } });
  await prisma.user.deleteMany({ where: { email: { contains: 'coachtest' } } });

  const player = await signedInUser('player');
  const stranger = await signedInUser('stranger');
  playerCookie = player.cookie;
  strangerCookie = stranger.cookie;

  const session = await prisma.reviewSession.create({
    data: { userId: player.id, title: 'Sunday Storm', handCount: 3 },
  });
  reviewId = session.id;
  await prisma.handRecord.createMany({
    data: [
      { reviewSessionId: reviewId, index: 0, handId: 'h0', heroVpip: true },
      { reviewSessionId: reviewId, index: 1, handId: 'h1', heroVpip: true },
      { reviewSessionId: reviewId, index: 2, handId: 'h2', heroVpip: false },
    ],
  });

  const own = await app.inject({
    method: 'GET',
    url: `/api/v1/reviews/${reviewId}/assessment`,
    headers: { cookie: playerCookie },
  });
  selfAssessmentId = JSON.parse(own.body).assessment.id as string;
});

afterAll(async () => {
  await app.close();
  await prisma.assessment.deleteMany({});
  await prisma.coachInvite.deleteMany({});
  await prisma.reviewSession.deleteMany({});
  await prisma.session.deleteMany({ where: { user: { email: { contains: 'coachtest' } } } });
  await prisma.user.deleteMany({ where: { email: { contains: 'coachtest' } } });
  await prisma.$disconnect();
});

/** Invite a coach and sign them in, returning their cookie and the invite. */
async function inviteAndOpen(coachName: string) {
  const created = await app.inject({
    method: 'POST',
    url: `/api/v1/reviews/${reviewId}/invites`,
    ...sending(playerCookie),
    payload: { coachName, password: PASSWORD },
  });
  expect(created.statusCode, created.body).toBe(201);
  const invite = JSON.parse(created.body) as { id: string; token: string; expiresAt: string };

  const opened = await app.inject({
    method: 'POST',
    url: '/api/v1/coach/open',
    remoteAddress: fromOwnMachine(),
    ...sending(),
    payload: { token: invite.token, password: PASSWORD },
  });
  expect(opened.statusCode, opened.body).toBe(200);
  return { invite, cookie: cookieOf(opened) };
}

describe('the coach gets one review and nothing else', () => {
  it('a cookie from one link does not answer for another link', async () => {
    const first = await inviteAndOpen('Ana');
    const second = await inviteAndOpen('Bruno');

    // The address names the link; the cookie names the invitation. When the two
    // disagree, the browser is treated as not signed in at all.
    const mismatch = await app.inject({
      method: 'GET',
      url: `/api/v1/coach/session?token=${second.invite.token}`,
      headers: { cookie: first.cookie },
    });
    expect(mismatch.statusCode).toBe(401);

    const match = await app.inject({
      method: 'GET',
      url: `/api/v1/coach/session?token=${first.invite.token}`,
      headers: { cookie: first.cookie },
    });
    expect(match.statusCode).toBe(200);
  });

  it('a link for one hand hands over that hand and no other', async () => {
    await prisma.reviewSession.update({
      where: { id: reviewId },
      data: { storeHandHistory: true },
    });
    for (const index of [0, 1, 2]) {
      await prisma.handRecord.update({
        where: { reviewSessionId_index: { reviewSessionId: reviewId, index } },
        data: { rawHistory: `PokerStars Hand #${index}: ...` },
      });
    }

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${reviewId}/invites`,
      ...sending(playerCookie),
      payload: { coachName: 'Ana', password: PASSWORD, handIndex: 1 },
    });
    expect(created.statusCode, created.body).toBe(201);
    const invite = JSON.parse(created.body) as { token: string; handIndex: number };
    expect(invite.handIndex).toBe(1);

    const opened = await app.inject({
      method: 'POST',
      url: '/api/v1/coach/open',
      remoteAddress: fromOwnMachine(),
      ...sending(),
      payload: { token: invite.token, password: PASSWORD },
    });
    const cookie = cookieOf(opened);

    const hands = await app.inject({
      method: 'GET',
      url: '/api/v1/coach/hands',
      headers: { cookie },
    });
    const body = JSON.parse(hands.body);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].index).toBe(1);

    // And the screen is told, so it can say so rather than looking empty.
    const seen = await app.inject({
      method: 'GET',
      url: '/api/v1/coach/session',
      headers: { cookie },
    });
    expect(JSON.parse(seen.body).handIndex).toBe(1);
  });

  it('refuses a link for a hand the review does not have', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${reviewId}/invites`,
      ...sending(playerCookie),
      payload: { coachName: 'Ana', password: PASSWORD, handIndex: 99 },
    });
    // A hand that does not exist is a validation problem, not a missing route.
    expect(created.statusCode).toBe(422);
  });

  it('reads the hands only when the player kept the histories', async () => {
    const { cookie } = await inviteAndOpen('Ana');

    const withheld = await app.inject({
      method: 'GET',
      url: '/api/v1/coach/hands',
      headers: { cookie },
    });
    expect(withheld.statusCode).toBe(200);
    expect(JSON.parse(withheld.body)).toEqual({ stored: false, items: [] });

    await prisma.reviewSession.update({
      where: { id: reviewId },
      data: { storeHandHistory: true },
    });
    await prisma.handRecord.update({
      where: { reviewSessionId_index: { reviewSessionId: reviewId, index: 0 } },
      data: { rawHistory: 'PokerStars Hand #1: ...' },
    });

    const shared = await app.inject({
      method: 'GET',
      url: '/api/v1/coach/hands',
      headers: { cookie },
    });
    const body = JSON.parse(shared.body);
    expect(body.stored).toBe(true);
    // Only the row that actually carries a history travels.
    expect(body.items).toHaveLength(1);
    expect(body.items[0].index).toBe(0);
  });

  it('opens with the link and the password, and sees the session and the player', async () => {
    const { cookie } = await inviteAndOpen('Ana');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/coach/session',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.coachName).toBe('Ana');
    expect(body.session.title).toBe('Sunday Storm');
    expect(body.player).toBe('player');
    expect(JSON.stringify(body)).not.toContain(PASSWORD);
  });

  it('is turned away from every part of the product that is not their review', async () => {
    const { cookie } = await inviteAndOpen('Ana');
    const forbidden = [
      '/api/v1/auth/me',
      '/api/v1/reviews',
      '/api/v1/skins',
      '/api/v1/admin/users',
      `/api/v1/reviews/${reviewId}/assessments`,
      `/api/v1/reviews/${reviewId}/invites`,
      `/api/v1/assessments/${selfAssessmentId}`,
    ];
    for (const url of forbidden) {
      const res = await app.inject({ method: 'GET', url, headers: { cookie } });
      expect([401, 403, 404], `${url} answered ${res.statusCode}`).toContain(res.statusCode);
    }
  });

  it('cannot touch the player self-assessment, even knowing its id', async () => {
    const { cookie } = await inviteAndOpen('Ana');
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/assessments/${selfAssessmentId}/hands/0`,
      ...sending(cookie),
      payload: { score: 5 },
    });
    expect([401, 403, 404]).toContain(res.statusCode);
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/assessments/${selfAssessmentId}`,
      headers: { cookie: playerCookie },
    });
    expect(JSON.parse(detail.body).rows[0].assessment).toBeNull();
  });

  it('never sees another coach, and the player sees both', async () => {
    const ana = await inviteAndOpen('Ana');
    const bruno = await inviteAndOpen('Bruno');
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/coach/assessment/hands/0',
      ...sending(ana.cookie),
      payload: { score: 20, comment: 'muito solto' },
    });
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/coach/assessment/hands/0',
      ...sending(bruno.cookie),
      payload: { score: 90 },
    });

    const anaSees = JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/coach/assessment',
          headers: { cookie: ana.cookie },
        })
      ).body,
    );
    expect(anaSees.rows[0].assessment.score).toBe(20);
    // Bruno's 90 is nowhere in what Ana receives — checked on the rows, not
    // on the raw text, where a uuid can happen to contain the digits.
    expect(anaSees.assessment.invite.coachName).toBe('Ana');
    expect(
      anaSees.rows.every(
        (r: { assessment: { score: number } | null }) =>
          r.assessment === null || r.assessment.score === 20,
      ),
    ).toBe(true);
    expect(anaSees.summary.score).toEqual({ value: 20, scored: 1 });
    expect(JSON.stringify(anaSees)).not.toContain('Bruno');

    const player = JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/reviews/${reviewId}/assessments`,
          headers: { cookie: playerCookie },
        })
      ).body,
    );
    expect(player.items).toHaveLength(3);
    expect(
      player.items
        .map((i: { summary: { score: { value: number | null } } }) => i.summary.score.value)
        .sort(),
    ).toEqual([20, 90, null]);
  });

  it('lets the player read a coach but never rewrite one', async () => {
    const ana = await inviteAndOpen('Ana');
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/coach/assessment/hands/0',
      ...sending(ana.cookie),
      payload: { score: 33, tags: ['sizing'] },
    });
    const coachAssessmentId = JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/reviews/${reviewId}/assessments`,
          headers: { cookie: playerCookie },
        })
      ).body,
    ).items.find((i: { role: string }) => i.role === 'COACH').id as string;

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/assessments/${coachAssessmentId}`,
      headers: { cookie: playerCookie },
    });
    expect(read.statusCode).toBe(200);
    expect(JSON.parse(read.body).rows[0].assessment.score).toBe(33);

    const write = await app.inject({
      method: 'PATCH',
      url: `/api/v1/assessments/${coachAssessmentId}/hands/0`,
      ...sending(playerCookie),
      payload: { score: 100 },
    });
    expect(write.statusCode).toBe(403);
    expect(
      JSON.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/assessments/${coachAssessmentId}`,
            headers: { cookie: playerCookie },
          })
        ).body,
      ).rows[0].assessment.score,
    ).toBe(33);
  });

  it('keeps a stranger out of the review entirely', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reviews/${reviewId}/assessments`,
      headers: { cookie: strangerCookie },
    });
    expect(res.statusCode).toBe(404);
    const write = await app.inject({
      method: 'PATCH',
      url: `/api/v1/assessments/${selfAssessmentId}/hands/0`,
      ...sending(strangerCookie),
      payload: { score: 1 },
    });
    expect(write.statusCode).toBe(404);
  });
});

describe('when the link stops being valid', () => {
  it('shuts a browser that is already open, on the very next request', async () => {
    const { invite, cookie } = await inviteAndOpen('Ana');
    // The coach is in and working.
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/coach/session', headers: { cookie } }))
        .statusCode,
    ).toBe(200);

    await prisma.coachInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/coach/session',
      headers: { cookie },
    });
    expect(after.statusCode).toBe(403);
    expect(JSON.parse(after.body).code).toBe('share_expired');

    const write = await app.inject({
      method: 'PATCH',
      url: '/api/v1/coach/assessment/hands/0',
      ...sending(cookie),
      payload: { score: 50 },
    });
    expect(write.statusCode).toBe(403);
  });

  it('closes at once when revoked, and keeps every word already written', async () => {
    const { invite, cookie } = await inviteAndOpen('Ana');
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/coach/assessment/hands/1',
      ...sending(cookie),
      payload: { score: 65, comment: 'fold aqui' },
    });

    const revoked = await app.inject({
      method: 'POST',
      url: `/api/v1/invites/${invite.id}/revoke`,
      ...sending(playerCookie),
    });
    expect(revoked.statusCode).toBe(200);

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/coach/assessment',
      headers: { cookie },
    });
    expect(after.statusCode).toBe(403);
    expect(JSON.parse(after.body).code).toBe('share_revoked');

    // The player still has everything the coach wrote.
    const player = JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/reviews/${reviewId}/assessments`,
          headers: { cookie: playerCookie },
        })
      ).body,
    );
    const coach = player.items.find((i: { role: string }) => i.role === 'COACH');
    expect(coach.summary.score.value).toBe(65);
    // Revoked is not finished: the reading stays where it was.
    expect(coach.status).toBe('IN_PROGRESS');
  });

  it('refuses the wrong password and the wrong token alike', async () => {
    const { invite } = await inviteAndOpen('Ana');
    const attacker = fromOwnMachine();
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/coach/open',
      remoteAddress: attacker,
      ...sending(),
      payload: { token: invite.token, password: 'Zz9yQw4m' },
    });
    expect(wrongPassword.statusCode).toBe(401);
    const wrongToken = await app.inject({
      method: 'POST',
      url: '/api/v1/coach/open',
      remoteAddress: attacker,
      ...sending(),
      payload: { token: 'x'.repeat(32), password: PASSWORD },
    });
    expect(wrongToken.statusCode).toBe(401);
  });

  it('refuses a password that breaks the rule, and says which rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${reviewId}/invites`,
      ...sending(playerCookie),
      payload: { coachName: 'Ana', password: 'ab34kpzz' },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).title).toContain('sequência');
  });
});

describe('finishing, over HTTP', () => {
  it('locks the coach out of their own reading, with the link still live', async () => {
    const { invite, cookie } = await inviteAndOpen('Ana');
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/coach/assessment/hands/0',
      ...sending(cookie),
      payload: { score: 70 },
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/coach/assessment/complete',
          ...sending(cookie),
        })
      ).statusCode,
    ).toBe(200);

    const blocked = await app.inject({
      method: 'PATCH',
      url: '/api/v1/coach/assessment/hands/1',
      ...sending(cookie),
      payload: { score: 10 },
    });
    expect(blocked.statusCode).toBe(409);
    expect(JSON.parse(blocked.body).code).toBe('assessment_completed');

    // The link itself is still perfectly valid; the reading is what is closed.
    const state = await prisma.coachInvite.findUnique({ where: { id: invite.id } });
    expect(state?.revokedAt).toBeNull();
    expect(state!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/coach/session', headers: { cookie } }))
        .statusCode,
    ).toBe(200);
  });

  it('does not finish anyone else when one assessor finishes', async () => {
    const ana = await inviteAndOpen('Ana');
    await app.inject({
      method: 'POST',
      url: '/api/v1/coach/assessment/complete',
      ...sending(ana.cookie),
    });

    const stillOpen = await app.inject({
      method: 'PATCH',
      url: `/api/v1/assessments/${selfAssessmentId}/hands/0`,
      ...sending(playerCookie),
      payload: { score: 44 },
    });
    expect(stillOpen.statusCode).toBe(200);
  });
});
