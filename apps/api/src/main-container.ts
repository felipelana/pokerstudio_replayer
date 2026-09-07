import { PrismaClient } from '@prisma/client';
import type {
  AccessLogRepository,
  EmailTokenRepository,
  IdentityRepository,
  LoginAttemptRepository,
  ReferralRepository,
  SessionRepository,
  SkinRepository,
  UserRepository,
} from './domain/repositories/index.js';
import type {
  Captcha,
  Clock,
  EmailSender,
  GeoIpResolver,
  Hasher,
  PasswordBreachCheck,
  TokenGenerator,
  TotpProvider,
  UserAgentParser,
} from './application/ports/index.js';
import { argon2Hasher, hibpBreachCheck, tokenGenerator, totpProvider } from './infrastructure/crypto/index.js';
import { createTurnstile } from './infrastructure/captcha/index.js';
import { createGeoIpResolver, uaParser } from './infrastructure/ua/index.js';
import { createEmailSender } from './infrastructure/email/index.js';
import {
  createAccessLogRepository,
  createEmailTokenRepository,
  createIdentityRepository,
  createLoginAttemptRepository,
  createReferralRepository,
  createSessionRepository,
  createSkinRepository,
  createUserRepository,
} from './infrastructure/database/prisma/repositories.js';
import type { Config } from './shared/config.js';

/**
 * Composition root: the only place that knows about concrete adapters.
 * Nothing above it (domain, application) imports from infrastructure.
 */
export interface AppContainer {
  config: Config;
  prisma: PrismaClient;
  users: UserRepository;
  sessions: SessionRepository;
  tokens: EmailTokenRepository;
  log: AccessLogRepository;
  attempts: LoginAttemptRepository;
  identities: IdentityRepository;
  skins: SkinRepository;
  referrals: ReferralRepository;
  hasher: Hasher;
  clock: Clock;
  tokenGen: TokenGenerator;
  email: EmailSender;
  captcha: Captcha;
  geo: GeoIpResolver;
  ua: UserAgentParser;
  totp: TotpProvider;
  breach: PasswordBreachCheck;
  /** False while no e-mail provider is configured (5B.5). */
  requireVerification: boolean;
}

export async function createContainer(config: Config, prisma = new PrismaClient()): Promise<AppContainer> {
  const settings = await prisma.emailSettings.findUnique({ where: { id: 1 } }).catch(() => null);
  const provider = (settings?.provider ?? (config.EMAIL_PROVIDER_KEY ? 'RESEND' : 'NONE')) as 'NONE' | 'RESEND' | 'SMTP';

  return {
    config,
    prisma,
    users: createUserRepository(prisma),
    sessions: createSessionRepository(prisma),
    tokens: createEmailTokenRepository(prisma),
    log: createAccessLogRepository(prisma),
    attempts: createLoginAttemptRepository(prisma),
    identities: createIdentityRepository(prisma),
    skins: createSkinRepository(prisma),
    referrals: createReferralRepository(prisma),
    hasher: argon2Hasher,
    clock: { now: () => new Date() },
    tokenGen: tokenGenerator,
    email: createEmailSender(
      prisma,
      {
        provider,
        from: settings?.fromAddress ?? config.EMAIL_FROM,
        fromName: settings?.fromName ?? config.EMAIL_FROM_NAME,
        replyTo: settings?.replyTo ?? config.EMAIL_REPLY_TO,
        apiKey: config.EMAIL_PROVIDER_KEY,
        appUrl: config.APP_URL,
      },
      (msg) => !config.isProduction && console.log(msg),
    ),
    captcha: createTurnstile(config.TURNSTILE_SECRET),
    geo: createGeoIpResolver(config.GEOIP_DB_PATH),
    ua: uaParser,
    totp: totpProvider,
    breach: config.isProduction ? hibpBreachCheck : { isBreached: async () => false },
    requireVerification: settings?.requireVerification ?? false,
  };
}
