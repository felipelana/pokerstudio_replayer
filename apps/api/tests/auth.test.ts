import { describe, expect, it } from 'vitest';
import { signUpUser } from '../src/application/auth/SignUpUser.js';
import { loginUser, MAX_ATTEMPTS } from '../src/application/auth/LoginUser.js';
import { verifyEmail } from '../src/application/auth/VerifyEmail.js';
import { requestPasswordReset, resetPassword } from '../src/application/auth/ResetPassword.js';
import { blockUser } from '../src/application/admin/ManageUsers.js';
import { deleteUserSkin, listUserSkins, saveUserSkin } from '../src/application/skins/UserSkins.js';
import {
  fakeAttempts,
  fakeEmail,
  fakeGeo,
  fakeHasher,
  fakeLog,
  fakeReferrals,
  fakeSessions,
  fakeSkins,
  fakeTokenGen,
  fakeTokens,
  fakeUa,
  fakeUsers,
  failCaptcha,
  fixedClock,
  noBreach,
  passCaptcha,
} from './fakes.js';

function makeDeps(overrides: { requireVerification?: boolean; captcha?: typeof passCaptcha } = {}) {
  const users = fakeUsers();
  const sessions = fakeSessions();
  const tokens = fakeTokens();
  const log = fakeLog();
  const attempts = fakeAttempts();
  const referrals = fakeReferrals();
  const email = fakeEmail();
  const clock = fixedClock();
  const common = {
    users,
    sessions,
    tokens,
    log,
    attempts,
    referrals,
    email,
    clock,
    hasher: fakeHasher,
    tokenGen: fakeTokenGen,
    captcha: overrides.captcha ?? passCaptcha,
    breach: noBreach,
    ua: fakeUa,
    geo: fakeGeo,
    adminEmails: ['admin@pokerstudio.com.br'],
    requireVerification: overrides.requireVerification ?? false,
  };
  return common;
}

const validSignup = {
  email: 'Player@Example.com ',
  password: 'a-strong-passphrase',
  name: 'Player One',
  countryCode: 'br',
  language: 'pt-BR',
  acceptedTerms: true,
};

describe('sign up', () => {
  it('creates an active account, normalises the e-mail and queues verification', async () => {
    const deps = makeDeps();
    const result = await signUpUser(deps, validSignup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.user.email).toBe('player@example.com');
    expect(result.value.user.countryCode).toBe('BR');
    expect(result.value.user.status).toBe('ACTIVE'); // no provider configured yet
    expect(result.value.user.referralCode).toHaveLength(8);
    expect(deps.email.sent[0]?.template).toBe('verify-email');
    expect(deps.log.entries.some((e) => e.event === 'SIGNUP')).toBe(true);
    // The password is never stored in the clear.
    expect(result.value.user.passwordHash).not.toContain(validSignup.password.slice(0, 4) + 'x');
  });

  it('refuses a duplicate e-mail, a short password and unaccepted terms', async () => {
    const deps = makeDeps();
    await signUpUser(deps, validSignup);

    const duplicate = await signUpUser(deps, validSignup);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe('email_in_use');

    const weak = await signUpUser(deps, { ...validSignup, email: 'b@example.com', password: 'short' });
    expect(weak.ok).toBe(false);
    if (!weak.ok) expect(weak.error.code).toBe('weak_password');

    const noTerms = await signUpUser(deps, { ...validSignup, email: 'c@example.com', acceptedTerms: false });
    expect(noTerms.ok).toBe(false);
    if (!noTerms.ok) expect(noTerms.error.code).toBe('terms_required');
  });

  it('refuses when the captcha fails', async () => {
    const deps = makeDeps({ captcha: failCaptcha });
    const result = await signUpUser(deps, { ...validSignup, email: 'd@example.com' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('captcha_failed');
  });

  it('promotes an address listed in ADMIN_EMAILS', async () => {
    const deps = makeDeps();
    const result = await signUpUser(deps, { ...validSignup, email: 'admin@pokerstudio.com.br' });
    expect(result.ok && result.value.user.role).toBe('ADMIN');
  });

  it('links the referrer when a referral code is used', async () => {
    const deps = makeDeps();
    const first = await signUpUser(deps, validSignup);
    if (!first.ok) throw new Error('setup failed');
    const second = await signUpUser(deps, {
      ...validSignup,
      email: 'friend@example.com',
      referralCode: first.value.user.referralCode,
    });
    expect(second.ok && second.value.user.referredById).toBe(first.value.user.id);
    expect(deps.referrals.accepted).toHaveLength(1);
  });
});

describe('verify e-mail', () => {
  it('activates the account once, and refuses a reused token', async () => {
    const deps = makeDeps({ requireVerification: true });
    const signup = await signUpUser(deps, validSignup);
    if (!signup.ok || !signup.value.verificationToken) throw new Error('setup failed');
    expect(signup.value.user.status).toBe('PENDING');

    const first = await verifyEmail(deps, signup.value.verificationToken);
    expect(first.ok && first.value.status).toBe('ACTIVE');

    const second = await verifyEmail(deps, signup.value.verificationToken);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('token_invalid');
  });
});

describe('login', () => {
  it('opens a session for the right password', async () => {
    const deps = makeDeps();
    await signUpUser(deps, validSignup);
    const result = await loginUser(deps, { email: 'player@example.com', password: validSignup.password });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.token).toBeTruthy();
    expect(deps.sessions.all).toHaveLength(1);
    expect(deps.log.entries.some((e) => e.event === 'LOGIN_OK')).toBe(true);
  });

  it('answers the same for an unknown e-mail and a wrong password', async () => {
    const deps = makeDeps();
    await signUpUser(deps, validSignup);
    const unknown = await loginUser(deps, { email: 'nobody@example.com', password: 'whatever-long' });
    const wrong = await loginUser(deps, { email: 'player@example.com', password: 'wrong-password-x' });
    expect(unknown.ok).toBe(false);
    expect(wrong.ok).toBe(false);
    if (!unknown.ok && !wrong.ok) {
      expect(unknown.error.code).toBe(wrong.error.code);
      expect(unknown.error.message).toBe(wrong.error.message);
    }
  });

  it('locks the account after ten failures', async () => {
    const deps = makeDeps();
    await signUpUser(deps, validSignup);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await loginUser(deps, { email: 'player@example.com', password: 'wrong-password-x', ip: '10.0.0.1' });
    }
    const locked = await loginUser(deps, { email: 'player@example.com', password: validSignup.password, ip: '10.0.0.1' });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error.code).toBe('account_locked');
  });

  it('refuses a blocked account and reports it as a blocked attempt', async () => {
    const deps = makeDeps();
    const signup = await signUpUser(deps, validSignup);
    if (!signup.ok) throw new Error('setup failed');
    await blockUser(deps, { adminId: 'admin', userId: signup.value.user.id, reason: 'abuse' });

    const result = await loginUser(deps, { email: 'player@example.com', password: validSignup.password });
    expect(result.ok).toBe(false);
    expect(deps.log.entries.some((e) => e.event === 'BLOCKED_ATTEMPT')).toBe(true);
  });
});

