import type { PrismaClient, User as PrismaUser } from '@prisma/client';
import type { User } from '../../../domain/entities/User.js';
import type {
  AccessLogRepository,
  EmailTokenRepository,
  IdentityRepository,
  LoginAttemptRepository,
  ReferralRepository,
  SessionRepository,
  SkinRepository,
  TwoFactorRepository,
  UserRepository,
} from '../../../domain/repositories/index.js';

/** Persistence model -> domain entity. Prisma types stop here. */
function toUser(row: PrismaUser): User {
  return {
    id: row.id,
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt ?? undefined,
    passwordHash: row.passwordHash ?? undefined,
    name: row.name,
    phoneE164: row.phoneE164 ?? undefined,
    phoneCountry: row.phoneCountry ?? undefined,
    countryCode: row.countryCode,
    language: row.language,
    status: row.status,
    role: row.role,
    plan: row.plan,
    referralCode: row.referralCode,
    referredById: row.referredById ?? undefined,
    termsAcceptedAt: row.termsAcceptedAt ?? undefined,
    marketingOptIn: row.marketingOptIn,
    blockedReason: row.blockedReason ?? undefined,
    createdAt: row.createdAt,
  };
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async findByEmail(email) {
      const row = await prisma.user.findUnique({ where: { email } });
      return row ? toUser(row) : undefined;
    },
    async findById(id) {
      const row = await prisma.user.findUnique({ where: { id } });
      return row ? toUser(row) : undefined;
    },
    async findByReferralCode(code) {
      const row = await prisma.user.findUnique({ where: { referralCode: code } });
      return row ? toUser(row) : undefined;
    },
    async create(input) {
      return toUser(await prisma.user.create({ data: input }));
    },
    async update(id, patch) {
      return toUser(
        await prisma.user.update({
          where: { id },
          data: {
            emailVerifiedAt: patch.emailVerifiedAt,
            passwordHash: patch.passwordHash,
            name: patch.name,
            phoneE164: patch.phoneE164,
            phoneCountry: patch.phoneCountry,
            countryCode: patch.countryCode,
            language: patch.language,
            status: patch.status,
            role: patch.role,
            plan: patch.plan,
            blockedReason: patch.blockedReason ?? null,
            blockedAt: patch.status === 'BLOCKED' ? new Date() : undefined,
            marketingOptIn: patch.marketingOptIn,
            termsAcceptedAt: patch.termsAcceptedAt,
          },
        }),
      );
    },
    async list({ q, status, country, page, pageSize }) {
      const where = {
        ...(status ? { status } : {}),
        ...(country ? { countryCode: country } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' as const } },
                { name: { contains: q, mode: 'insensitive' as const } },
                { referralCode: q.toUpperCase() },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.user.count({ where }),
      ]);
      return { items: items.map(toUser), total };
    },
  };
}

export function createSessionRepository(prisma: PrismaClient): SessionRepository {
  return {
    async create(input) {
      const row = await prisma.session.create({ data: input });
      return { id: row.id, userId: row.userId, expiresAt: row.expiresAt, twoFactorAt: row.twoFactorAt ?? undefined };
    },
    async findByTokenHash(tokenHash) {
      const row = await prisma.session.findUnique({ where: { tokenHash } });
      return row
        ? {
            id: row.id,
            userId: row.userId,
            expiresAt: row.expiresAt,
            twoFactorAt: row.twoFactorAt ?? undefined,
            revokedAt: row.revokedAt ?? undefined,
            ip: row.ip ?? undefined,
            userAgent: row.userAgent ?? undefined,
          }
        : undefined;
    },
    async touch(id, at) {
      await prisma.session.update({ where: { id }, data: { lastSeenAt: at } });
    },
    async revoke(id) {
      await prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
    },
    async revokeAllForUser(userId) {
      const res = await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return res.count;
    },
    async listForUser(userId) {
      const rows = await prisma.session.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' } });
      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        expiresAt: r.expiresAt,
        revokedAt: r.revokedAt ?? undefined,
        ip: r.ip ?? undefined,
        userAgent: r.userAgent ?? undefined,
      }));
    },
    async markTwoFactor(id, at) {
      await prisma.session.update({ where: { id }, data: { twoFactorAt: at } });
    },
  };
}

