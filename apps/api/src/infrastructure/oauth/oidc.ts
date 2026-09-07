import { createPublicKey, createVerify, type JsonWebKey, type KeyObject } from 'node:crypto';
import type { OAuthProfile } from '../../application/ports/oauth.js';

/** A key set fetched from a provider, cached for an hour. */
export function jwksResolver(uri: string, label: string): (kid: string) => Promise<KeyObject> {
  let cache: { keys: (JsonWebKey & { kid: string })[]; fetchedAt: number } | undefined;

  return async (kid: string) => {
    const fresh = cache && Date.now() - cache.fetchedAt < 60 * 60 * 1000;
    if (!fresh) {
      const res = await fetch(uri, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`could not fetch ${label} signing keys`);
      const body = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
      cache = { keys: body.keys, fetchedAt: Date.now() };
    }
    const jwk = cache!.keys.find((k) => k.kid === kid);
    if (!jwk) throw new Error('unknown signing key');
    return createPublicKey({ key: jwk, format: 'jwk' });
  };
}

export interface IdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | 'true' | 'false';
  name?: string;
  picture?: string;
  locale?: string;
}

export const b64urlJson = <T>(part: string): T => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;

/**
 * Verifies an OpenID Connect identity token: signature against the provider's
 * published keys, then issuer, audience, expiry and the nonce we sent. Doing
 * this on the server is the whole point — a token checked in the browser proves
 * nothing.
 */
export async function verifyOidcToken(input: {
  idToken: string;
  clientId: string;
  expectedNonce: string;
  issuers: Set<string>;
  keyFor: (kid: string) => Promise<KeyObject>;
  /** RS256 for Google, ES256 for Apple. */
  algorithms: Record<string, string>;
  provider: string;
  now?: number;
}): Promise<OAuthProfile> {
  const { idToken, clientId, expectedNonce, issuers, keyFor, algorithms, provider } = input;
  const now = input.now ?? Date.now();

  const [headerPart, payloadPart, signaturePart] = idToken.split('.');
  if (!headerPart || !payloadPart || !signaturePart) throw new Error('malformed identity token');

  const header = b64urlJson<{ alg: string; kid: string }>(headerPart);
  const nodeAlgorithm = algorithms[header.alg];
  if (!nodeAlgorithm) throw new Error('unexpected token algorithm');

  const key = await keyFor(header.kid);
  const verifier = createVerify(nodeAlgorithm).update(`${headerPart}.${payloadPart}`);
  // Elliptic-curve signatures arrive as a raw r‖s pair, not DER.
  const signatureValid = verifier.verify(
    header.alg.startsWith('ES') ? { key, dsaEncoding: 'ieee-p1363' } : key,
    Buffer.from(signaturePart, 'base64url'),
  );
  if (!signatureValid) throw new Error('identity token signature does not check out');

  const claims = b64urlJson<IdTokenClaims>(payloadPart);
  if (!issuers.has(claims.iss)) throw new Error('unexpected issuer');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(clientId)) throw new Error('token was issued for another application');
  if (claims.exp * 1000 <= now) throw new Error('identity token expired');
  if (claims.nonce !== expectedNonce) throw new Error('nonce does not match');
  if (!claims.email) throw new Error(`${provider} returned no e-mail`);
  // An unverified address at the provider would let anyone claim someone's account.
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  if (!verified) throw new Error(`the ${provider} account has an unverified e-mail`);

  return {
    providerUserId: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: true,
    name: claims.name,
    avatarUrl: claims.picture,
    locale: claims.locale,
  };
}
