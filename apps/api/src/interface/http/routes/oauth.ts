import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LANGUAGE_CODES } from '@pokerstudio/shared';
import { signInWithProvider } from '../../../application/auth/SignInWithProvider.js';
import { problem } from '../errors.js';
import { clientIp, requireUser, setSessionCookie } from '../context.js';
import type { AppContainer } from '../../../main-container.js';
import type { OAuthProvider, OAuthProviderName } from '../../../application/ports/oauth.js';

const OAUTH_COOKIE = 'ps_oauth';
/** The round trip to the provider is short-lived on purpose. */
const OAUTH_TTL_MS = 10 * 60 * 1000;

interface OAuthCookie {
  provider: OAuthProviderName;
  state: string;
  nonce: string;
  codeVerifier: string;
  redirect: string;
  referralCode?: string;
}

const PATHS: Record<OAuthProviderName, string> = { GOOGLE: 'google', FACEBOOK: 'facebook', APPLE: 'apple' };

/**
 * Sign-in with an identity provider. One flow serves all of them: the shape of
 * the round trip (signed state cookie, code exchange on the server, session
 * cookie at the end) is identical, and only the provider object differs.
 */
export async function oauthRoutes(app: FastifyInstance, container: AppContainer) {
  const cookieOpts = { domain: container.config.COOKIE_DOMAIN, secure: container.config.isProduction };
  const providers = container.oauth;

  /** Lets the web app render exactly the buttons this deployment can honour. */
  app.get('/auth/providers', async (_request, reply) =>
    reply.send({
      google: !!providers.GOOGLE,
      facebook: !!providers.FACEBOOK,
      apple: !!providers.APPLE,
    }),
  );

  const begin = (provider: OAuthProvider) => async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z
      .object({ redirect: z.string().optional(), ref: z.string().max(8).optional() })
      .parse(request.query);
    const start = provider.start();

    const payload: OAuthCookie = {
      provider: provider.name,
      state: start.state,
      nonce: start.nonce,
      codeVerifier: start.codeVerifier,
      // Only same-site paths, so the callback cannot be used as an open redirect.
      redirect: query.redirect?.startsWith('/') ? query.redirect : '/',
      referralCode: query.ref,
    };
    reply.setCookie(OAUTH_COOKIE, JSON.stringify(payload), {
      httpOnly: true,
      // Apple posts the callback back to us, which a Lax cookie would not
      // survive; the signed state is what actually guards the exchange.
      sameSite: provider.name === 'APPLE' ? 'none' : 'lax',
      secure: provider.name === 'APPLE' ? true : cookieOpts.secure,
      signed: true,
      path: '/',
      maxAge: OAUTH_TTL_MS / 1000,
    });
    return reply.redirect(start.authorizationUrl);
  };

  const finish = (provider: OAuthProvider) => async (request: FastifyRequest, reply: FastifyReply) => {
    // Apple uses form_post; the others come back as query parameters.
    const source = (request.method === 'POST' ? request.body : request.query) ?? {};
    const query = z
      .object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })
      .parse(source);

    const label = provider.name.toLowerCase();
    const fallback = (code: string) => reply.redirect(`${container.config.APP_URL}/login?error=${code}`);

    // The user closed the provider's window or refused consent.
    if (query.error || !query.code || !query.state) return fallback('oauth_cancelled');

    const raw = request.cookies?.[OAUTH_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : undefined;
    if (!unsigned?.valid || !unsigned.value) return fallback('oauth_state');
    reply.clearCookie(OAUTH_COOKIE, { path: '/' });

    let saved: OAuthCookie;
    try {
      saved = JSON.parse(unsigned.value) as OAuthCookie;
    } catch {
      return fallback('oauth_state');
    }
    // A mismatched state, or a cookie from another provider, means this
    // callback is not the one we started.
    if (saved.state !== query.state || saved.provider !== provider.name) return fallback('oauth_state');

    let profile;
    try {
      profile = await provider.complete({ code: query.code, codeVerifier: saved.codeVerifier, nonce: saved.nonce });
    } catch (err) {
      request.log.warn({ err, provider: label }, 'provider sign-in failed');
      return fallback('oauth_failed');
    }

    const result = await signInWithProvider(
      {
        users: container.users,
        sessions: container.sessions,
        identities: container.identities,
        referrals: container.referrals,
        log: container.log,
        clock: container.clock,
        tokenGen: container.tokenGen,
        ua: container.ua,
        geo: container.geo,
        adminEmails: container.config.adminEmails,
        languages: LANGUAGE_CODES,
      },
      {
        provider: provider.name,
        profile,
        referralCode: saved.referralCode,
        ip: clientIp(request),
        userAgent: request.headers['user-agent'],
      },
    );

    if (!result.ok) return fallback(result.error.code);

    setSessionCookie(reply, result.value.token, result.value.expiresAt, cookieOpts.domain, cookieOpts.secure);
    const target = result.value.needsProfile ? '/account?complete=1' : saved.redirect;
    return reply.redirect(`${container.config.APP_URL}${target}`);
  };

  for (const [name, provider] of Object.entries(providers) as [OAuthProviderName, OAuthProvider | undefined][]) {
    if (!provider) continue;
    const path = PATHS[name];
    app.get(`/auth/${path}`, begin(provider));
    app.get(`/auth/${path}/callback`, finish(provider));
    // Apple asks for name and e-mail, so it posts the result back instead.
    if (name === 'APPLE') app.post(`/auth/${path}/callback`, finish(provider));
  }

  /** Which providers this account can sign in with. */
  app.get('/auth/identities', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const linked = await container.identities.listForUser(user.id);
    return reply.send({ identities: user.passwordHash ? ['PASSWORD', ...linked] : linked });
  });

  /** Unlinking is refused while the provider is the only way into the account. */
  app.delete('/auth/identities/:provider', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { provider } = z.object({ provider: z.enum(['GOOGLE', 'FACEBOOK', 'APPLE']) }).parse(request.params);

    const linked = await container.identities.listForUser(user.id);
    const remaining = linked.filter((p) => p !== provider).length + (user.passwordHash ? 1 : 0);
    if (remaining === 0) {
      return problem(reply, {
        code: 'password_required',
        message: 'Set a password before disconnecting your last sign-in method.',
        status: 409,
      });
    }

    await container.identities.unlink(user.id, provider);
    await container.log.record({
      userId: user.id,
      email: user.email,
      event: provider === 'GOOGLE' ? 'GOOGLE_UNLINKED' : 'PROVIDER_UNLINKED',
      ip: clientIp(request),
      detail: { provider },
    });
    return reply.status(204).send();
  });

  /** Referral links keep working whichever provider the invitee picks. */
  app.get('/r/:code', async (request, reply) => {
    const { code } = z.object({ code: z.string().min(4).max(8) }).parse(request.params);
    return reply.redirect(`${container.config.APP_URL}/r/${code.toUpperCase()}`);
  });
}
