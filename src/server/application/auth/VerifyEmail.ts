import { Errors } from '../../domain/errors/index.js';
import { fail, ok, type Result } from '../../shared/result.js';
import type {
  AccessLogRepository,
  EmailTokenRepository,
  UserRepository,
} from '../../domain/repositories/index.js';
import type { Clock, TokenGenerator } from '../ports/index.js';
import type { User } from '../../domain/entities/User.js';

export interface VerifyEmailDeps {
  users: UserRepository;
  tokens: EmailTokenRepository;
  log: AccessLogRepository;
  clock: Clock;
  tokenGen: TokenGenerator;
}

/** Consumes a one-time verification token and activates the account. */
export async function verifyEmail(
  deps: VerifyEmailDeps,
  token: string,
  ip?: string,
): Promise<Result<User>> {
  const now = deps.clock.now();
  const consumed = await deps.tokens.consume(deps.tokenGen.hash(token), 'VERIFY_EMAIL', now);
  if (!consumed) return fail(Errors.tokenInvalid());

  const user = await deps.users.findById(consumed.userId);
  if (!user) return fail(Errors.tokenInvalid());
  if (user.status === 'BLOCKED' || user.status === 'DELETED')
    return fail(Errors.accountUnavailable());

  const updated = await deps.users.update(user.id, {
    emailVerifiedAt: now,
    status: user.status === 'PENDING' ? 'ACTIVE' : user.status,
  });
  await deps.log.record({ userId: user.id, email: user.email, event: 'VERIFY', ip });
  return ok(updated);
}
