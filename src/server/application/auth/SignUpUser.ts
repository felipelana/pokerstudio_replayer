import { Email } from '../../domain/value-objects/Email.js';
import { Password } from '../../domain/value-objects/Password.js';
import { PhoneE164 } from '../../domain/value-objects/PhoneE164.js';
import { ReferralCode } from '../../domain/value-objects/ReferralCode.js';
import { Errors } from '../../domain/errors/index.js';
import { appError, fail, ok, type Result } from '../../shared/result.js';
import type {
  UserRepository,
  EmailTokenRepository,
  AccessLogRepository,
  ReferralRepository,
} from '../../domain/repositories/index.js';
import type {
  Captcha,
  Clock,
  EmailSender,
  Hasher,
  PasswordBreachCheck,
  TokenGenerator,
} from '../ports/index.js';
import type { User } from '../../domain/entities/User.js';

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  countryCode: string;
  language: string;
  phone?: string;
  phoneCountry?: string;
  marketingOptIn?: boolean;
  acceptedTerms: boolean;
  referralCode?: string;
  captchaToken?: string;
  ip?: string;
  userAgent?: string;
}

export interface SignUpDeps {
  users: UserRepository;
  tokens: EmailTokenRepository;
  referrals: ReferralRepository;
  log: AccessLogRepository;
  hasher: Hasher;
  clock: Clock;
  tokenGen: TokenGenerator;
  email: EmailSender;
  captcha: Captcha;
  breach: PasswordBreachCheck;
  adminEmails: string[];
  /** Accounts start ACTIVE while no e-mail provider is configured (5B.5). */
  requireVerification: boolean;
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Creates an account. Refuses weak or breached passwords, honours the referral
 * code, and queues the verification e-mail (which may sit in the outbox).
 */
export async function signUpUser(
  deps: SignUpDeps,
  input: SignUpInput,
): Promise<Result<{ user: User; verificationToken?: string }>> {
  if (!input.acceptedTerms) return fail(Errors.termsRequired());
  if (!(await deps.captcha.verify(input.captchaToken, input.ip)))
    return fail(Errors.captchaFailed());

  const email = Email.create(input.email);
  if (!email.ok) return email;
  const password = Password.create(input.password);
  if (!password.ok) return password;
  if (await deps.breach.isBreached(input.password)) {
    return fail(
      appError(
        'breached_password',
        'This password appears in a known data breach. Choose another.',
        422,
      ),
    );
  }
  if (!input.name.trim()) return fail(appError('invalid_name', 'Tell us your name.', 422));
  if (!/^[A-Za-z]{2}$/.test(input.countryCode))
    return fail(appError('invalid_country', 'Choose your country.', 422));

  let phoneE164: string | undefined;
  if (input.phone?.trim()) {
    const phone = PhoneE164.create(input.phone);
    if (!phone.ok) return phone;
    phoneE164 = phone.value.value;
  }

  if (await deps.users.findByEmail(email.value.value)) return fail(Errors.emailInUse());

  const referrer = input.referralCode
    ? await deps.users.findByReferralCode(input.referralCode.toUpperCase())
    : undefined;
  const now = deps.clock.now();
  const user = await deps.users.create({
    email: email.value.value,
    name: input.name.trim(),
    passwordHash: await deps.hasher.hash(input.password),
    countryCode: input.countryCode.toUpperCase(),
    language: input.language,
    phoneE164,
    phoneCountry: input.phoneCountry?.toUpperCase(),
    referralCode: ReferralCode.generate().value,
    referredById: referrer?.id,
    marketingOptIn: !!input.marketingOptIn,
    termsAcceptedAt: now,
    role: deps.adminEmails.includes(email.value.value) ? 'ADMIN' : 'USER',
    status: deps.requireVerification ? 'PENDING' : 'ACTIVE',
  });

  const token = deps.tokenGen.create();
  await deps.tokens.create({
    userId: user.id,
    type: 'VERIFY_EMAIL',
    tokenHash: deps.tokenGen.hash(token),
    expiresAt: new Date(now.getTime() + VERIFY_TTL_MS),
  });
  await deps.email.send({
    to: user.email,
    template: 'verify-email',
    locale: user.language,
    payload: { name: user.name, token },
  });
  if (referrer) await deps.referrals.markAccepted(input.referralCode!.toUpperCase(), user.id, now);
  await deps.log.record({
    userId: user.id,
    email: user.email,
    event: 'SIGNUP',
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return ok({ user, verificationToken: token });
}
