import { appError, fail, ok, type Result } from '../../shared/result.js';

export const MIN_PASSWORD_LENGTH = 10;

/**
 * A plaintext password that satisfies the policy. It never leaves the domain:
 * the application layer hands it straight to the hasher.
 */
export class Password {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Password> {
    if (raw.length < MIN_PASSWORD_LENGTH) {
      return fail(
        appError('weak_password', `Use at least ${MIN_PASSWORD_LENGTH} characters.`, 422),
      );
    }
    if (raw.length > 256) return fail(appError('weak_password', 'The password is too long.', 422));
    if (/^(.)\1+$/.test(raw))
      return fail(appError('weak_password', 'The password is too simple.', 422));
    return ok(new Password(raw));
  }
}
