import { Errors } from '../../domain/errors/index.js';
import { Password } from '../../domain/value-objects/Password.js';
import { PhoneE164 } from '../../domain/value-objects/PhoneE164.js';
import { appError, fail, ok, type Result } from '../../shared/result.js';
import type {
  AccessLogRepository,
  IdentityRepository,
  ReferralRepository,
  SessionRepository,
  SkinRepository,
  UserRepository,
} from '../../domain/repositories/index.js';
import type { Clock, Hasher, PasswordBreachCheck } from '../ports/index.js';
import type { User } from '../../domain/entities/User.js';

export interface AccountDeps {
  users: UserRepository;
  sessions: SessionRepository;
  identities: IdentityRepository;
  skins: SkinRepository;
  referrals: ReferralRepository;
  log: AccessLogRepository;
  hasher: Hasher;
  clock: Clock;
  breach: PasswordBreachCheck;
  countries: readonly string[];
  languages: readonly string[];
}

export interface ProfilePatch {
  name?: string;
  phone?: string | null;
  phoneCountry?: string;
  countryCode?: string;
  language?: string;
  marketingOptIn?: boolean;
}

/** Edits the parts of the profile the owner is free to change. */
export async function updateProfile(
  deps: AccountDeps,
  input: { user: User; patch: ProfilePatch; ip?: string },
): Promise<Result<User>> {
  const patch: Partial<User> = {};

  if (input.patch.name !== undefined) {
    const name = input.patch.name.trim();
    if (name.length < 2)
      return fail(appError('invalid_name', 'Tell us a name with at least 2 characters.', 422));
    patch.name = name;
  }

  if (input.patch.phone !== undefined) {
    if (input.patch.phone === null || input.patch.phone.trim() === '') {
      patch.phoneE164 = undefined;
      patch.phoneCountry = undefined;
    } else {
      const phone = PhoneE164.create(input.patch.phone);
      if (!phone.ok) return fail(phone.error);
      patch.phoneE164 = phone.value.value;
      patch.phoneCountry = input.patch.phoneCountry;
    }
  }

  if (input.patch.countryCode !== undefined) {
    if (!deps.countries.includes(input.patch.countryCode)) {
      return fail(appError('invalid_country', 'That country is not in the list.', 422));
    }
    patch.countryCode = input.patch.countryCode;
  }

  if (input.patch.language !== undefined) {
    if (!deps.languages.includes(input.patch.language)) {
      return fail(appError('invalid_language', 'That language is not available.', 422));
    }
    patch.language = input.patch.language;
  }

  if (input.patch.marketingOptIn !== undefined) patch.marketingOptIn = input.patch.marketingOptIn;

  if (Object.keys(patch).length === 0) return ok(input.user);

  const updated = await deps.users.update(input.user.id, patch);
  await deps.log.record({
    userId: input.user.id,
    event: 'PROFILE_UPDATED',
    ip: input.ip,
    detail: { fields: Object.keys(patch) },
  });
  return ok(updated);
}

/**
 * Changes the password of a signed-in account. Every other session is revoked:
 * if the reason for the change was a leak, the leaked session goes with it.
 */
export async function changePassword(
  deps: AccountDeps,
  input: {
    user: User;
    currentPassword: string;
    newPassword: string;
    keepSessionId: string;
    ip?: string;
  },
): Promise<Result<{ revoked: number }>> {
  // An account that only signs in with Google has no password to check against.
  if (!input.user.passwordHash)
    return fail(appError('password_not_set', 'This account has no password yet.', 409));
  if (!(await deps.hasher.verify(input.user.passwordHash, input.currentPassword))) {
    await deps.log.record({
      userId: input.user.id,
      event: 'LOGIN_FAIL',
      ip: input.ip,
      detail: { at: 'change_password' },
    });
    return fail(Errors.invalidCredentials());
  }

  const password = Password.create(input.newPassword);
  if (!password.ok) return fail(password.error);
  if (await deps.breach.isBreached(password.value.value)) {
    return fail(
      appError('breached_password', 'This password appears in known leaks. Choose another.', 422),
    );
  }

  await deps.users.update(input.user.id, {
    passwordHash: await deps.hasher.hash(password.value.value),
  });
  const revoked = await deps.sessions.revokeAllForUser(input.user.id);
  await deps.sessions.markTwoFactor(input.keepSessionId, deps.clock.now());
  await deps.log.record({
    userId: input.user.id,
    event: 'RESET_OK',
    ip: input.ip,
    detail: { method: 'CHANGE_PASSWORD' },
  });
  return ok({ revoked });
}

