import { appError, fail, ok, type Result } from '../../shared/result.js';

/**
 * Phone number in E.164 form (+ country code + subscriber number). Stored only;
 * never verified by SMS (decision B6).
 */
export class PhoneE164 {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<PhoneE164> {
    const value = raw.replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(value)) {
      return fail(appError('invalid_phone', 'The phone number is not in international format.', 422));
    }
    return ok(new PhoneE164(value));
  }
}