export function createEmailTokenRepository(prisma: PrismaClient): EmailTokenRepository {
  return {
    async create(input) {
      await prisma.emailToken.create({ data: input });
    },
    async consume(tokenHash, type, now) {
      const row = await prisma.emailToken.findUnique({ where: { tokenHash } });
      if (!row || row.type !== type || row.usedAt || row.expiresAt < now) return undefined;
      await prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: now } });
      return { userId: row.userId };
    },
  };
}

export function createAccessLogRepository(prisma: PrismaClient): AccessLogRepository {
  return {
    async record(input) {
      await prisma.accessLog.create({
        data: {
          userId: input.userId,
          email: input.email,
          event: input.event as never,
          ip: input.ip,
          country: input.country,
          userAgent: input.userAgent,
          deviceType: (input.deviceType ?? 'UNKNOWN') as never,
          os: input.os,
          browser: input.browser,
          browserVersion: input.browserVersion,
          origin: input.origin,
          appSurface: input.appSurface,
          detail: input.detail as object | undefined,
        },
      });
    },
    async list({ userId, event, from, to, page, pageSize }) {
      const where = {
        ...(userId ? { userId } : {}),
        ...(event ? { event: event as never } : {}),
        ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.accessLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.accessLog.count({ where }),
      ]);
      return {
        items: rows.map((r) => ({
          id: String(r.id),
          userId: r.userId ?? undefined,
          email: r.email ?? undefined,
          event: r.event,
          ip: r.ip ?? undefined,
          country: r.country ?? undefined,
          userAgent: r.userAgent ?? undefined,
          deviceType: r.deviceType,
          os: r.os ?? undefined,
          browser: r.browser ?? undefined,
          browserVersion: r.browserVersion ?? undefined,
          origin: r.origin ?? undefined,
          appSurface: r.appSurface ?? undefined,
          detail: (r.detail as Record<string, unknown>) ?? undefined,
          createdAt: r.createdAt,
        })),
        total,
      };
    },
    async purgeOlderThan(date) {
      const res = await prisma.accessLog.deleteMany({ where: { createdAt: { lt: date } } });
      return res.count;
    },
  };
}

export function createLoginAttemptRepository(prisma: PrismaClient): LoginAttemptRepository {
  return {
    async lockedUntil(key, now) {
      const row = await prisma.loginAttempt.findUnique({ where: { key } });
      return row?.lockedUntil && row.lockedUntil > now ? row.lockedUntil : undefined;
    },
    async registerFailure(key, now, maxAttempts, windowMs, lockMs) {
      const row = await prisma.loginAttempt.findUnique({ where: { key } });
      const withinWindow = row && now.getTime() - row.windowStart.getTime() < windowMs;
      const count = withinWindow ? row.count + 1 : 1;
      await prisma.loginAttempt.upsert({
        where: { key },
        create: { key, count, windowStart: now },
        update: {
          count,
          windowStart: withinWindow ? row!.windowStart : now,
          lockedUntil: count >= maxAttempts ? new Date(now.getTime() + lockMs) : null,
        },
      });
    },
    async clear(key) {
      await prisma.loginAttempt.deleteMany({ where: { key } });
    },
  };
}

export function createIdentityRepository(prisma: PrismaClient): IdentityRepository {
  return {
    async find(provider, providerUserId) {
      const row = await prisma.authIdentity.findUnique({ where: { provider_providerUserId: { provider, providerUserId } } });
      return row ? { userId: row.userId } : undefined;
    },
    async link(input) {
      await prisma.authIdentity.upsert({
        where: { provider_providerUserId: { provider: input.provider, providerUserId: input.providerUserId } },
        create: { ...input, lastLoginAt: new Date() },
        update: { lastLoginAt: new Date(), email: input.email, avatarUrl: input.avatarUrl },
      });
    },
    async unlink(userId, provider) {
      await prisma.authIdentity.deleteMany({ where: { userId, provider } });
    },
    async listForUser(userId) {
      const rows = await prisma.authIdentity.findMany({ where: { userId } });
      return rows.map((r) => r.provider);
    },
  };
}

