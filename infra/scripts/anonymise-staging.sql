-- Turns a copy of production into something safe to sign into.
--
-- Two jobs. The first is to make the people unrecognisable: names, addresses,
-- phone numbers and poker nicknames become derived placeholders, stable per row
-- so the data still hangs together — the same account is the same account
-- across every table — but tied to nobody. The second is to make the copy
-- powerless: every credential, session, token and device is destroyed, so a
-- copy that leaks cannot be used to reach the real product or the real mailbox
-- of a real player.
--
-- It is applied by clone-prod-to-staging.sh, inside one transaction, and it
-- must never be pointed at production.

BEGIN;

-- Refuse to run anywhere that is not a staging copy. The clone script writes
-- this table before calling us; production has no such row.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_staging_marker') THEN
    RAISE EXCEPTION 'no _staging_marker table: refusing to anonymise a database that is not a staging copy';
  END IF;
END $$;

-- ---------------------------------------------------------------- people --

UPDATE "User" SET
  email     = 'user-' || left(md5(id), 10) || '@staging.invalid',
  name      = 'Player ' || left(md5(id), 6),
  phoneE164 = NULL,
  passwordHash = NULL;   -- nobody signs in with a production password here

UPDATE "AuthIdentity" SET
  email          = 'user-' || left(md5("userId"), 10) || '@staging.invalid',
  providerUserId = 'staging-' || left(md5(id), 16),
  avatarUrl      = NULL;

UPDATE "RoomNick" SET nickname = 'nick' || left(md5(id), 8);

UPDATE "Feedback" SET
  body      = '[redacted in staging]',
  adminNote = NULL;

-- ------------------------------------------------------------ credentials --

DELETE FROM "Session";
DELETE FROM "EmailToken";
DELETE FROM "TrustedDevice";
DELETE FROM "RecoveryCode";
DELETE FROM "TwoFactor";
DELETE FROM "LoginAttempt";
DELETE FROM "CoachInvite";

-- --------------------------------------------------------------- e-mail --

-- A staging copy that can send is a staging copy that will send, to real
-- addresses, from a queue built in production.
DELETE FROM "EmailOutbox";
UPDATE "EmailSettings" SET
  provider  = 'NONE',
  "secretEnc" = NULL,
  "smtpHost" = NULL,
  "smtpUser" = NULL,
  "lastError" = NULL;

-- ----------------------------------------------------------------- trails --

UPDATE "AccessLog" SET ip = NULL, "userAgent" = NULL, email = NULL, detail = NULL;
UPDATE "ErrorLog"  SET ip = NULL, "userAgent" = NULL;

COMMIT;
