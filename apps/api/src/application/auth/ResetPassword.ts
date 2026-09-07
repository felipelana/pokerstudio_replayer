import { Errors } from '../../domain/errors/index.js';
import { Password } from '../../domain/value-objects/Password.js';
import { appError, fail, ok, type Result } from '../../shared/result.js';
import type {
  AccessLogRepository,
  EmailTokenRepository,
  SessionRepository,
  UserRepository,
} from '../../domain/repositories/index.js';
import type { Captcha, Clock, EmailSender, Hasher, PasswordBreachCheck, TokenGenerator } from '../ports/index.js';

export interface ResetDeps {
  users: UserRepository;
  tokens: EmailTokenRepository;
  sessions: SessionRepository;
  log: AccessLogRepository;
  hasher: Hasher;
  clock: Clock;
  tokenGen: TokenGenerator;
  email: EmailSender;
  captcha: Captcha;
  breach: PasswordBreachCheck;
}

const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Starts a password reset. The answer is identical whether or not the address
 * exists, and nothing is sent for an unknown address.
 */
export async function requestPasswordReset(
  deps: ResetDeps,
  input: { email: string; captchaToken?: string; ip?: string },
): Promise<Result<{ token?: string }>> {
  if (!(await deps.captcha.verify(input.captchaToken, input.ip))) return fail(Errors.captchaFailed());
  const email = input.email.trim().toLowerCase();
  const now = deps.clock.now();
  await deps.log.record({ email, event: 'RESET_REQUEST', ip: input.ip });

  const user = await deps.users.findByEmail(email);
  if (!user || user.status === 'BLOCKED' || user.status === 'DELETED') return ok({});

  const token = deps.tokenGen.create();
  await deps.tokens.create({
    userId: user.id,
    type: 'RESET_PASSWORD',
    tokenHash: deps.tokenGen.hash(token),
    expiresAt: new Date(now.getTime() + RESET_TTL_MS),
  });
  await deps.email.send({
    to: user.email,
    template: 'reset-password',
    locale: user.language,
    payload: { name: user.name, token },
  });
  return ok({ token });
}

/** Applies a new password and drops every existing session. */
export async function resetPassword(
  deps: ResetDeps,
  input: { token: string; password: string; ip?: string },
): Promise<Result<{ userId: string }>> {
  const password = Password.create(input.password);
  if (!password.ok) return password;
  if (await deps.breach.isBreached(input.password)) {
    return fail(appError('breached_password', 'This password appears in a known data breach. Choose another.', 422));
  }

  const now = deps.clock.now();
  const consumed = await deps.tokens.consume(deps.tokenGen.hash(input.token), 'RESET_PASSWORD', now);
  if (!consumed) return fail(Errors.tokenInvalid());

  await deps.users.update(consumed.userId, { passwordHash: await deps.hasher.hash(input.password) });
  await deps.sessions.revokeAllForUser(consumed.userId);
  await deps.log.record({ userId: consumed.userId, event: 'RESET_OK', ip: input.ip });
  return ok({ userId: consumed.userId });
}
