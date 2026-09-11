import {
  createHash,
  createPublicKey,
  createVerify,
  randomBytes,
  type JsonWebKey,
} from 'node:crypto';
import type { OAuthProfile, OAuthProvider, OAuthStart } from '../../application/ports/oauth.js';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface IdTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  locale?: string;
}

const b64urlJson = <T>(part: string): T =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;

/**
 * Google via OpenID Connect, Authorization Code + PKCE, done entirely on the
 * server. The identity token is verified against Google's published keys — a
 * token validated only in the browser would be worthless.
 */
export function createGoogleProvider(config: GoogleConfig): OAuthProvider {
  let jwksCache:
    { keys: (JsonWebKey & { kid: string; alg?: string })[]; fetchedAt: number } | undefined;

  async function keyFor(kid: string) {
    const fresh = jwksCache && Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000;
    if (!fresh) {
      const res = await fetch(JWKS_URI, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('could not fetch Google signing keys');
      const body = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
      jwksCache = { keys: body.keys, fetchedAt: Date.now() };
    }
    const jwk = jwksCache!.keys.find((k) => k.kid === kid);
    if (!jwk) throw new Error('unknown signing key');
    return createPublicKey({ key: jwk, format: 'jwk' });
  }

  return {
    name: 'GOOGLE',

    start(): OAuthStart {
      const state = randomBytes(24).toString('base64url');
      const nonce = randomBytes(24).toString('base64url');
      const codeVerifier = randomBytes(48).toString('base64url');
      const challenge = createHash('sha256').update(codeVerifier).digest('base64url');

      const url = new URL(AUTH_ENDPOINT);
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', config.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('prompt', 'select_account');

      return { authorizationUrl: url.toString(), state, nonce, codeVerifier };
    },

    async complete({ code, codeVerifier, nonce }): Promise<OAuthProfile> {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('Google rejected the authorisation code');
      const tokens = (await res.json()) as { id_token?: string };
      if (!tokens.id_token) throw new Error('Google returned no identity token');

      return await verifyIdToken(tokens.id_token, config.clientId, nonce, keyFor);
    },
  };
}

/** Exported for tests: the whole validation, with the key lookup injected. */
export async function verifyIdToken(
  idToken: string,
  clientId: string,
  expectedNonce: string,
  keyFor: (
    kid: string,
  ) => Promise<
    Parameters<typeof createVerify>[0] extends never ? never : import('node:crypto').KeyObject
  >,
  now: number = Date.now(),
): Promise<OAuthProfile> {
  const [headerPart, payloadPart, signaturePart] = idToken.split('.');
  if (!headerPart || !payloadPart || !signaturePart) throw new Error('malformed identity token');

  const header = b64urlJson<{ alg: string; kid: string }>(headerPart);
  if (header.alg !== 'RS256') throw new Error('unexpected token algorithm');

  const key = await keyFor(header.kid);
  const signatureValid = createVerify('RSA-SHA256')
    .update(`${headerPart}.${payloadPart}`)
    .verify(key, Buffer.from(signaturePart, 'base64url'));
  if (!signatureValid) throw new Error('identity token signature does not check out');

  const payload = b64urlJson<IdTokenPayload>(payloadPart);
  if (!ISSUERS.has(payload.iss)) throw new Error('unexpected issuer');
  if (payload.aud !== clientId) throw new Error('token was issued for another application');
  if (payload.exp * 1000 <= now) throw new Error('identity token expired');
  if (payload.nonce !== expectedNonce) throw new Error('nonce does not match');
  if (!payload.email) throw new Error('Google returned no e-mail');
  // An unverified address at the provider would let anyone claim someone's account.
  if (!payload.email_verified) throw new Error('the Google account has an unverified e-mail');

  return {
    providerUserId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name,
    avatarUrl: payload.picture,
    locale: payload.locale,
  };
}
