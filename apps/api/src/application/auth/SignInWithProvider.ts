import { Errors } from '../../domain/errors/index.js';
import { canAuthenticate } from '../../domain/entities/User.js';
import { ReferralCode } from '../../domain/value-objects/ReferralCode.js';
import { appError, fail, ok, type Result } from '../../shared/result.js';
import type {
  AccessLogRepository,
  IdentityRepository,
  ReferralRepository,
  SessionRepository,
  UserRepository,
} from '../../domain/repositories/index.js';
import type { Clock, GeoIpResolver, TokenGenerator, UserAgentParser } from '../ports/index.js';
import type { OAuthProfile, OAuthProviderName } from '../ports/oauth.js';
import type { User } from '../../domain/entities/User.js';

export interface ProviderSignInDeps {
  users: UserRepository;
  sessions: SessionRepository;
  identities: IdentityRepository;
  referrals: ReferralRepository;
  log: AccessLogRepository;
  clock: Clock;
  tokenGen: TokenGenerator;
  ua: UserAgentParser;
  geo: GeoIpResolver;
  adminEmails: string[];
  languages: readonly string[];
}

export interface ProviderSignInInput {
  provider: OAuthProviderName;
  profile: OAuthProfile;
  /** Referral code carried through the OAuth `state`, so it survives the redirect. */
  referralCode?: string;
  ip?: string;
  userAgent?: string;
}

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Signs in with an identity provider — Google, Facebook or Apple — creating or
 * linking an account. Nothing here is specific to any of them: they all arrive
 * as a verified e-mail plus a stable id.
 *
 * The linking rule is the security-critical part: an existing account is only
 * linked automatically when its e-mail was already verified here. Linking to an
 * unverified local account would let anyone who registered someone else's
 * address take that account over by signing in with the provider.
 */
export async function signInWithProvider(
  deps: ProviderSignInDeps,
  input: ProviderSignInInput,
): Promise<Result<{ user: User; token: string; expiresAt: Date; created: boolean; needsProfile: boolean }>> {
  const { profile, provider } = input;
  const label = provider.charAt(0) + provider.slice(1).toLowerCase();
  if (!profile.emailVerified) {
    return fail(appError('provider_email_unverified', `Your ${label} e-mail is not verified.`, 403));
  }

  const now = deps.clock.now();
  const existingIdentity = await deps.identities.find(provider, profile.providerUserId);
  let user = existingIdentity ? await deps.users.findById(existingIdentity.userId) : undefined;
  let created = false;

  if (!user) {
    const byEmail = await deps.users.findByEmail(profile.email);
    if (byEmail) {
      if (byEmail.status === 'BLOCKED' || byEmail.status === 'DELETED') {
        await deps.log.record({
          userId: byEmail.id,
          email: byEmail.email,
          event: 'BLOCKED_ATTEMPT',
          ip: input.ip,
          detail: { method: provider },
        });
        return fail(Errors.accountUnavailable());
      }
      if (!byEmail.emailVerifiedAt) {
        // Deliberately not linked: the local account has not proven the address.
        return fail(
          appError(
            'link_requires_verification',
            `This e-mail already has an account. Sign in with your password, or verify the address first, to link ${label}.`,
            409,
          ),
        );
      }
      user = byEmail;
    } else {
      user = await deps.users.create({
        email: profile.email,
        name: profile.name?.trim() || profile.email.split('@')[0],
        countryCode: 'BR',
        language: pickLanguage(profile.locale, deps.languages),
        referralCode: ReferralCode.generate().value,
        referredById: input.referralCode
          ? (await deps.users.findByReferralCode(input.referralCode.toUpperCase()))?.id
          : undefined,
        marketingOptIn: false,
        role: deps.adminEmails.includes(profile.email) ? 'ADMIN' : 'USER',
        // The provider already proved the address, so the account starts usable.
        status: 'ACTIVE',
      });
      created = true;
      await deps.users.update(user.id, { emailVerifiedAt: now });
      user = { ...user, emailVerifiedAt: now };
      if (input.referralCode) await deps.referrals.markAccepted(input.referralCode.toUpperCase(), user.id, now);
      await deps.log.record({ userId: user.id, email: user.email, event: 'SIGNUP', ip: input.ip, detail: { method: provider } });
    }

    await deps.identities.link({
      userId: user.id,
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    });
    if (!created) {
      await deps.log.record({
        userId: user.id,
        email: user.email,
        event: provider === 'GOOGLE' ? 'GOOGLE_LINKED' : 'PROVIDER_LINKED',
        ip: input.ip,
        detail: { provider },
      });
    }
  }

  if (!canAuthenticate(user, false)) {
    await deps.log.record({
      userId: user.id,
      email: user.email,
      event: 'BLOCKED_ATTEMPT',
      ip: input.ip,
      detail: { method: provider },
    });
    return fail(Errors.accountUnavailable());
  }

  const token = deps.tokenGen.create();
  const expiresAt = new Date(now.getTime() + SESSION_MS);
  await deps.sessions.create({
    userId: user.id,
    tokenHash: deps.tokenGen.hash(token),
    expiresAt,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  await deps.log.record({
    userId: user.id,
    email: user.email,
    event: user.role === 'ADMIN' ? 'ADMIN_LOGIN_OK' : 'LOGIN_OK',
    ip: input.ip,
    country: deps.geo.countryFor(input.ip),
    userAgent: input.userAgent,
    ...deps.ua.parse(input.userAgent),
    detail: { method: provider },
  });

  // Google never reports a country: it stays a suggestion the user confirms.
  const needsProfile = created || !user.termsAcceptedAt;
  return ok({ user, token, expiresAt, created, needsProfile });
}

/** Maps Google's locale onto one of the app's languages. */
function pickLanguage(locale: string | undefined, languages: readonly string[]): string {
  if (!locale) return 'en';
  const exact = languages.find((l) => l.toLowerCase() === locale.toLowerCase());
  if (exact) return exact;
  const base = locale.split('-')[0].toLowerCase();
  return languages.find((l) => l.toLowerCase().startsWith(base)) ?? 'en';
}
