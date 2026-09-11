import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticator } from 'otplib';
import {
  disableTotp,
  startTotpEnrollment,
  useRecoveryCode,
  verifyTotp,
} from '../../src/server/application/auth/TwoFactor.js';
import { createCipher, totpProvider } from '../../src/server/infrastructure/crypto/index.js';
import type {
  TwoFactorEnrollment,
  TwoFactorRepository,
} from '../../src/server/domain/repositories/index.js';
import type { User } from '../../src/server/domain/entities/User.js';
import { fakeLog, fakeSessions, fakeTokenGen, fixedClock } from './fakes.js';

/** In-memory stand-in for the TwoFactor and RecoveryCode tables. */
function fakeTwoFactor(): TwoFactorRepository & {
  row?: TwoFactorEnrollment;
  codes: { hash: string; usedAt?: Date }[];
} {
  const store: { row?: TwoFactorEnrollment; codes: { hash: string; usedAt?: Date }[] } = {
    codes: [],
  };
  return {
    ...store,
    get row() {
      return store.row;
    },
    get codes() {
      return store.codes;
    },
    async find() {
      return store.row;
    },
    async start({ secretEnc }) {
      store.row = { id: 'tf-1', secretEnc, confirmedAt: undefined, lastUsedStep: undefined };
    },
    async confirm(_userId, at, step) {
      if (store.row) {
        store.row.confirmedAt = at;
        store.row.lastUsedStep = step;
      }
    },
    async markStep(_userId, step) {
      if (store.row) store.row.lastUsedStep = step;
    },
    async remove() {
      store.row = undefined;
      store.codes = [];
    },
    async replaceRecoveryCodes(_userId, hashes) {
      store.codes = hashes.map((hash) => ({ hash }));
    },
    async consumeRecoveryCode(_userId, hash, at) {
      const row = store.codes.find((c) => c.hash === hash && !c.usedAt);
      if (!row) return false;
      row.usedAt = at;
      return true;
    },
    async countRecoveryCodes() {
      return store.codes.filter((c) => !c.usedAt).length;
    },
  };
}

const admin: User = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Administrator',
  countryCode: 'BR',
  language: 'pt-BR',
  status: 'ACTIVE',
  role: 'ADMIN',
  plan: 'FREE',
  referralCode: 'ADMIN123',
  marketingOptIn: false,
  createdAt: new Date('2026-01-01'),
};

function deps() {
  const twoFactor = fakeTwoFactor();
  const sessions = fakeSessions();
  const log = fakeLog();
  return {
    twoFactor,
    sessions,
    log,
    totp: totpProvider,
    clock: fixedClock(),
    tokenGen: fakeTokenGen,
    // A throwaway key: the point is that the seed is never stored in the clear.
    cipher: createCipher('11'.repeat(32)),
    issuer: 'PokerStudio Replayer',
  };
}

async function session(d: ReturnType<typeof deps>) {
  const created = await d.sessions.create({
    userId: admin.id,
    tokenHash: 'hash',
    expiresAt: new Date('2026-12-31'),
  });
  return created.id;
}

/** Reads the seed back out of the enrolment, the way the server does. */
function currentCode(d: ReturnType<typeof deps>): string {
  const secret = d.cipher.decrypt(d.twoFactor.row!.secretEnc!)!;
  return authenticator.generate(secret);
}

