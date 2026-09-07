import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LANGUAGE_CODES } from '@pokerstudio/shared';
import { signInWithGoogle } from '../../../application/auth/SignInWithGoogle.js';
import { Errors } from '../../../domain/errors/index.js';
import { problem } from '../errors.js';
import { clientIp, requireUser, setSessionCookie } from '../context.js';
import type { AppContainer } from '../../../main-container.js';
import type { OAuthProvider } from '../../../application/ports/oauth.js';

const OAUTH_COOKIE = 'ps_oauth';
/** The round trip to Google is short-lived on purpose. */
const OAUTH_TTL_MS = 10 * 60 * 1000;

interface OAuthCookie {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirect: string;
  referralCode?: string;
}

export async function googleRoutes(app: FastifyInstance, container: AppContainer, provider?: OAuthProvider) {
  const cookieOpts = { domain: container.config.COOKIE_DOMAIN, secure: container.config.isProduction };

  /** Lets the web app decide whether to render the Google button at all. */
  app.get('/auth/providers', async (_request, reply) => reply.send({ google: !!provider }));

  if (!provider) return;

  app.get('/auth/google', async (request, reply) => {
    const query = z
      .object({ redirect: z.string().optional(), ref: z.string().max(8).optional() })
      .parse(request.query);
    const start = provider.start();

    const payload: OAuthCookie = {
      state: start.state,
      nonce: start.nonce,
      codeVerifier: start.codeVerifier,
      // Only same-site paths, so the callback cannot be used as an open redirect.
      redirect: query.redirect?.startsWith('/') ? query.redirect : '/',
      referralCode: query.ref,
    };
    reply.setCookie(OAUTH_COOKIE, JSON.stringify(payload), {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieOpts.secure,
      signed: true,
      path: '/',
      maxAge: OAUTH_TTL_MS / 1000,
    });
    return reply.redirect(start.authorizationUrl);
  });

  app.get('/auth/google/callback', async (request, reply) => {
    const query = z
      .object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })
      .parse(request.query);

    const fallback = (code: string) => reply.redirect(`${container.config.APP_URL}/login?error=${code}`);

    // The user closed the Google window or refused consent.
    if (query.error || !query.code || !query.state) return fallback('google_cancelled');

    const raw = request.cookies?.[OAUTH_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : undefined;
    if (!unsigned?.valid || !unsigned.value) return fallback('google_state');
    reply.clearCookie(OAUTH_COOKIE, { path: '/' });

    let saved: OAuthCookie;
    try {
      saved = JSON.parse(unsigned.value) as OAuthCookie;
    } catch {
      return fallback('google_state');
    }
    // A mismatched state means the callback was not the one we started.
    if (saved.state !== query.state) return fallback('google_state');

    let profile;
    try {
      profile = await provider.complete({ code: query.code, codeVerifier: saved.codeVerifier, nonce: saved.nonce });
    } catch (err) {
      request.log.warn({ err }, 'google sign-in failed');
      return fallback('google_failed');
    }

    const result = await signInWithGoogle(
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
  });

  /** Unlinking is refused while Google is the only way into the account. */
  app.delete('/auth/google/link', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    if (!user.passwordHash) {
      return problem(reply, {
        code: 'password_required',
        message: 'Set a password before disconnecting Google.',
        status: 409,
      });
    }
    await container.identities.unlink(user.id, 'GOOGLE');
    await container.log.record({ userId: user.id, email: user.email, event: 'GOOGLE_UNLINKED', ip: clientIp(request) });
    return reply.status(204).send();
  });

  app.get('/auth/google/link', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    return reply.send({ linked: (await container.identities.listForUser(user.id)).includes('GOOGLE') });
  });

  app.get('/r/:code', async (request, reply) => {
    const { code } = z.object({ code: z.string().max(8) }).parse(request.params);
    const referrer = await container.users.findByReferralCode(code.toUpperCase());
    if (!referrer) return problem(reply, Errors.notFound('Referral code'));
    return reply.send({ ok: true, referrer: referrer.name });
  });
}
