import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { problem } from '../errors.js';
import { requireUser } from '../context.js';
import type { AppContainer } from '../../../main-container.js';

const INVITE_TEXT: Record<string, string> = {
  'pt-BR': 'Estou usando o PokerStudio Replayer para revisar minhas mãos. Dá uma olhada:',
  en: 'I am using PokerStudio Replayer to review my hands. Take a look:',
  es: 'Estoy usando PokerStudio Replayer para revisar mis manos. Échale un vistazo:',
  de: 'Ich nutze PokerStudio Replayer, um meine Hände zu reviewen. Schau mal:',
  ru: 'Я разбираю свои раздачи в PokerStudio Replayer. Загляни:',
  'zh-CN': '我在用 PokerStudio Replayer 复盘手牌，来看看：',
  ja: 'PokerStudio Replayer でハンドをレビューしています。ぜひ見てみてください：',
  ko: 'PokerStudio Replayer로 핸드를 리뷰하고 있어요. 한번 보세요:',
};

/** Referrals are tracked only — there is no reward (decision B11). */
export async function referralRoutes(app: FastifyInstance, container: AppContainer) {
  app.get('/referrals/me', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const invites = await container.referrals.listForUser(user.id);
    return reply.send({
      code: user.referralCode,
      link: `${container.config.APP_URL}/r/${user.referralCode}`,
      invites,
      accepted: invites.filter((i) => i.acceptedAt).length,
    });
  });

  app.post('/referrals/invite', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const body = z
      .object({
        channel: z.enum(['WHATSAPP', 'EMAIL', 'LINK']),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        locale: z.string().optional(),
      })
      .parse(request.body);

    if (body.channel === 'EMAIL' && !body.email) {
      return problem(reply, { code: 'invalid_invite', message: 'Give the e-mail address to invite.', status: 422 });
    }

    const link = `${container.config.APP_URL}/r/${user.referralCode}`;
    await container.referrals.create({
      referrerId: user.id,
      channel: body.channel,
      code: user.referralCode,
      inviteeEmail: body.email,
      inviteePhone: body.phone,
    });

    if (body.channel === 'EMAIL' && body.email) {
      await container.email.send({
        to: body.email,
        template: 'referral-invite',
        locale: body.locale ?? user.language,
        payload: { name: user.name, link },
      });
      return reply.send({ ok: true, link });
    }

    if (body.channel === 'WHATSAPP') {
      const locale = body.locale ?? user.language;
      const text = `${INVITE_TEXT[locale] ?? INVITE_TEXT.en} ${link}`;
      const phone = (body.phone ?? '').replace(/\D/g, '');
      return reply.send({ ok: true, link, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` });
    }

    return reply.send({ ok: true, link });
  });
}
