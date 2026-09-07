import { createHmac, createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appSecretProof } from '../src/infrastructure/oauth/facebook.js';
import { verifyOidcToken } from '../src/infrastructure/oauth/oidc.js';
import { loadConfig } from '../src/shared/config.js';

/* ------------------------------------------------------------------ */
/* Apple's identity token — ES256, and a different shape from Google's  */
/* ------------------------------------------------------------------ */

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const CLIENT_ID = 'com.pokerstudio.replayer.web';

function appleToken(payload: Record<string, unknown>, key = privateKey): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: 'apple-key' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSign('SHA256')
    .update(`${header}.${body}`)
    .sign({ key, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${header}.${body}.${signature}`;
}

const claims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://appleid.apple.com',
  aud: CLIENT_ID,
  sub: '001234.abcdef',
  exp: Math.floor(Date.now() / 1000) + 600,
  iat: Math.floor(Date.now() / 1000),
  nonce: 'the-nonce',
  email: 'player@privaterelay.appleid.com',
  // Apple sends this as the string "true".
  email_verified: 'true',
  ...over,
});

const verify = (token: string, nonce = 'the-nonce') =>
  verifyOidcToken({
    idToken: token,
    clientId: CLIENT_ID,
    expectedNonce: nonce,
    issuers: new Set(['https://appleid.apple.com']),
    keyFor: async () => publicKey,
    algorithms: { ES256: 'SHA256' },
    provider: 'Apple',
  });

describe('Apple identity token', () => {
  it('accepts a well-formed token, relay address included', async () => {
    const profile = await verify(appleToken(claims()));
    expect(profile.providerUserId).toBe('001234.abcdef');
    expect(profile.email).toBe('player@privaterelay.appleid.com');
    expect(profile.emailVerified).toBe(true);
  });

  it('refuses a token signed by another key', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    await expect(verify(appleToken(claims(), other.privateKey))).rejects.toThrow(/signature/);
  });

  it('refuses another application, a wrong issuer, an expired token and a bad nonce', async () => {
    await expect(verify(appleToken(claims({ aud: 'com.someone.else' })))).rejects.toThrow(/another application/);
    await expect(verify(appleToken(claims({ iss: 'https://evil.example' })))).rejects.toThrow(/issuer/);
    await expect(verify(appleToken(claims({ exp: Math.floor(Date.now() / 1000) - 5 })))).rejects.toThrow(/expired/);
    await expect(verify(appleToken(claims()), 'other-nonce')).rejects.toThrow(/nonce/);
  });

  it('refuses an unverified address, however it is spelled', async () => {
    await expect(verify(appleToken(claims({ email_verified: 'false' })))).rejects.toThrow(/unverified/);
    await expect(verify(appleToken(claims({ email_verified: false })))).rejects.toThrow(/unverified/);
  });

  it('accepts the audience as a list, which Apple sometimes sends', async () => {
    const profile = await verify(appleToken(claims({ aud: ['other', CLIENT_ID] })));
    expect(profile.providerUserId).toBe('001234.abcdef');
  });
});

/* ------------------------------------------------------------------ */
/* Facebook                                                            */
/* ------------------------------------------------------------------ */

describe('Facebook access-token proof', () => {
  it('is the HMAC-SHA256 of the token under the app secret', () => {
    const proof = appSecretProof('the-access-token', 'the-app-secret');
    expect(proof).toBe(createHmac('sha256', 'the-app-secret').update('the-access-token').digest('hex'));
    // A stolen token is useless without the secret, which is the point.
    expect(appSecretProof('the-access-token', 'another-secret')).not.toBe(proof);
  });
});

/* ------------------------------------------------------------------ */
/* Credentials read from the environment                               */
/* ------------------------------------------------------------------ */

describe('provider credentials from the environment', () => {
  const base = {
    SESSION_SECRET: 'x'.repeat(32),
    ENCRYPTION_KEY: 'a'.repeat(64),
    DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  } as NodeJS.ProcessEnv;

  it('trims a credential, and treats a blank one as not set at all', () => {
    const config = loadConfig({
      ...base,
      GOOGLE_CLIENT_ID: '  123-abc.apps.googleusercontent.com \n',
      GOOGLE_CLIENT_SECRET: ' shh ',
      GOOGLE_REDIRECT_URI: 'http://localhost:3001/cb',
      FACEBOOK_APP_ID: '   ',
    });
    expect(config.GOOGLE_CLIENT_ID).toBe('123-abc.apps.googleusercontent.com');
    expect(config.GOOGLE_CLIENT_SECRET).toBe('shh');
    expect(config.googleEnabled).toBe(true);
    expect(config.FACEBOOK_APP_ID).toBeUndefined();
    expect(config.facebookEnabled).toBe(false);
  });

  it('refuses to start on a client id that is not a Google one', () => {
    expect(() =>
      loadConfig({
        ...base,
        GOOGLE_CLIENT_ID: 'my-client',
        GOOGLE_CLIENT_SECRET: 'shh',
        GOOGLE_REDIRECT_URI: 'http://localhost:3001/cb',
      }),
    ).toThrow(/apps\.googleusercontent\.com/);
  });
});
