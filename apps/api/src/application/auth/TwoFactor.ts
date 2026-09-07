import { Errors } from '../../domain/errors/index.js';
import { fail, ok, type Result } from '../../shared/result.js';
import type { AccessLogRepository, SessionRepository, TwoFactorRepository } from '../../domain/repositories/index.js';
import type { Clock, TokenGenerator, TotpProvider } from '../ports/index.js';
import type { AppError } from '../../shared/result.js';
import type { User } from '../../domain/entities/User.js';

export interface TwoFactorDeps {
  twoFactor: TwoFactorRepository;
  sessions: SessionRepository;
  log: AccessLogRepository;
  totp: TotpProvider;
  clock: Clock;
  tokenGen: TokenGenerator;
  cipher: { encrypt(plain: string): string; decrypt(payload: string): string | undefined };
  issuer: string;
}

/** Ten codes, shown once. Grouped for reading aloud over the phone. */
const RECOVERY_CODE_COUNT = 10;

function recoveryCode(tokenGen: TokenGenerator): string {
  const raw = tokenGen.create().replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

/**
 * Starts (or restarts) the TOTP enrolment. The seed is returned exactly once,
 * as a key URI for the QR code and in text for manual entry; from here on it
 * only exists encrypted.
 */
export async function startTotpEnrollment(
  deps: TwoFactorDeps,
  user: User,
): Promise<Result<{ keyUri: string; secret: string }, AppError>> {
  const existing = await deps.twoFactor.find(user.id);
  if (existing?.confirmedAt) return fail(Errors.twoFactorAlreadyEnrolled());

  const secret = deps.totp.generateSecret();
  await deps.twoFactor.start({ userId: user.id, secretEnc: deps.cipher.encrypt(secret) });
  await deps.log.record({ userId: user.id, event: 'TOTP_ENROLL_STARTED' });

  return ok({ keyUri: deps.totp.keyUri(secret, user.email, deps.issuer), secret });
}

/**
 * Checks a six-digit code. The first valid code confirms the enrolment and
 * returns the recovery codes; later ones simply mark the session as verified.
 */
export async function verifyTotp(
  deps: TwoFactorDeps,
  input: { user: User; sessionId: string; code: string; ip?: string },
): Promise<Result<{ confirmed: boolean; recoveryCodes?: string[] }, AppError>> {
  const enrollment = await deps.twoFactor.find(input.user.id);
  const secret = enrollment?.secretEnc ? deps.cipher.decrypt(enrollment.secretEnc) : undefined;
  if (!enrollment || !secret) return fail(Errors.twoFactorNotEnrolled());

  const result = deps.totp.verify(secret, input.code.replace(/\s/g, ''), enrollment.lastUsedStep);
  if (!result.valid || result.step === undefined) {
    await deps.log.record({ userId: input.user.id, event: 'TOTP_FAIL', ip: input.ip });
    return fail(Errors.twoFactorInvalid());
  }

  const now = deps.clock.now();
  const firstTime = !enrollment.confirmedAt;

  if (firstTime) await deps.twoFactor.confirm(input.user.id, now, result.step);
  else await deps.twoFactor.markStep(input.user.id, result.step);

  await deps.sessions.markTwoFactor(input.sessionId, now);
  await deps.log.record({
    userId: input.user.id,
    event: firstTime ? 'TOTP_ENROLLED' : 'TOTP_OK',
    ip: input.ip,
  });

  if (!firstTime) return ok({ confirmed: false });

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => recoveryCode(deps.tokenGen));
  await deps.twoFactor.replaceRecoveryCodes(
    input.user.id,
    codes.map((code) => deps.tokenGen.hash(code)),
  );
  return ok({ confirmed: true, recoveryCodes: codes });
}

/** A recovery code passes the gate once, for the admin who lost the phone. */
export async function useRecoveryCode(
  deps: TwoFactorDeps,
  input: { user: User; sessionId: string; code: string; ip?: string },
): Promise<Result<{ remaining: number }, AppError>> {
  const normalised = input.code.trim().toUpperCase();
  const used = await deps.twoFactor.consumeRecoveryCode(
    input.user.id,
    deps.tokenGen.hash(normalised),
    deps.clock.now(),
  );
  if (!used) {
    await deps.log.record({ userId: input.user.id, event: 'TOTP_FAIL', ip: input.ip });
    return fail(Errors.twoFactorInvalid());
  }

  await deps.sessions.markTwoFactor(input.sessionId, deps.clock.now());
  await deps.log.record({ userId: input.user.id, event: 'RECOVERY_CODE_USED', ip: input.ip });
  return ok({ remaining: await deps.twoFactor.countRecoveryCodes(input.user.id) });
}

/**
 * Turning the second factor off needs a valid code — knowing the session is not
 * enough, or a borrowed browser would be able to strip the protection.
 */
export async function disableTotp(
  deps: TwoFactorDeps,
  input: { user: User; code: string; ip?: string },
): Promise<Result<{ ok: true }, AppError>> {
  const enrollment = await deps.twoFactor.find(input.user.id);
  const secret = enrollment?.secretEnc ? deps.cipher.decrypt(enrollment.secretEnc) : undefined;
  if (!enrollment?.confirmedAt || !secret) return fail(Errors.twoFactorNotEnrolled());

  const result = deps.totp.verify(secret, input.code.replace(/\s/g, ''), enrollment.lastUsedStep);
  if (!result.valid) {
    await deps.log.record({ userId: input.user.id, event: 'TOTP_FAIL', ip: input.ip });
    return fail(Errors.twoFactorInvalid());
  }

  await deps.twoFactor.remove(input.user.id);
  await deps.log.record({ userId: input.user.id, event: 'TOTP_DISABLED', ip: input.ip });
  return ok({ ok: true });
}
