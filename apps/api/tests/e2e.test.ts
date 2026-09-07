import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/interface/http/server.js';
import { createContainer } from '../src/main-container.js';
import { loadConfig } from '../src/shared/config.js';

/**
 * End-to-end over the real stack: Fastify, the CSRF and cookie rules, the
 * Prisma repositories and PostgreSQL. Runs against `pokerstudio_test`.
 */
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://pokerstudio:pokerstudio_dev@localhost:5432/pokerstudio_test?schema=public';

const headers = { 'x-requested-with': 'XMLHttpRequest', 'content-type': 'application/json' };

let app: FastifyInstance;
let prisma: PrismaClient;

const account = {
  email: 'e2e@example.com',
  password: 'an-excellent-passphrase',
  name: 'E2E Player',
  countryCode: 'BR',
  language: 'pt-BR',
  acceptedTerms: true,
};

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  // Clean slate for a deterministic run.
  await prisma.$transaction([
    prisma.accessLog.deleteMany(),
    prisma.usageEvent.deleteMany(),
    prisma.userSkin.deleteMany(),
    prisma.session.deleteMany(),
    prisma.emailToken.deleteMany(),
    prisma.referral.deleteMany(),
    prisma.authIdentity.deleteMany(),
    prisma.loginAttempt.deleteMany(),
    prisma.emailOutbox.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL,
    SESSION_SECRET: 'test-session-secret-that-is-long-enough-ok',
    ENCRYPTION_KEY: '0'.repeat(64),
    APP_URL: 'http://localhost:5173',
    ADMIN_EMAILS: 'admin@pokerstudio.com.br',
    TURNSTILE_SECRET: '',
  } as NodeJS.ProcessEnv);

  const container = await createContainer(config, prisma);
  app = await buildServer(container);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
});

function sessionCookie(res: { cookies: { name: string; value: string }[] }): string {
  const c = res.cookies.find((x) => x.name === 'ps_session');
  return `ps_session=${c?.value ?? ''}`;
}

describe('http stack', () => {
  it('rejects a state-changing request without the CSRF header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: account.email, password: account.password },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('csrf');
  });

  it('signs up, logs in, reads /auth/me and logs out', async () => {
    const signup = await app.inject({ method: 'POST', url: '/api/v1/auth/signup', headers, payload: account });
    expect(signup.statusCode).toBe(201);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email: account.email, password: account.password },
    });
    expect(login.statusCode).toBe(200);
    const cookie = sessionCookie(login);
    expect(cookie).not.toBe('ps_session=');

    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(account.email);
    // The response never carries secrets.
    expect(JSON.stringify(me.json())).not.toContain('passwordHash');

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { 'x-requested-with': 'XMLHttpRequest', cookie },
    });
    expect(logout.statusCode).toBe(204);

    const after = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });

  it('answers the same for a known and an unknown address on forgot-password', async () => {
    const known = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', headers, payload: { email: account.email } });
    const unknown = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', headers, payload: { email: 'ghost@example.com' } });
    expect(known.statusCode).toBe(unknown.statusCode);
    expect(known.body).toBe(unknown.body);

    // …but only the real account produced a message.
    const queued = await prisma.emailOutbox.count({ where: { to: 'ghost@example.com' } });
    expect(queued).toBe(0);
  });

  it('keeps skins per user and refuses anonymous access', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/api/v1/skins' });
    expect(anonymous.statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email: account.email, password: account.password },
    });
    const cookie = sessionCookie(login);

    const saved = await app.inject({
      method: 'PUT',
      url: '/api/v1/skins',
      headers: { ...headers, cookie },
      payload: { skinId: 'my-felt', name: 'My felt', data: { felt: { color: '#101010' } } },
    });
    expect(saved.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: '/api/v1/skins', headers: { cookie } });
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].name).toBe('My felt');

    // Saving again with the same id overwrites instead of duplicating.
    await app.inject({
      method: 'PUT',
      url: '/api/v1/skins',
      headers: { ...headers, cookie },
      payload: { skinId: 'my-felt', name: 'Renamed felt', data: { felt: { color: '#202020' } } },
    });
    const second = await app.inject({ method: 'GET', url: '/api/v1/skins', headers: { cookie } });
    expect(second.json()).toHaveLength(1);
    expect(second.json()[0].name).toBe('Renamed felt');
  });

  it('refuses the admin area for a plain user', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email: account.email, password: account.password },
    });
    const cookie = sessionCookie(login);
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/users', headers: { cookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('forbidden');
  });

  it('refuses the admin area for an admin whose session has no second factor', async () => {
    const admin = { ...account, email: 'admin@pokerstudio.com.br', name: 'Admin' };
    await app.inject({ method: 'POST', url: '/api/v1/auth/signup', headers, payload: admin });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email: admin.email, password: admin.password },
    });
    const cookie = sessionCookie(login);
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/users', headers: { cookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('two_factor_required');
  });

  it('drops the session the moment the user is blocked', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers,
      payload: { email: account.email, password: account.password },
    });
    const cookie = sessionCookie(login);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } })).statusCode).toBe(200);

    await prisma.user.update({ where: { email: account.email }, data: { status: 'BLOCKED', blockedReason: 'test' } });
    const after = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);

    await prisma.user.update({ where: { email: account.email }, data: { status: 'ACTIVE', blockedReason: null } });
  });

  it('records access events with the device parsed on the server', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { ...headers, 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' },
      payload: { email: account.email, password: account.password },
    });
    const row = await prisma.accessLog.findFirst({ where: { event: 'LOGIN_OK' }, orderBy: { createdAt: 'desc' } });
    expect(row?.deviceType).toBe('MOBILE');
    expect(row?.browser).toBeTruthy();
    // No secret ever reaches the log.
    expect(JSON.stringify(row?.detail ?? {})).not.toContain(account.password);
  });
});
