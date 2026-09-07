import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { OAuthProfile, OAuthProvider, OAuthStart } from '../../application/ports/oauth.js';

const AUTH_ENDPOINT = 'https://www.facebook.com/v21.0/dialog/oauth';
const TOKEN_ENDPOINT = 'https://graph.facebook.com/v21.0/oauth/access_token';
const PROFILE_ENDPOINT = 'https://graph.facebook.com/v21.0/me';

export interface FacebookConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

/**
 * Facebook Login. It is plain OAuth 2.0, not OpenID Connect by default: there
 * is no identity token to verify, so the profile is read from the Graph API
 * over the server-to-server channel, with an `appsecret_proof` so a stolen
 * access token cannot be replayed from somewhere else.
 *
 * Two things Facebook does not give us, whatever is asked for: a phone number,
 * and any guarantee of an e-mail — an account created with a phone number has
 * none, and the sign-in is refused in that case rather than inventing one.
 */
export function createFacebookProvider(config: FacebookConfig): OAuthProvider {
  return {
    name: 'FACEBOOK',

    start(): OAuthStart {
      const state = randomBytes(24).toString('base64url');
      // Facebook has no nonce or PKCE in this flow; the state cookie carries
      // the same protection, and the placeholders keep one shape for all
      // providers.
      const url = new URL(AUTH_ENDPOINT);
      url.searchParams.set('client_id', config.appId);
      url.searchParams.set('redirect_uri', config.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'public_profile,email');
      url.searchParams.set('state', state);

      return { authorizationUrl: url.toString(), state, nonce: '', codeVerifier: '' };
    },

    async complete({ code }): Promise<OAuthProfile> {
      const tokenUrl = new URL(TOKEN_ENDPOINT);
      tokenUrl.searchParams.set('client_id', config.appId);
      tokenUrl.searchParams.set('client_secret', config.appSecret);
      tokenUrl.searchParams.set('redirect_uri', config.redirectUri);
      tokenUrl.searchParams.set('code', code);

      const tokenRes = await fetch(tokenUrl, { signal: AbortSignal.timeout(8000) });
      if (!tokenRes.ok) throw new Error('Facebook rejected the authorisation code');
      const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
      if (!accessToken) throw new Error('Facebook returned no access token');

      const proof = createHmac('sha256', config.appSecret).update(accessToken).digest('hex');
      const profileUrl = new URL(PROFILE_ENDPOINT);
      profileUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
      profileUrl.searchParams.set('access_token', accessToken);
      profileUrl.searchParams.set('appsecret_proof', proof);

      const profileRes = await fetch(profileUrl, { signal: AbortSignal.timeout(8000) });
      if (!profileRes.ok) throw new Error('could not read the Facebook profile');
      const profile = (await profileRes.json()) as {
        id: string;
        name?: string;
        email?: string;
        picture?: { data?: { url?: string } };
      };

      if (!profile.email) throw new Error('this Facebook account has no e-mail to sign in with');

      return {
        providerUserId: profile.id,
        // Facebook only returns an address it has confirmed itself.
        email: profile.email.toLowerCase(),
        emailVerified: true,
        name: profile.name,
        avatarUrl: profile.picture?.data?.url,
      };
    },
  };
}

/** Exported for tests: the proof Facebook expects beside an access token. */
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

/** Exported for tests: PKCE-style challenge, kept for providers that want one. */
export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
