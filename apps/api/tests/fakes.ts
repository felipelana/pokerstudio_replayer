import { createHash, randomUUID } from 'node:crypto';
import type {
  AccessLogInput,
  AccessLogRepository,
  ErrorLogInput,
  ErrorLogRepository,
  EmailTokenRepository,
  LoginAttemptRepository,
  ReferralRepository,
  SessionRepository,
  SkinRepository,
  UserRepository,
} from '../src/domain/repositories/index.js';
import type { User } from '../src/domain/entities/User.js';
import type { Session } from '../src/domain/entities/Session.js';
import type { Captcha, Clock, EmailSender, Hasher, TokenGenerator } from '../src/application/ports/index.js';

/** In-memory doubles so the use cases can be tested without a database. */

export function fakeUsers(seed: User[] = []): UserRepository & { all: User[] } {
  const all = [...seed];
  return {
    all,
    async findByEmail(email) {
      return all.find((u) => u.email === email.toLowerCase());
    },
    async findById(id) {
      return all.find((u) => u.id === id);
    },
    async findByReferralCode(code) {
      return all.find((u) => u.referralCode === code);
    },
    async create(input) {
      const user: User = {
        id: randomUUID(),
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        countryCode: input.countryCode,
        language: input.language,
        phoneE164: input.phoneE164,
        phoneCountry: input.phoneCountry,
        status: input.status,
        role: input.role,
        plan: 'FREE',
        referralCode: input.referralCode,
        referredById: input.referredById,
        termsAcceptedAt: input.termsAcceptedAt,
        marketingOptIn: input.marketingOptIn,
        createdAt: new Date(),
      };
      all.push(user);
      return user;
    },
    async update(id, patch) {
      const i = all.findIndex((u) => u.id === id);
      all[i] = { ...all[i], ...patch };
      return all[i];
    },
    async list({ page, pageSize }) {
      return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
    },
  };
}

export function fakeSessions(): SessionRepository & { all: (Session & { tokenHash: string })[] } {
  const all: (Session & { tokenHash: string })[] = [];
  return {
    all,
    async create(input) {
      const session = { id: randomUUID(), ...input };
      all.push(session);
      return session;
    },
    async findByTokenHash(tokenHash) {
      return all.find((s) => s.tokenHash === tokenHash);
    },
    async touch() {},
    async revoke(id) {
      const s = all.find((x) => x.id === id);
      if (s) s.revokedAt = new Date();
    },
    async revokeAllForUser(userId) {
      const live = all.filter((s) => s.userId === userId && !s.revokedAt);
      live.forEach((s) => (s.revokedAt = new Date()));
      return live.length;
    },
    async listForUser(userId) {
      return all.filter((s) => s.userId === userId);
    },
    async markTwoFactor(id, at) {
      const s = all.find((x) => x.id === id);
      if (s) s.twoFactorAt = at;
    },
  };
}

export function fakeTokens(): EmailTokenRepository & { all: { userId: string; type: string; tokenHash: string; expiresAt: Date; usedAt?: Date }[] } {
  const all: { userId: string; type: string; tokenHash: string; expiresAt: Date; usedAt?: Date }[] = [];
  return {
    all,
    async create(input) {
      all.push({ ...input });
    },
    async consume(tokenHash, type, now) {
      const row = all.find((t) => t.tokenHash === tokenHash && t.type === type && !t.usedAt && t.expiresAt > now);
      if (!row) return undefined;
      row.usedAt = now;
      return { userId: row.userId };
    },
  };
}

export function fakeLog(): AccessLogRepository & { entries: AccessLogInput[] } {
  const entries: AccessLogInput[] = [];
  return {
    entries,
    async record(input) {
      entries.push(input);
    },
    async list({ page, pageSize }) {
      const items = entries.map((e, i) => ({ ...e, id: String(i), createdAt: new Date() }));
      return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
    },
    async purgeOlderThan() {
      return 0;
    },
  };
}

