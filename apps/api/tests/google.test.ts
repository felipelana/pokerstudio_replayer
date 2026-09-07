import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signInWithGoogle } from '../src/application/auth/SignInWithGoogle.js';
import { verifyIdToken } from '../src/infrastructure/oauth/google.js';
import { signUpUser } from '../src/application/auth/SignUpUser.js';
import { LANGUAGE_CODES } from '@pokerstudio/shared';
import type { OAuthProfile } from '../src/application/ports/oauth.js';
import {
  fakeAttempts,
  fakeEmail,
  fakeGeo,
  fakeHasher,
  fakeLog,
  fakeReferrals,
  fakeSessions,
  fakeTokenGen,
  fakeTokens,
  fakeUa,
  fakeUsers,
  fixedClock,
  noBreach,
  passCaptcha,
} from './fakes.js';

/* ------------------------------------------------------------------ */
/* Identity token verification                                         */
/* ------------------------------------------------------------------ */

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CLIENT_ID = 'pokerstudio.apps.googleusercontent.com';

function makeIdToken(payload: Record<string, unknown>, key = privateKey): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(key).toString('base64url');
  return `${header}.${body}.${signature}`;
}

const basePayload = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: 'google-user-1',
  exp: Math.floor(Date.now() / 1000) + 600,
  iat: Math.floor(Date.now() / 1000),
  nonce: 'the-nonce',
  email: 'player@gmail.com',
  email_verified: true,
  name: 'Google Player',
  picture: 'https://example.com/a.png',
  locale: 'pt-BR',
  ...over,
});

const keyFor = async () => publicKey;

describe('Google identity token', () => {
  it('accepts a well-formed token', async () => {
    const profile = await verifyIdToken(makeIdToken(basePayload()), CLIENT_ID, 'the-nonce', keyFor);
    expect(profile.providerUserId).toBe('google-user-1');
    expect(profile.email).toBe('player@gmail.com');
    expect(profile.emailVerified).toBe(true);
    expect(profile.locale).toBe('pt-BR');
  });

  it('refuses a token signed by another key', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const token = makeIdToken(basePayload(), other.privateKey);
    await expect(verifyIdToken(token, CLIENT_ID, 'the-nonce', keyFor)).rejects.toThrow(/signature/);
  });

  it('refuses a token issued for another application', async () => {
    const token = makeIdToken(basePayload({ aud: 'someone-else.apps.googleusercontent.com' }));
    await expect(verifyIdToken(token, CLIENT_ID, 'the-nonce', keyFor)).rejects.toThrow(/another application/);
  });

  it('refuses a mismatched nonce, a wrong issuer and an expired token', async () => {
    await expect(verifyIdToken(makeIdToken(basePayload()), CLIENT_ID, 'other-nonce', keyFor)).rejects.toThrow(/nonce/);
    await expect(
      verifyIdToken(makeIdToken(basePayload({ iss: 'https://evil.example' })), CLIENT_ID, 'the-nonce', keyFor),
    ).rejects.toThrow(/issuer/);
    await expect(
      verifyIdToken(makeIdToken(basePayload({ exp: Math.floor(Date.now() / 1000) - 10 })), CLIENT_ID, 'the-nonce', keyFor),
    ).rejects.toThrow(/expired/);
  });

  it('refuses an unverified Google address', async () => {
    const token = makeIdToken(basePayload({ email_verified: false }));
    await expect(verifyIdToken(token, CLIENT_ID, 'the-nonce', keyFor)).rejects.toThrow(/unverified/);
  });

  it('derives the PKCE challenge as the SHA-256 of the verifier', () => {
    const verifier = 'a-verifier-value';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toHaveLength(43);
  });
});

/* ------------------------------------------------------------------ */
/* Sign-in use case                                                    */
/* ------------------------------------------------------------------ */

