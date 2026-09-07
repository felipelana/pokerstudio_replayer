import type { PrismaClient } from '@prisma/client';
import type { EmailSender } from '../../application/ports/index.js';

export interface EmailConfig {
  provider: 'NONE' | 'RESEND' | 'SMTP';
  from: string;
  fromName: string;
  replyTo?: string;
  apiKey?: string;
  appUrl: string;
}

/**
 * Queue-first sender (5B.5): while no provider is configured, messages land in
 * `EmailOutbox` with status PENDING and the signup flow keeps working. When a
 * provider is set up the same rows are dispatched.
 *
 * In development the verification link is also logged, so the flow can be
 * completed without any e-mail service.
 */
export function createEmailSender(
  prisma: PrismaClient,
  config: EmailConfig,
  log: (msg: string) => void,
): EmailSender {
  return {
    async send({ to, template, locale, payload }) {
      const link = payload.token
        ? `${config.appUrl}/${template === 'reset-password' ? 'reset-password' : 'verify-email'}?token=${String(payload.token)}`
        : undefined;

      if (config.provider === 'NONE' || !config.apiKey) {
        await prisma.emailOutbox.create({
          data: { to, template, locale, payload: { ...payload, link } as object, status: 'PENDING' },
        });
        if (link) log(`[email:${template}] ${to} -> ${link}`);
        return 'queued';
      }

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            from: `${config.fromName} <${config.from}>`,
            reply_to: config.replyTo,
            to,
            subject: subjectFor(template, locale),
            text: bodyFor(template, locale, { ...payload, link }),
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`provider responded ${res.status}`);
        await prisma.emailOutbox.create({
          data: { to, template, locale, payload: { ...payload, link } as object, status: 'SENT', sentAt: new Date() },
        });
        return 'sent';
      } catch (err) {
        await prisma.emailOutbox.create({
          data: {
            to,
            template,
            locale,
            payload: { ...payload, link } as object,
            status: 'FAILED',
            lastError: err instanceof Error ? err.message : 'unknown error',
          },
        });
        return 'queued';
      }
    },
  };
}

/** Minimal localisation; the full React Email templates use the same keys. */
const SUBJECTS: Record<string, Record<string, string>> = {
  'verify-email': {
    'pt-BR': 'Confirme seu e-mail — PokerStudio Replayer',
    en: 'Confirm your e-mail — PokerStudio Replayer',
  },
  'reset-password': {
    'pt-BR': 'Redefinir sua senha — PokerStudio Replayer',
    en: 'Reset your password — PokerStudio Replayer',
  },
  welcome: { 'pt-BR': 'Bem-vindo ao PokerStudio Replayer', en: 'Welcome to PokerStudio Replayer' },
  'referral-invite': { 'pt-BR': 'Um convite para o PokerStudio Replayer', en: 'An invite to PokerStudio Replayer' },
  'account-blocked': { 'pt-BR': 'Sua conta foi bloqueada', en: 'Your account was blocked' },
};

function subjectFor(template: string, locale: string): string {
  const row = SUBJECTS[template] ?? {};
  return row[locale] ?? row.en ?? 'PokerStudio Replayer';
}

function bodyFor(template: string, locale: string, payload: Record<string, unknown>): string {
  const pt = locale.startsWith('pt');
  const name = String(payload.name ?? '');
  const link = String(payload.link ?? '');
  if (template === 'verify-email') {
    return pt
      ? `Olá ${name},\n\nConfirme seu e-mail para ativar sua conta:\n${link}\n\nO link vale por 24 horas.`
      : `Hi ${name},\n\nConfirm your e-mail to activate your account:\n${link}\n\nThe link is valid for 24 hours.`;
  }
  if (template === 'reset-password') {
    return pt
      ? `Olá ${name},\n\nPara definir uma nova senha:\n${link}\n\nO link vale por 1 hora. Se não foi você, ignore esta mensagem.`
      : `Hi ${name},\n\nTo set a new password:\n${link}\n\nThe link is valid for 1 hour. If this wasn't you, ignore this message.`;
  }
  return link || name;
}