export function createSkinRepository(prisma: PrismaClient): SkinRepository {
  return {
    async listForUser(userId) {
      const rows = await prisma.userSkin.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        skinId: r.skinId,
        name: r.name,
        data: r.data,
        isDefault: r.isDefault,
        updatedAt: r.updatedAt,
      }));
    },
    async save({ userId, skinId, name, data, isDefault }) {
      const row = await prisma.userSkin.upsert({
        where: { userId_skinId: { userId, skinId } },
        create: { userId, skinId, name, data: data as object, isDefault: !!isDefault },
        update: { name, data: data as object, isDefault: !!isDefault },
      });
      return {
        id: row.id,
        userId: row.userId,
        skinId: row.skinId,
        name: row.name,
        data: row.data,
        isDefault: row.isDefault,
        updatedAt: row.updatedAt,
      };
    },
    async remove(userId, skinId) {
      await prisma.userSkin.deleteMany({ where: { userId, skinId } });
    },
  };
}

export function createReferralRepository(prisma: PrismaClient): ReferralRepository {
  return {
    async create(input) {
      await prisma.referral.create({ data: input });
    },
    async listForUser(userId) {
      const rows = await prisma.referral.findMany({ where: { referrerId: userId }, orderBy: { sentAt: 'desc' } });
      return rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        sentAt: r.sentAt,
        acceptedAt: r.acceptedAt ?? undefined,
        inviteeEmail: r.inviteeEmail ?? undefined,
      }));
    },
    async markAccepted(code, userId, at) {
      await prisma.referral.updateMany({
        where: { code, acceptedById: null },
        data: { acceptedById: userId, acceptedAt: at },
      });
    },
  };
}

/** TOTP enrolment and recovery codes. The seed is stored already encrypted. */
export function createTwoFactorRepository(prisma: PrismaClient): TwoFactorRepository {
  const where = (userId: string) => ({ userId_type: { userId, type: 'TOTP' as const } });

  return {
    async find(userId) {
      const row = await prisma.twoFactor.findUnique({ where: where(userId) });
      if (!row) return undefined;
      return {
        id: row.id,
        secretEnc: row.secretEnc ?? undefined,
        confirmedAt: row.confirmedAt ?? undefined,
        lastUsedStep: row.lastUsedStep ?? undefined,
      };
    },
    async start({ userId, secretEnc }) {
      await prisma.twoFactor.upsert({
        where: where(userId),
        create: { userId, type: 'TOTP', secretEnc },
        // Restarting the enrolment throws away the old seed and its confirmation.
        update: { secretEnc, confirmedAt: null, lastUsedStep: null },
      });
    },
    async confirm(userId, at, step) {
      await prisma.twoFactor.update({ where: where(userId), data: { confirmedAt: at, lastUsedStep: step } });
    },
    async markStep(userId, step) {
      await prisma.twoFactor.update({ where: where(userId), data: { lastUsedStep: step } });
    },
    async remove(userId) {
      await prisma.$transaction([
        prisma.twoFactor.deleteMany({ where: { userId, type: 'TOTP' } }),
        prisma.recoveryCode.deleteMany({ where: { userId } }),
      ]);
    },
    async replaceRecoveryCodes(userId, hashes) {
      await prisma.$transaction([
        prisma.recoveryCode.deleteMany({ where: { userId } }),
        prisma.recoveryCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) }),
      ]);
    },
    async consumeRecoveryCode(userId, hash, at) {
      const row = await prisma.recoveryCode.findFirst({ where: { userId, codeHash: hash, usedAt: null } });
      if (!row) return false;
      // updateMany with the same guard: two parallel requests cannot both win.
      const { count } = await prisma.recoveryCode.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: at },
      });
      return count === 1;
    },
    async countRecoveryCodes(userId) {
      return prisma.recoveryCode.count({ where: { userId, usedAt: null } });
    },
  };
}