describe('two-factor enrolment', () => {
  it('hands the seed over once and stores it encrypted', async () => {
    const d = deps();
    const result = await startTotpEnrollment(d, admin);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.keyUri).toContain('otpauth://totp/');
    expect(result.value.keyUri).toContain('PokerStudio');
    const stored = d.twoFactor.row!.secretEnc!;
    expect(stored).not.toContain(result.value.secret);
    expect(d.cipher.decrypt(stored)).toBe(result.value.secret);
  });

  it('confirms with a valid code and returns ten recovery codes', async () => {
    const d = deps();
    await startTotpEnrollment(d, admin);
    const sessionId = await session(d);

    const result = await verifyTotp(d, { user: admin, sessionId, code: currentCode(d) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.confirmed).toBe(true);
    expect(result.value.recoveryCodes).toHaveLength(10);
    // The session is only marked once the code checks out.
    expect(d.sessions.all[0].twoFactorAt).toBeDefined();
    expect(d.log.entries.some((e) => e.event === 'TOTP_ENROLLED')).toBe(true);
  });

  it('refuses a wrong code and leaves the session unverified', async () => {
    const d = deps();
    await startTotpEnrollment(d, admin);
    const sessionId = await session(d);

    const result = await verifyTotp(d, { user: admin, sessionId, code: '000000' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('two_factor_invalid');
    expect(d.sessions.all[0].twoFactorAt).toBeUndefined();
    expect(d.log.entries.some((e) => e.event === 'TOTP_FAIL')).toBe(true);
  });

  it('refuses the same code twice — a replay is not a second login', async () => {
    const d = deps();
    await startTotpEnrollment(d, admin);
    const first = await session(d);
    const code = currentCode(d);
    await verifyTotp(d, { user: admin, sessionId: first, code });

    const second = await session(d);
    const replay = await verifyTotp(d, { user: admin, sessionId: second, code });
    expect(replay.ok).toBe(false);
    expect(d.sessions.all[1].twoFactorAt).toBeUndefined();
  });

  it('refuses to start again once it is enabled', async () => {
    const d = deps();
    await startTotpEnrollment(d, admin);
    await verifyTotp(d, { user: admin, sessionId: await session(d), code: currentCode(d) });

    const again = await startTotpEnrollment(d, admin);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('two_factor_already_enrolled');
  });

  it('refuses to verify when nothing was ever enrolled', async () => {
    const d = deps();
    const result = await verifyTotp(d, {
      user: admin,
      sessionId: await session(d),
      code: '123456',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('two_factor_not_enrolled');
  });
});

describe('recovery codes', () => {
  it('lets one code through exactly once', async () => {
    const d = deps();
    await startTotpEnrollment(d, admin);
    const enrol = await verifyTotp(d, {
      user: admin,
      sessionId: await session(d),
      code: currentCode(d),
    });
    if (!enrol.ok) throw new Error('setup failed');
    const [code] = enrol.value.recoveryCodes!;

    const used = await useRecoveryCode(d, { user: admin, sessionId: await session(d), code });
    expect(used.ok).toBe(true);
    if (used.ok) expect(used.value.remaining).toBe(9);

    const again = await useRecoveryCode(d, { user: admin, sessionId: await session(d), code });
    expect(again.ok).toBe(false);
  });

  it('accepts a code typed in lower case with spaces around it', async () => {
    const d = deps();
    await startTotpEnrollment(d, admin);
    const enrol = await verifyTotp(d, {
      user: admin,
      sessionId: await session(d),
      code: currentCode(d),
    });
    if (!enrol.ok) throw new Error('setup failed');

    const messy = `  ${enrol.value.recoveryCodes![1].toLowerCase()} `;
    const used = await useRecoveryCode(d, {
      user: admin,
      sessionId: await session(d),
      code: messy,
    });
    expect(used.ok).toBe(true);
  });
});

describe('turning it off', () => {
  afterEach(() => vi.useRealTimers());

  it('needs a valid code, and then clears the codes too', async () => {
    const d = deps();
    await startTotpEnrollment(d, admin);
    await verifyTotp(d, { user: admin, sessionId: await session(d), code: currentCode(d) });

    const refused = await disableTotp(d, { user: admin, code: '000000' });
    expect(refused.ok).toBe(false);
    expect(d.twoFactor.row).toBeDefined();

    // A fresh TOTP step, so the code is not the one the enrolment already burned.
    // Both otplib and the replay guard read the wall clock, so move that.
    vi.setSystemTime(new Date(Date.now() + 60_000));
    const done = await disableTotp(d, { user: admin, code: currentCode(d) });
    expect(done.ok).toBe(true);
    expect(d.twoFactor.row).toBeUndefined();
    expect(d.twoFactor.codes).toHaveLength(0);
  });
});
