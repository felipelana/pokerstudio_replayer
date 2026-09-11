-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "ErrorSource" AS ENUM ('SERVER', 'CLIENT');

-- CreateEnum
CREATE TYPE "ErrorLevel" AS ENUM ('WARN', 'ERROR', 'FATAL');

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" BIGSERIAL NOT NULL,
    "source" "ErrorSource" NOT NULL DEFAULT 'SERVER',
    "level" "ErrorLevel" NOT NULL DEFAULT 'ERROR',
    "env" VARCHAR(20) NOT NULL,
    "release" VARCHAR(80),
    "message" VARCHAR(500) NOT NULL,
    "stack" TEXT,
    "route" VARCHAR(200),
    "statusCode" INTEGER,
    "requestId" VARCHAR(60),
    "userId" TEXT,
    "ip" INET,
    "userAgent" VARCHAR(300),
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_level_createdAt_idx" ON "ErrorLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_env_createdAt_idx" ON "ErrorLog"("env", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_source_createdAt_idx" ON "ErrorLog"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