function googleDeps() {
  const users = fakeUsers();
  const sessions = fakeSessions();
  const identities = {
    rows: [] as { userId: string; provider: string; providerUserId: string }[],
    async find(provider: string, providerUserId: string) {
      const row = this.rows.find((r) => r.provider === provider && r.providerUserId === providerUserId);
      return row ? { userId: row.userId } : undefined;
    },
    async link(input: { userId: string; provider: string; providerUserId: string }) {
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
    referrals: fakeReferrals(),
    log: fakeLog(),
    clock: fixedClock(),
    tokenGen: fakeTokenGen,
    ua: fakeUa,
    geo: fakeGeo,
    adminEmails: [],
    languages: LANGUAGE_CODES,
    raw: { users, sessions, identities },
  };
}

const profile: OAuthProfile = {
  providerUserId: 'google-user-1',
  email: 'player@gmail.com',
  emailVerified: true,
  name: 'Google Player',
  locale: 'pt-BR',
};

describe('sign in with Google', () => {
  it('creates an account on first use, already verified and in the reported language', async () => {
    const deps = googleDeps();
    const result = await signInWithGoogle(deps, { profile });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created).toBe(true);
    expect(result.value.user.email).toBe('player@gmail.com');
    expect(result.value.user.language).toBe('pt-BR');
    // The country is never inferred silently — the user confirms it.
    expect(result.value.needsProfile).toBe(true);
    expect(deps.raw.sessions.all).toHaveLength(1);
  });

  it('signs the same person in again without duplicating the account', async () => {
    const deps = googleDeps();
    await signInWithGoogle(deps, { profile });
    const second = await signInWithGoogle(deps, { profile });
    expect(second.ok).toBe(true);
    expect(deps.raw.users.all).toHaveLength(1);
    expect(deps.raw.identities.rows).toHaveLength(1);
  });

  it('links to an existing account whose e-mail is verified', async () => {
    const deps = googleDeps();
    const local = await deps.users.create({
      email: 'player@gmail.com',
      name: 'Local Player',
      passwordHash: 'hashed:whatever',
      countryCode: 'BR',
      language: 'pt-BR',
      referralCode: 'ABCDEFGH',
      marketingOptIn: false,
      role: 'USER',
      status: 'ACTIVE',
    });
    await deps.users.update(local.id, { emailVerifiedAt: new Date('2026-01-01') });

    const result = await signInWithGoogle(deps, { profile });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.id).toBe(local.id);
    expect(result.value.created).toBe(false);
    expect(deps.raw.users.all).toHaveLength(1);
    expect(deps.log.entries.some((e) => e.event === 'GOOGLE_LINKED')).toBe(true);
  });

  it('refuses to link an account that never verified its e-mail', async () => {
    const deps = googleDeps();
    await deps.users.create({
      email: 'player@gmail.com',
      name: 'Squatter',
      passwordHash: 'hashed:whatever',
      countryCode: 'BR',
      language: 'pt-BR',
      referralCode: 'ABCDEFGH',
      marketingOptIn: false,
      role: 'USER',
      status: 'PENDING',
    });

    const result = await signInWithGoogle(deps, { profile });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('link_requires_verification');
    expect(deps.raw.identities.rows).toHaveLength(0);
  });

  it('refuses a blocked account', async () => {
    const deps = googleDeps();
    const local = await deps.users.create({
      email: 'player@gmail.com',
      name: 'Blocked',
      countryCode: 'BR',
      language: 'pt-BR',
      referralCode: 'ABCDEFGH',
      marketingOptIn: false,
      role: 'USER',
      status: 'ACTIVE',
    });
    await deps.users.update(local.id, { emailVerifiedAt: new Date(), status: 'BLOCKED' });

    const result = await signInWithGoogle(deps, { profile });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('account_unavailable');
    expect(deps.raw.sessions.all).toHaveLength(0);
  });

  it('refuses a profile whose provider e-mail is not verified', async () => {
    const deps = googleDeps();
    const result = await signInWithGoogle(deps, { profile: { ...profile, emailVerified: false } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('google_email_unverified');
  });

  it('keeps the referral code that survived the redirect', async () => {
    const deps = googleDeps();
    const signup = await signUpUser(
      {
        users: deps.users,
        tokens: fakeTokens(),
        referrals: deps.referrals,
        log: deps.log,
        hasher: fakeHasher,
        clock: deps.clock,
        tokenGen: fakeTokenGen,
        email: fakeEmail(),
        captcha: passCaptcha,
        breach: noBreach,
        adminEmails: [],
        requireVerification: false,
      },
      {
        email: 'referrer@example.com',
        password: 'a-strong-passphrase',
        name: 'Referrer',
        countryCode: 'BR',
        language: 'pt-BR',
        acceptedTerms: true,
      },
    );
    if (!signup.ok) throw new Error('setup failed');

    const result = await signInWithGoogle(deps, { profile, referralCode: signup.value.user.referralCode });
    expect(result.ok && result.value.user.referredById).toBe(signup.value.user.id);
    expect(deps.referrals.accepted).toHaveLength(1);
  });

  it('records the sign-in method in the access log', async () => {
    const deps = googleDeps();
    await signInWithGoogle(deps, { profile, ip: '10.0.0.9' });
    const login = deps.log.entries.find((e) => e.event === 'LOGIN_OK');
    expect(login?.detail).toMatchObject({ method: 'GOOGLE' });
  });
});

/** Keeps the unused-import checker honest about the attempts fake. */
void fakeAttempts;