export function fakeErrors(): ErrorLogRepository & { entries: ErrorLogInput[] } {
  const entries: ErrorLogInput[] = [];
  return {
    entries,
    async record(input) {
      entries.push(input);
    },
    async list({ page, pageSize }) {
      const items = entries.map((e, i) => ({ ...e, id: String(i), createdAt: new Date() }));
      return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
    },
    async find(id) {
      const found = entries[Number(id)];
      return found ? { ...found, id, createdAt: new Date() } : undefined;
    },
    async summarise() {
      const counts = new Map<string, number>();
      for (const e of entries) counts.set(e.level, (counts.get(e.level) ?? 0) + 1);
      return [...counts].map(([level, count]) => ({ level: level as ErrorLogInput['level'], count }));
    },
    async purgeOlderThan() {
      return 0;
    },
  };
}

export function fakeAttempts(): LoginAttemptRepository & { state: Map<string, { count: number; lockedUntil?: Date }> } {
  const state = new Map<string, { count: number; lockedUntil?: Date }>();
  return {
    state,
    async lockedUntil(key, now) {
      const row = state.get(key);
      return row?.lockedUntil && row.lockedUntil > now ? row.lockedUntil : undefined;
    },
    async registerFailure(key, now, maxAttempts, _windowMs, lockMs) {
      const row = state.get(key) ?? { count: 0 };
      row.count += 1;
      if (row.count >= maxAttempts) row.lockedUntil = new Date(now.getTime() + lockMs);
      state.set(key, row);
    },
    async clear(key) {
      state.delete(key);
    },
  };
}

export function fakeSkins(): SkinRepository {
  const all: { userId: string; skinId: string; name: string; data: unknown; isDefault: boolean; updatedAt: Date; id: string }[] = [];
  return {
    async listForUser(userId) {
      return all.filter((s) => s.userId === userId);
    },
    async save(input) {
      const existing = all.find((s) => s.userId === input.userId && s.skinId === input.skinId);
      const row = {
        id: existing?.id ?? randomUUID(),
        userId: input.userId,
        skinId: input.skinId,
        name: input.name,
        data: input.data,
        isDefault: !!input.isDefault,
        updatedAt: new Date(),
      };
      if (existing) Object.assign(existing, row);
      else all.push(row);
      return row;
    },
    async remove(userId, skinId) {
      const i = all.findIndex((s) => s.userId === userId && s.skinId === skinId);
      if (i >= 0) all.splice(i, 1);
    },
  };
}

export function fakeReferrals(): ReferralRepository & { accepted: string[] } {
  const accepted: string[] = [];
  return {
    accepted,
    async create() {},
    async listForUser() {
      return [];
    },
    async markAccepted(code, userId) {
      accepted.push(`${code}:${userId}`);
    },
  };
}

/** Deterministic doubles for the ports. */
export const fakeHasher: Hasher = {
  hash: async (plain) => `hashed:${plain}`,
  verify: async (hash, plain) => hash === `hashed:${plain}`,
};

export const fakeTokenGen: TokenGenerator = {
  create: () => randomUUID().replace(/-/g, ''),
  hash: (token) => createHash('sha256').update(token).digest('hex'),
};

export function fixedClock(iso = '2026-09-07T12:00:00Z'): Clock & { advance(ms: number): void } {
  let now = new Date(iso);
  return {
    now: () => now,
    advance(ms) {
      now = new Date(now.getTime() + ms);
    },
  };
}

export function fakeEmail(): EmailSender & { sent: { to: string; template: string; payload: Record<string, unknown> }[] } {
  const sent: { to: string; template: string; payload: Record<string, unknown> }[] = [];
  return {
    sent,
    async send({ to, template, payload }) {
      sent.push({ to, template, payload });
      return 'queued';
    },
  };
}

export const passCaptcha: Captcha = { verify: async () => true };
export const failCaptcha: Captcha = { verify: async () => false };
export const noBreach = { isBreached: async () => false };
export const fakeUa = { parse: () => ({ deviceType: 'DESKTOP', os: 'Windows', browser: 'Chrome', browserVersion: '120' }) };
export const fakeGeo = { countryFor: () => 'BR' };
