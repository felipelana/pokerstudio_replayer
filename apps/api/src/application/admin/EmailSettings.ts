import { appError, fail, ok, type Result } from '../../shared/result.js';
import type { PrismaClient } from '@prisma/client';
import type { AccessLogRepository } from '../../domain/repositories/index.js';
import type { Clock } from '../ports/index.js';

export interface EmailSettingsDeps {
  prisma: PrismaClient;
  log: AccessLogRepository;
  clock: Clock;
  cipher: { encrypt(plain: string): string; decrypt(payload: string): string | undefined };
}

export interface EmailSettingsInput {
  provider: 'NONE' | 'RESEND' | 'SMTP';
  fromAddress?: string;
  fromName?: string;
  replyTo?: string;
  /** Only sent when the admin is changing it; absent keeps the stored one. */
  secret?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecure?: boolean;
  requireVerification: boolean;
}

/** Never returns the secret — only whether one is stored. */
export async function readEmailSettings(deps: EmailSettingsDeps) {
  const row = await deps.prisma.emailSettings.findUnique({ where: { id: 1 } });
  return ok({
    provider: (row?.provider ?? 'NONE') as 'NONE' | 'RESEND' | 'SMTP',
    fromAddress: row?.fromAddress ?? undefined,
    fromName: row?.fromName ?? undefined,
    replyTo: row?.replyTo ?? undefined,
    smtpHost: row?.smtpHost ?? undefined,
    smtpPort: row?.smtpPort ?? undefined,
    smtpUser: row?.smtpUser ?? undefined,
    smtpSecure: row?.smtpSecure ?? true,
    requireVerification: row?.requireVerification ?? false,
    hasSecret: !!row?.secretEnc,
    lastError: row?.lastError ?? undefined,
    lastTestAt: row?.lastTestAt ?? undefined,
    pending: await deps.prisma.emailOutbox.count({ where: { status: 'PENDING' } }),
  });
}

export async function saveEmailSettings(
  deps: EmailSettingsDeps,
  input: { adminId: string; settings: EmailSettingsInput },
): Promise<Result<{ ok: true }>> {
  const { settings } = input;

  // Turning a provider on without a sender address would only queue failures.
  if (settings.provider !== 'NONE' && !settings.fromAddress) {
    return fail(appError('from_address_required', 'Set the sender address before enabling a provider.', 422));
  }
  if (settings.provider === 'SMTP' && !settings.smtpHost) {
    return fail(appError('smtp_host_required', 'SMTP needs a host.', 422));
  }

  const data = {
    provider: settings.provider,
    fromAddress: settings.fromAddress,
    fromName: settings.fromName,
    replyTo: settings.replyTo,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpSecure: settings.smtpSecure ?? true,
    requireVerification: settings.requireVerification,
    // An empty secret means "keep the stored one"; only a new value replaces it.
    ...(settings.secret ? { secretEnc: deps.cipher.encrypt(settings.secret) } : {}),
    lastError: null,
  };

  await deps.prisma.emailSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  await deps.log.record({
    userId: input.adminId,
    event: 'EMAIL_SETTINGS_CHANGED',
    detail: { provider: settings.provider, requireVerification: settings.requireVerification },
  });
  return ok({ ok: true });
}

/**
 * Sends one real message through the configured provider and records what came
 * back, so a broken key is found here and not in a user's sign-up.
 */
export async function sendTestEmail(
  deps: EmailSettingsDeps,
  input: { to: string },
): Promise<Result<{ delivered: boolean; detail?: string }>> {
  const row = await deps.prisma.emailSettings.findUnique({ where: { id: 1 } });
  const secret = row?.secretEnc ? deps.cipher.decrypt(row.secretEnc) : undefined;

  if (!row || row.provider === 'NONE') {
    return fail(appError('provider_not_configured', 'No e-mail provider is configured.', 409));
  }
  if (row.provider === 'RESEND' && !secret) {
    return fail(appError('provider_not_configured', 'The provider key is missing.', 409));
  }
  if (row.provider === 'SMTP') {
    // Nothing ships an SMTP client yet; saying so beats pretending it worked.
    return fail(appError('smtp_not_supported', 'SMTP delivery is not implemented yet — use Resend.', 501));
  }

  const now = deps.clock.now();
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: `${row.fromName ?? 'PokerStudio Replayer'} <${row.fromAddress}>`,
        to: input.to,
        subject: 'PokerStudio Replayer — test message',
        text: 'If you are reading this, the e-mail settings are working.',
      }),
      signal: AbortSignal.timeout(8000),
    });

    const detail = res.ok ? undefined : `${res.status} ${(await res.text()).slice(0, 300)}`;
    await deps.prisma.emailSettings.update({
      where: { id: 1 },
      data: { lastTestAt: now, lastError: detail ?? null },
    });
    return ok({ delivered: res.ok, detail });
  } catch (err) {
    const detail = String((err as Error)?.message ?? err).slice(0, 300);
    await deps.prisma.emailSettings.update({ where: { id: 1 }, data: { lastTestAt: now, lastError: detail } });
    return ok({ delivered: false, detail });
  }
}
