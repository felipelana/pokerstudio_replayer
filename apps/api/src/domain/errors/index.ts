import { appError } from '../../shared/result.js';

/**
 * Domain errors. Login and password-reset failures deliberately share a single
 * generic message so the API never reveals whether an account exists (B10).
 */
export const Errors = {
  invalidCredentials: () => appError('invalid_credentials', 'E-mail or password is incorrect.', 401),
  accountLocked: (minutes: number) =>
    appError('account_locked', `Too many attempts. Try again in ${minutes} minutes.`, 429),
  accountUnavailable: () => appError('account_unavailable', 'This account is not available.', 403),
  emailInUse: () => appError('email_in_use', 'This e-mail is already registered.', 409),
  tokenInvalid: () => appError('token_invalid', 'This link is invalid or has expired.', 400),
  notAuthenticated: () => appError('not_authenticated', 'Authentication required.', 401),
  forbidden: () => appError('forbidden', 'You do not have access to this resource.', 403),
  twoFactorRequired: () => appError('two_factor_required', 'Second factor required.', 403),
  notFound: (what = 'Resource') => appError('not_found', `${what} not found.`, 404),
  quotaExceeded: (what: string) => appError('quota_exceeded', `Daily limit reached for ${what}.`, 429),
  captchaFailed: () => appError('captcha_failed', 'Could not verify you are human.', 400),
  termsRequired: () => appError('terms_required', 'You must accept the terms to continue.', 422),
} as const;
