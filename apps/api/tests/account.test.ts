import { describe, expect, it } from 'vitest';
import { COUNTRIES, LANGUAGE_CODES } from '@pokerstudio/shared';
import {
  changePassword,
  deleteAccount,
  exportAccount,
  setFirstPassword,
  updateProfile,
} from '../src/application/account/ManageAccount.js';
import type { User } from '../src/domain/entities/User.js';
import {
  fakeHasher,
  fakeLog,
  fakeReferrals,
  fakeSessions,
  fakeSkins,
  fakeUsers,
  fixedClock,
  noBreach,
} from './fakes.js';

function deps() {
  const users = fakeUsers();
  const sessions = fakeSessions();
  const identities = {
    rows: [] as { userId: string; provider: string }[],
    async find() {
      return undefined;
    },
    async link(input: { userId: string; provider: string }) {
      this.rows.push(input);
    },
    async unlink(userId: string, provider: string) {
      this.rows = this.rows.filter((r) => !(r.userId === userId && r.provider === provider));
    },
    async listForUser(userId: string) {
      return this.rows.filter((r) => r.userId === userId).map((r) => r.provider as 'GOOGLE');
    },
  };
  return {
    users,
    sessions,
    identities: identities as never,
    skins: fakeSkins(),
    referrals: fakeReferrals(),
    log: fakeLog(),
    hasher: fakeHasher,
    clock: fixedClock(),
    breach: noBreach,
    countries: COUNTRIES.map((c) => c.code),
    languages: LANGUAGE_CODES,
    raw: { users, sessions, identities },
  };
}

async function account(d: ReturnType<typeof deps>, over: Partial<User> = {}): Promise<User> {
  const user = await d.users.create({
    email: 'player@example.com',
    name: 'Player',
    passwordHash: 'hashed:the-old-passphrase',
    countryCode: 'BR',
    language: 'pt-BR',
    referralCode: 'ABCDEFGH',
    marketingOptIn: false,
    role: 'USER',
    status: 'ACTIVE',
  });
  return Object.keys(over).length ? d.users.update(user.id, over) : user;
}

describe('profile', () => {
  it('saves the fields the owner may change', async () => {
    const d = deps();
    const user = await account(d);
    const result = await updateProfile(d, {
      user,
      patch: { name: '  Felipe  ', countryCode: 'PT', language: 'en', phone: '+55 11 91234-5678', marketingOptIn: true },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Felipe');
    expect(result.value.countryCode).toBe('PT');
    expect(result.value.phoneE164).toBe('+5511912345678');
    expect(d.log.entries.some((e) => e.event === 'PROFILE_UPDATED')).toBe(true);
  });

  it('clears the phone when it is sent empty', async () => {
    const d = deps();
    const user = await account(d, { phoneE164: '+5511912345678' });
    const result = await updateProfile(d, { user, patch: { phone: '' } });
    expect(result.ok && result.value.phoneE164).toBeUndefined();
  });

  it('refuses a country and a language outside the lists, and a one-letter name', async () => {
    const d = deps();
    const user = await account(d);
    expect((await updateProfile(d, { user, patch: { countryCode: 'XX' } })).ok).toBe(false);
    expect((await updateProfile(d, { user, patch: { language: 'tlh' } })).ok).toBe(false);
    expect((await updateProfile(d, { user, patch: { name: 'F' } })).ok).toBe(false);
  });

  it('writes nothing when the patch is empty', async () => {
    const d = deps();
    const user = await account(d);
    const result = await updateProfile(d, { user, patch: {} });
    expect(result.ok).toBe(true);
    expect(d.log.entries).toHaveLength(0);
  });
});

describe('password', () => {
  it('changes it, keeps this session and drops the others', async () => {
    const d = deps();
    const user = await account(d);
    const keep = await d.sessions.create({ userId: user.id, tokenHash: 'a', expiresAt: new Date('2026-12-31') });
    await d.sessions.create({ userId: user.id, tokenHash: 'b', expiresAt: new Date('2026-12-31') });

    const result = await changePassword(d, {
      user,
      currentPassword: 'the-old-passphrase',
      newPassword: 'a-brand-new-passphrase',
      keepSessionId: keep.id,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.revoked).toBe(2);
    expect(d.raw.users.all[0].passwordHash).toBe('hashed:a-brand-new-passphrase');
  });

  it('refuses the wrong current password and a weak new one', async () => {
    const d = deps();
    const user = await account(d);
    const keep = await d.sessions.create({ userId: user.id, tokenHash: 'a', expiresAt: new Date('2026-12-31') });

    const wrong = await changePassword(d, {
      user,
      currentPassword: 'not-the-password',
      newPassword: 'a-brand-new-passphrase',
      keepSessionId: keep.id,
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe('invalid_credentials');

    const weak = await changePassword(d, {
      user,
      currentPassword: 'the-old-passphrase',
      newPassword: 'short',
      keepSessionId: keep.id,
    });
    expect(weak.ok).toBe(false);
    if (!weak.ok) expect(weak.error.code).toBe('weak_password');
    // Neither attempt touched the stored hash.
    expect(d.raw.users.all[0].passwordHash).toBe('hashed:the-old-passphrase');
  });

  it('sets a first password on a provider-only account, and only once', async () => {
    const d = deps();
    const user = await d.users.create({
      email: 'google@example.com',
      name: 'Google Only',
      countryCode: 'BR',
      language: 'pt-BR',
      referralCode: 'GOOGLE12',
      marketingOptIn: false,
      role: 'USER',
      status: 'ACTIVE',
    });

    const first = await setFirstPassword(d, { user, newPassword: 'a-brand-new-passphrase' });
    expect(first.ok).toBe(true);

    const again = await setFirstPassword(d, { user: d.raw.users.all[0], newPassword: 'another-passphrase' });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('password_already_set');
  });
});

describe('export and deletion', () => {
  it('exports the account without any hash', async () => {
    const d = deps();
    const user = await account(d);
    await d.sessions.create({ userId: user.id, tokenHash: 'a', expiresAt: new Date('2026-12-31'), ip: '10.0.0.1' });

    const result = await exportAccount(d, user);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dump = JSON.stringify(result.value);
    expect(dump).not.toContain('hashed:');
    expect(dump).not.toContain('tokenHash');
    expect(result.value.signInMethods).toEqual(['PASSWORD']);
    expect((result.value.sessions as unknown[]).length).toBe(1);
  });

  it('closes the account, wipes the personal fields and drops the sessions', async () => {
    const d = deps();
    const user = await account(d);
    await d.sessions.create({ userId: user.id, tokenHash: 'a', expiresAt: new Date('2026-12-31') });

    const result = await deleteAccount(d, { user, password: 'the-old-passphrase' });
    expect(result.ok).toBe(true);

    const row = d.raw.users.all[0];
    expect(row.status).toBe('DELETED');
    expect(row.email).not.toBe('player@example.com');
    expect(row.passwordHash).toBeUndefined();
    expect(d.raw.sessions.all.every((s) => s.revokedAt)).toBe(true);
    expect(d.log.entries.some((e) => e.event === 'ACCOUNT_DELETED')).toBe(true);
  });

  it('refuses to close the account without the password', async () => {
    const d = deps();
    const user = await account(d);
    expect((await deleteAccount(d, { user })).ok).toBe(false);
    expect((await deleteAccount(d, { user, password: 'guessing' })).ok).toBe(false);
    expect(d.raw.users.all[0].status).toBe('ACTIVE');
  });
});
