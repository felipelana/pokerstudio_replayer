-- CreateEnum
CREATE TYPE "AssessorRole" AS ENUM ('SELF', 'COACH');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "HandRecord" ADD COLUMN     "heroVpip" BOOLEAN;

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "reviewSessionId" TEXT NOT NULL,
    "role" "AssessorRole" NOT NULL,
    "userId" TEXT,
    "coachInviteId" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentHandIndex" INTEGER NOT NULL DEFAULT 0,
    "currentFrameIndex" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandAssessment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "handRecordId" TEXT NOT NULL,
    "score" INTEGER,
    "markedOk" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "streetComments" JSONB,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachInvite" (
    "id" TEXT NOT NULL,
    "reviewSessionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "coachName" VARCHAR(80) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "claimedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricBand" (
    "id" TEXT NOT NULL,
    "minScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RubricBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "defaultHours" INTEGER NOT NULL DEFAULT 24,
    "maxHours" INTEGER NOT NULL DEFAULT 168,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_coachInviteId_key" ON "Assessment"("coachInviteId");

-- CreateIndex
CREATE INDEX "Assessment_reviewSessionId_idx" ON "Assessment"("reviewSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_reviewSessionId_role_userId_key" ON "Assessment"("reviewSessionId", "role", "userId");

-- CreateIndex
CREATE INDEX "HandAssessment_assessmentId_idx" ON "HandAssessment"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "HandAssessment_assessmentId_handRecordId_key" ON "HandAssessment"("assessmentId", "handRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachInvite_token_key" ON "CoachInvite"("token");

-- CreateIndex
CREATE INDEX "CoachInvite_reviewSessionId_idx" ON "CoachInvite"("reviewSessionId");

-- CreateIndex
CREATE INDEX "CoachInvite_expiresAt_idx" ON "CoachInvite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RubricBand_minScore_key" ON "RubricBand"("minScore");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_reviewSessionId_fkey" FOREIGN KEY ("reviewSessionId") REFERENCES "ReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_coachInviteId_fkey" FOREIGN KEY ("coachInviteId") REFERENCES "CoachInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandAssessment" ADD CONSTRAINT "HandAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandAssessment" ADD CONSTRAINT "HandAssessment_handRecordId_fkey" FOREIGN KEY ("handRecordId") REFERENCES "HandRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvite" ADD CONSTRAINT "CoachInvite_reviewSessionId_fkey" FOREIGN KEY ("reviewSessionId") REFERENCES "ReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvite" ADD CONSTRAINT "CoachInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvite" ADD CONSTRAINT "CoachInvite_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
