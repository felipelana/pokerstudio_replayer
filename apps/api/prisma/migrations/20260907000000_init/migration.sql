-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('PASSWORD', 'GOOGLE');

-- CreateEnum
CREATE TYPE "EmailTokenType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'CHANGE_EMAIL');

-- CreateEnum
CREATE TYPE "AccessEvent" AS ENUM ('LOGIN_OK', 'LOGIN_FAIL', 'LOGOUT', 'SIGNUP', 'VERIFY', 'RESET_REQUEST', 'RESET_OK', 'BLOCKED_ATTEMPT', 'ADMIN_BLOCK', 'ADMIN_UNBLOCK', 'SESSION_REVOKE', 'ADMIN_LOGIN_OK', 'ADMIN_LOGIN_FAIL', 'TOTP_ENROLLED', 'TOTP_FAIL', 'RECOVERY_CODE_USED', 'EMAIL_SETTINGS_CHANGED', 'GOOGLE_LINKED', 'GOOGLE_UNLINKED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReferralChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'LINK');

-- CreateEnum
CREATE TYPE "TwoFactorType" AS ENUM ('TOTP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HandOutcome" AS ENUM ('WON', 'LOST', 'FOLDED');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('APP_OPEN', 'HAND_IMPORT', 'REVIEW_START', 'REVIEW_SAVE', 'REVIEW_RESUME', 'REVIEW_COMPLETE', 'REPORT_EXPORT', 'SKIN_APPLIED', 'SKIN_SAVED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phoneE164" TEXT,
    "phoneCountry" CHAR(2),
    "countryCode" CHAR(2) NOT NULL,
    "language" VARCHAR(8) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedById" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
    "planSince" TIMESTAMP(3),
    "referralCode" VARCHAR(8) NOT NULL,
    "referredById" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" INET,
    "userAgent" TEXT,
    "twoFactorAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EmailTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT,
    "email" CITEXT,
    "event" "AccessEvent" NOT NULL,
    "ip" INET,
    "country" CHAR(2),
    "userAgent" TEXT,
    "deviceType" "DeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "os" TEXT,
    "browser" TEXT,
    "browserVersion" TEXT,
    "origin" TEXT,
    "appSurface" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "channel" "ReferralChannel" NOT NULL,
    "inviteeEmail" CITEXT,
    "inviteePhone" TEXT,
    "code" VARCHAR(8) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TwoFactorType" NOT NULL,
    "secretEnc" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "lastUsedStep" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "roomDetected" TEXT,
    "handCount" INTEGER NOT NULL DEFAULT 0,
    "currentHandIndex" INTEGER NOT NULL DEFAULT 0,
    "currentActionIndex" INTEGER,
    "status" "ReviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "storeHandHistory" BOOLEAN NOT NULL DEFAULT false,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandRecord" (
    "id" TEXT NOT NULL,
    "reviewSessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "handId" TEXT,
    "rawHistory" TEXT,
    "heroPosition" TEXT,
    "result" "HandOutcome",
    "potWon" DECIMAL(18,2),
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "HandRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewNote" (
    "id" TEXT NOT NULL,
    "handRecordId" TEXT NOT NULL,
    "tags" TEXT[],
    "body" TEXT NOT NULL,
    "includeInReport" BOOLEAN NOT NULL DEFAULT false,
    "capture" TEXT NOT NULL DEFAULT 'NONE',
    "imageRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skinId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT,
    "anonId" TEXT,
    "type" "UsageEventType" NOT NULL,
    "skinId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDaily" (
    "day" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MetricDaily_pkey" PRIMARY KEY ("day","metric")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "to" CITEXT NOT NULL,
    "template" TEXT NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'NONE',
    "fromAddress" TEXT,
    "fromName" TEXT,
    "replyTo" TEXT,
    "secretEnc" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "requireVerification" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX "User_countryCode_idx" ON "User"("countryCode");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerUserId_key" ON "AuthIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailToken_userId_type_idx" ON "EmailToken"("userId", "type");

-- CreateIndex
CREATE INDEX "AccessLog_userId_createdAt_idx" ON "AccessLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_event_createdAt_idx" ON "AccessLog"("event", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_code_idx" ON "Referral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactor_userId_type_key" ON "TwoFactor"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_tokenHash_key" ON "TrustedDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");

-- CreateIndex
CREATE INDEX "ReviewSession_userId_lastOpenedAt_idx" ON "ReviewSession"("userId", "lastOpenedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HandRecord_reviewSessionId_index_key" ON "HandRecord"("reviewSessionId", "index");

-- CreateIndex
CREATE INDEX "ReviewNote_handRecordId_idx" ON "ReviewNote"("handRecordId");

-- CreateIndex
CREATE INDEX "UserSkin_userId_updatedAt_idx" ON "UserSkin"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkin_userId_skinId_key" ON "UserSkin"("userId", "skinId");

-- CreateIndex
CREATE INDEX "UsageEvent_type_createdAt_idx" ON "UsageEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_createdAt_idx" ON "EmailOutbox"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandRecord" ADD CONSTRAINT "HandRecord_reviewSessionId_fkey" FOREIGN KEY ("reviewSessionId") REFERENCES "ReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_handRecordId_fkey" FOREIGN KEY ("handRecordId") REFERENCES "HandRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkin" ADD CONSTRAINT "UserSkin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