/**
 * Sets a first password on an account created through a provider, so signing in
 * does not depend on that provider for ever.
 */
export async function setFirstPassword(
  deps: AccountDeps,
  input: { user: User; newPassword: string; ip?: string },
): Promise<Result<{ ok: true }>> {
  if (input.user.passwordHash)
    return fail(appError('password_already_set', 'This account already has a password.', 409));

  const password = Password.create(input.newPassword);
  if (!password.ok) return fail(password.error);
  if (await deps.breach.isBreached(password.value.value)) {
    return fail(
      appError('breached_password', 'This password appears in known leaks. Choose another.', 422),
    );
  }

  await deps.users.update(input.user.id, {
    passwordHash: await deps.hasher.hash(password.value.value),
  });
  await deps.log.record({
    userId: input.user.id,
    event: 'RESET_OK',
    ip: input.ip,
    detail: { method: 'SET_PASSWORD' },
  });
  return ok({ ok: true });
}

/**
 * Everything the account holds, in one JSON document (LGPD art. 18, V). Hashes
 * and tokens are left out — they are ours, not the user's data.
 */
export async function exportAccount(
  deps: AccountDeps,
  user: User,
): Promise<Result<Record<string, unknown>>> {
  const [sessions, identities, skins, referrals, logs] = await Promise.all([
    deps.sessions.listForUser(user.id),
    deps.identities.listForUser(user.id),
    deps.skins.listForUser(user.id),
    deps.referrals.listForUser(user.id),
    deps.log.list({ userId: user.id, page: 1, pageSize: 500 }),
  ]);

  return ok({
    exportedAt: deps.clock.now().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneE164: user.phoneE164,
      countryCode: user.countryCode,
      language: user.language,
      plan: user.plan,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      termsAcceptedAt: user.termsAcceptedAt,
      marketingOptIn: user.marketingOptIn,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
    },
    signInMethods: user.passwordHash ? ['PASSWORD', ...identities] : identities,
    sessions: sessions.map((s) => ({
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
      ip: s.ip,
      userAgent: s.userAgent,
    })),
    skins: skins.map((s) => ({
      skinId: s.skinId,
      name: s.name,
      updatedAt: s.updatedAt,
      data: s.data,
    })),
    referrals,
    accessLog: logs.items,
  });
}

/**
 * Closes the account. The row stays as DELETED with the personal fields wiped,
 * because sign-ups, referrals and the access log must keep adding up.
 */
export async function deleteAccount(
  deps: AccountDeps,
  input: { user: User; password?: string; ip?: string },
): Promise<Result<{ ok: true }>> {
  // With a password set, closing the account asks for it — a borrowed browser
  // should not be able to do this.
  if (input.user.passwordHash) {
    if (!input.password || !(await deps.hasher.verify(input.user.passwordHash, input.password))) {
      return fail(Errors.invalidCredentials());
    }
  }

  const now = deps.clock.now();
  await deps.users.update(input.user.id, {
    status: 'DELETED',
    name: 'Conta encerrada',
    // The address is kept in a form that cannot be read back but still collides
    // with itself, so the same person can sign up again later.
    email: `deleted+${input.user.id}@invalid`,
    phoneE164: undefined,
    phoneCountry: undefined,
    passwordHash: undefined,
    marketingOptIn: false,
  });
  await deps.identities.unlink(input.user.id, 'GOOGLE');
  await deps.sessions.revokeAllForUser(input.user.id);
  await deps.log.record({
    userId: input.user.id,
    event: 'ACCOUNT_DELETED',
    ip: input.ip,
    detail: { at: now.toISOString() },
  });
  return ok({ ok: true });
}