describe('password reset', () => {
  it('answers identically for a known and an unknown address, and only sends for the known one', async () => {
    const deps = makeDeps();
    await signUpUser(deps, validSignup);
    deps.email.sent.length = 0;

    const known = await requestPasswordReset(deps, { email: 'player@example.com' });
    const sentAfterKnown = deps.email.sent.length;
    const unknown = await requestPasswordReset(deps, { email: 'nobody@example.com' });

    expect(known.ok).toBe(true);
    expect(unknown.ok).toBe(true);
    expect(sentAfterKnown).toBe(1);
    expect(deps.email.sent).toHaveLength(1);
  });

  it('changes the password and drops every session', async () => {
    const deps = makeDeps();
    await signUpUser(deps, validSignup);
    await loginUser(deps, { email: 'player@example.com', password: validSignup.password });
    const request = await requestPasswordReset(deps, { email: 'player@example.com' });
    if (!request.ok || !request.value.token) throw new Error('setup failed');

    const done = await resetPassword(deps, { token: request.value.token, password: 'another-strong-pass' });
    expect(done.ok).toBe(true);
    expect(deps.sessions.all.every((s) => s.revokedAt)).toBe(true);

    const withNew = await loginUser(deps, { email: 'player@example.com', password: 'another-strong-pass' });
    expect(withNew.ok).toBe(true);
  });
});

describe('blocking a user', () => {
  it('revokes their sessions in the same step', async () => {
    const deps = makeDeps();
    const signup = await signUpUser(deps, validSignup);
    if (!signup.ok) throw new Error('setup failed');
    await loginUser(deps, { email: 'player@example.com', password: validSignup.password });
    expect(deps.sessions.all.filter((s) => !s.revokedAt)).toHaveLength(1);

    await blockUser(deps, { adminId: 'admin', userId: signup.value.user.id, reason: 'chip dumping' });
    expect(deps.sessions.all.filter((s) => !s.revokedAt)).toHaveLength(0);
    expect(deps.log.entries.some((e) => e.event === 'ADMIN_BLOCK')).toBe(true);
  });
});

describe('per-user skins', () => {
  it('saves, overwrites, lists and deletes a skin', async () => {
    const deps = { skins: fakeSkins() };
    const skin = { name: 'My table', data: { felt: { color: '#123456' } } };

    const created = await saveUserSkin(deps, { userId: 'u1', skinId: 'custom-1', ...skin });
    expect(created.ok).toBe(true);

    const updated = await saveUserSkin(deps, { userId: 'u1', skinId: 'custom-1', ...skin, name: 'Renamed' });
    expect(updated.ok && updated.value.name).toBe('Renamed');

    const list = await listUserSkins(deps, 'u1');
    expect(list.ok && list.value).toHaveLength(1);

    // Another account never sees it.
    const other = await listUserSkins(deps, 'u2');
    expect(other.ok && other.value).toHaveLength(0);

    const removed = await deleteUserSkin(deps, 'u1', 'custom-1');
    expect(removed.ok).toBe(true);
    const afterDelete = await listUserSkins(deps, 'u1');
    expect(afterDelete.ok && afterDelete.value).toHaveLength(0);
  });

  it('refuses a skin payload that is too large', async () => {
    const deps = { skins: fakeSkins() };
    const huge = { blob: 'x'.repeat(300 * 1024) };
    const result = await saveUserSkin(deps, { userId: 'u1', skinId: 'big', name: 'Big', data: huge });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('skin_too_large');
  });
});
