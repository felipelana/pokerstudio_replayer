import { createPrivateKey, createSign, randomBytes } from 'node:crypto';
import type { OAuthProfile, OAuthProvider, OAuthStart } from '../../application/ports/oauth.js';
import { jwksResolver, verifyOidcToken } from './oidc.js';

const AUTH_ENDPOINT = 'https://appleid.apple.com/auth/authorize';
const TOKEN_ENDPOINT = 'https://appleid.apple.com/auth/token';
const JWKS_URI = 'https://appleid.apple.com/auth/keys';
const ISSUERS = new Set(['https://appleid.apple.com']);

export interface AppleConfig {
  /** Services ID, e.g. com.pokerstudio.replayer.web — this is the client_id. */
  clientId: string;
  teamId: string;
  keyId: string;
  /** Contents of the .p8 private key downloaded from the developer portal. */
  privateKey: string;
  redirectUri: string;
}

/**
 * Sign in with Apple. Apple has no client secret: the secret is a short-lived
 * ES256 token we sign ourselves with the .p8 key, which is why the team id, key
 * id and key all have to be configured.
 *
 * Apple returns the name only on the very first authorisation, and never a
 * phone number. It also lets the user hide their address, in which case the
 * e-mail is a private relay that still delivers.
 */
export function createAppleProvider(config: AppleConfig): OAuthProvider {
  const keyFor = jwksResolver(JWKS_URI, 'Apple');

  /** The client secret Apple expects: a JWT signed with the .p8 key. */
  function clientSecret(now = Date.now()): string {
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })).toString('base64url');
    const issuedAt = Math.floor(now / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iss: config.teamId,
        iat: issuedAt,
        // Apple caps this at six months; an hour is plenty and safer.
        exp: issuedAt + 3600,
        aud: 'https://appleid.apple.com',
        sub: config.clientId,
      }),
    ).toString('base64url');

    const signature = createSign('SHA256')
      .update(`${header}.${payload}`)
      .sign({ key: createPrivateKey(config.privateKey), dsaEncoding: 'ieee-p1363' })
      .toString('base64url');

    return `${header}.${payload}.${signature}`;
  }

  return {
    name: 'APPLE',

    start(): OAuthStart {
      const state = randomBytes(24).toString('base64url');
      const nonce = randomBytes(24).toString('base64url');

      const url = new URL(AUTH_ENDPOINT);
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', config.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'name email');
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      // Asking for scopes means Apple posts the result back as a form.
      url.searchParams.set('response_mode', 'form_post');

      return { authorizationUrl: url.toString(), state, nonce, codeVerifier: '' };
    },

    async complete({ code, nonce }): Promise<OAuthProfile> {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: clientSecret(),
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('Apple rejected the authorisation code');
      const tokens = (await res.json()) as { id_token?: string };
      if (!tokens.id_token) throw new Error('Apple returned no identity token');

      return await verifyOidcToken({
        idToken: tokens.id_token,
        clientId: config.clientId,
        expectedNonce: nonce,
        issuers: ISSUERS,
        keyFor,
        algorithms: { ES256: 'SHA256' },
        provider: 'Apple',
      });
    },
  };
}
