import { appError, fail, ok, type Result } from '../../shared/result.js';

/** A normalised, syntactically valid e-mail address. */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email> {
    const value = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      return fail(appError('invalid_email', 'The e-mail address is not valid.', 422));
    }
    if (value.length > 254) return fail(appError('invalid_email', 'The e-mail address is too long.', 422));
    return ok(new Email(value));
  }

  toString(): string {
    return this.value;
  }
}
