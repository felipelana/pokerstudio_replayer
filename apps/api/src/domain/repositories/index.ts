import type { AuthProvider, User, UserRole, UserStatus } from '../entities/User.js';
import type { Session } from '../entities/Session.js';
import type { UserSkin } from '../entities/UserSkin.js';

/** Ports. Implementations live in infrastructure and are wired in main.ts. */

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash?: string;
  countryCode: string;
  language: string;
  phoneE164?: string;
  phoneCountry?: string;
  referralCode: string;
  referredById?: string;
  marketingOptIn: boolean;
  termsAcceptedAt?: Date;
  role: UserRole;
  status: UserStatus;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  findByReferralCode(code: string): Promise<User | undefined>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, patch: Partial<User>): Promise<User>;
  list(filter: { q?: string; status?: UserStatus; country?: string; page: number; pageSize: number }): Promise<{ items: User[]; total: number }>;
}

export interface SessionRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date; ip?: string; userAgent?: string; twoFactorAt?: Date }): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | undefined>;
  touch(id: string, at: Date): Promise<void>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<number>;
  listForUser(userId: string): Promise<Session[]>;
  markTwoFactor(id: string, at: Date): Promise<void>;
}

export interface TwoFactorEnrollment {
  id: string;
  secretEnc?: string;
  confirmedAt?: Date;
  lastUsedStep?: bigint;
}

export interface TwoFactorRepository {
  find(userId: string): Promise<TwoFactorEnrollment | undefined>;
  /** Starts (or restarts) an enrolment; the previous secret is replaced. */
  start(input: { userId: string; secretEnc: string }): Promise<void>;
  confirm(userId: string, at: Date, step: bigint): Promise<void>;
  markStep(userId: string, step: bigint): Promise<void>;
  remove(userId: string): Promise<void>;
  /** Replaces every recovery code — used codes included. */
  replaceRecoveryCodes(userId: string, hashes: string[]): Promise<void>;
  /** Burns one code and says whether it was valid and unused. */
  consumeRecoveryCode(userId: string, hash: string, at: Date): Promise<boolean>;
  countRecoveryCodes(userId: string): Promise<number>;
}

export interface EmailTokenRepository {
  create(input: { userId: string; type: 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'CHANGE_EMAIL'; tokenHash: string; expiresAt: Date }): Promise<void>;
  consume(tokenHash: string, type: 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'CHANGE_EMAIL', now: Date): Promise<{ userId: string } | undefined>;
}

export interface AccessLogInput {
  userId?: string;
  email?: string;
  event: string;
  ip?: string;
  country?: string;
  userAgent?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  browserVersion?: string;
  origin?: string;
  appSurface?: string;
  detail?: Record<string, unknown>;
}

export interface AccessLogRepository {
  record(input: AccessLogInput): Promise<void>;
  list(filter: { userId?: string; event?: string; from?: Date; to?: Date; page: number; pageSize: number }): Promise<{ items: (AccessLogInput & { id: string; createdAt: Date })[]; total: number }>;
  purgeOlderThan(date: Date): Promise<number>;
}

export type ErrorSource = 'SERVER' | 'CLIENT';
export type ErrorLevel = 'WARN' | 'ERROR' | 'FATAL';

export interface ErrorLogInput {
  source: ErrorSource;
  level: ErrorLevel;
  env: string;
  release?: string;
  message: string;
  stack?: string;
  route?: string;
  statusCode?: number;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
}

export type ErrorLogRow = ErrorLogInput & { id: string; createdAt: Date };

export interface ErrorLogFilter {
  level?: ErrorLevel;
  source?: ErrorSource;
  env?: string;
  /** Matches the message or the route; how an administrator looks for a fault. */
  q?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface ErrorLogRepository {
  record(input: ErrorLogInput): Promise<void>;
  list(filter: ErrorLogFilter): Promise<{ items: ErrorLogRow[]; total: number }>;
  find(id: string): Promise<ErrorLogRow | undefined>;
  /** Counts by level since a moment — what the tab shows above the table. */
  summarise(since: Date): Promise<{ level: ErrorLevel; count: number }[]>;
  purgeOlderThan(date: Date): Promise<number>;
}

export interface LoginAttemptRepository {
  /** Returns the lock expiry when the key is currently locked. */
  lockedUntil(key: string, now: Date): Promise<Date | undefined>;
  registerFailure(key: string, now: Date, maxAttempts: number, windowMs: number, lockMs: number): Promise<void>;
  clear(key: string): Promise<void>;
}

export interface IdentityRepository {
  find(provider: AuthProvider, providerUserId: string): Promise<{ userId: string } | undefined>;
  link(input: { userId: string; provider: AuthProvider; providerUserId: string; email: string; avatarUrl?: string }): Promise<void>;
  unlink(userId: string, provider: AuthProvider): Promise<void>;
  listForUser(userId: string): Promise<AuthProvider[]>;
}

export interface SkinRepository {
  listForUser(userId: string): Promise<UserSkin[]>;
  save(input: { userId: string; skinId: string; name: string; data: unknown; isDefault?: boolean }): Promise<UserSkin>;
  remove(userId: string, skinId: string): Promise<void>;
}

export interface ReferralRepository {
  create(input: { referrerId: string; channel: 'WHATSAPP' | 'EMAIL' | 'LINK'; code: string; inviteeEmail?: string; inviteePhone?: string }): Promise<void>;
  listForUser(userId: string): Promise<{ id: string; channel: string; sentAt: Date; acceptedAt?: Date; inviteeEmail?: string }[]>;
  markAccepted(code: string, userId: string, at: Date): Promise<void>;
}
