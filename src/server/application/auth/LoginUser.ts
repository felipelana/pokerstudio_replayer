import { Errors } from '../../domain/errors/index.js';
import { canAuthenticate } from '../../domain/entities/User.js';
import { fail, ok, type Result } from '../../shared/result.js';
import type {
  AccessLogRepository,
  LoginAttemptRepository,
  SessionRepository,
  UserRepository,
} from '../../domain/repositories/index.js';
import type {
  Clock,
  GeoIpResolver,
  Hasher,
  TokenGenerator,
  UserAgentParser,
} from '../ports/index.js';
import type { User } from '../../domain/entities/User.js';

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
  ip?: string;
  userAgent?: string;
}

export interface LoginDeps {
  users: UserRepository;
  sessions: SessionRepository;
  attempts: LoginAttemptRepository;
  log: AccessLogRepository;
  hasher: Hasher;
  clock: Clock;
  tokenGen: TokenGenerator;
  ua: UserAgentParser;
  geo: GeoIpResolver;
  requireVerification: boolean;
}

export const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 24 * 60 * 60 * 1000;
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Password login. Every failure — unknown e-mail, wrong password, blocked
 * account — answers with the same generic error, so the endpoint cannot be
 * used to discover who has an account.
 */
export async function loginUser(
  deps: LoginDeps,
  input: LoginInput,
): Promise<Result<{ user: User; token: string; expiresAt: Date }>> {
  const now = deps.clock.now();
  const email = input.email.trim().toLowerCase();
  const keys = [`email:${email}`, `ip:${input.ip ?? 'unknown'}`];

  for (const key of keys) {
    const locked = await deps.attempts.lockedUntil(key, now);
    if (locked) {
      await recordFailure(deps, { email, input, event: 'LOGIN_FAIL', reason: 'locked' });
      return fail(Errors.accountLocked(Math.ceil((locked.getTime() - now.getTime()) / 60000)));
    }
  }

  const user = await deps.users.findByEmail(email);
  const passwordOk = user?.passwordHash
    ? await deps.hasher.verify(user.passwordHash, input.password)
    : false;

  if (!user || !passwordOk || !canAuthenticate(user, deps.requireVerification)) {
    for (const key of keys)
      await deps.attempts.registerFailure(key, now, MAX_ATTEMPTS, WINDOW_MS, LOCK_MS);
    await recordFailure(deps, {
      email,
      input,
      event:
        user && !canAuthenticate(user, deps.requireVerification) ? 'BLOCKED_ATTEMPT' : 'LOGIN_FAIL',
      reason: !user ? 'unknown_email' : !passwordOk ? 'bad_password' : 'not_authenticable',
      userId: user?.id,
    });
    return fail(Errors.invalidCredentials());
  }

  for (const key of keys) await deps.attempts.clear(key);
  const token = deps.tokenGen.create();
  const expiresAt = new Date(now.getTime() + (input.rememberMe ? REMEMBER_MS : SESSION_MS));
  await deps.sessions.create({
    userId: user.id,
    tokenHash: deps.tokenGen.hash(token),
    expiresAt,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  const ua = deps.ua.parse(input.userAgent);
  await deps.log.record({
    userId: user.id,
    email: user.email,
    event: user.role === 'ADMIN' ? 'ADMIN_LOGIN_OK' : 'LOGIN_OK',
    ip: input.ip,
    country: deps.geo.countryFor(input.ip),
    userAgent: input.userAgent,
    ...ua,
    detail: { method: 'PASSWORD' },
  });

  return ok({ user, token, expiresAt });
}

async function recordFailure(
  deps: LoginDeps,
  args: { email: string; input: LoginInput; event: string; reason: string; userId?: string },
) {
  const ua = deps.ua.parse(args.input.userAgent);
  await deps.log.record({
    userId: args.userId,
    email: args.email,
    event: args.event,
    ip: args.input.ip,
    country: deps.geo.countryFor(args.input.ip),
    userAgent: args.input.userAgent,
    ...ua,
    detail: { method: 'PASSWORD', reason: args.reason },
  });
}
