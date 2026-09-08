import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  assessmentDetail,
  coachAssessment,
  completeAssessment,
  saveAssessmentProgress,
  saveHandAssessment,
  selfAssessment,
  sessionAssessments,
} from '../../../application/assessments/Assessments.js';
import {
  createInvite,
  inviteState,
  listInvites,
  openInvite,
  revokeInvite,
  shareSettings,
} from '../../../application/assessments/CoachInvites.js';
import { Errors } from '../../../domain/errors/index.js';
import { problem } from '../errors.js';
import { requireUser } from '../context.js';
import type { AppContainer } from '../../../main-container.js';

/** The coach's own cookie. It is not a session: it grants one review, nothing else. */
export const COACH_COOKIE = 'ps_coach';

const handPatch = z.object({
  score: z.number().int().min(0).max(100).nullable().optional(),
  markedOk: z.boolean().optional(),
  comment: z.string().max(4000).nullable().optional(),
  streetComments: z.record(z.string().max(2000)).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

const position = z.object({
  handIndex: z.number().int().min(0).optional(),
  frameIndex: z.number().int().min(0).optional(),
});

export async function assessmentRoutes(app: FastifyInstance, container: AppContainer) {
  const deps = { prisma: container.prisma, clock: container.clock };
  const inviteDeps = { ...deps, hasher: container.hasher };
  const cookieOpts = { domain: container.config.COOKIE_DOMAIN, secure: container.config.isProduction };

  /* ---------------------------------------------------------------- */
  /* The player's side                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * The player may write only their own reading, and read every reading of a
   * review they own. A coach never reaches these routes at all — they have no
   * user session — but the check is on the row, not on the route.
   */
  async function ownAssessment(request: FastifyRequest, reply: FastifyReply, id: string, forWriting: boolean) {
    const user = requireUser(request, reply);
    if (!user) return undefined;
    const assessment = await container.prisma.assessment.findUnique({
      where: { id },
      select: { id: true, role: true, userId: true, session: { select: { userId: true } } },
    });
    if (!assessment || assessment.session.userId !== user.id) {
      void problem(reply, Errors.notFound('Assessment'));
      return undefined;
    }
    // Reading a coach's work is allowed; changing a word of it is not.
    if (forWriting && (assessment.role !== 'SELF' || assessment.userId !== user.id)) {
      void problem(reply, Errors.forbidden());
      return undefined;
    }
    return assessment;
  }

  /** The player's own reading of one review, created the first time they ask. */
  app.get('/reviews/:id/assessment', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(8).max(64) }).parse(request.params);
    const assessment = await selfAssessment(deps, user.id, id);
    if (!assessment) return problem(reply, Errors.notFound('Review'));
    return reply.send(await assessmentDetail(deps, assessment.id));
  });

  /** Every reading of one review: the player's own, and each coach's. */
  app.get('/reviews/:id/assessments', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(8).max(64) }).parse(request.params);
    const all = await sessionAssessments(deps, user.id, id);
    if (!all) return problem(reply, Errors.notFound('Review'));
    return reply.send(all);
  });

  app.get('/assessments/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!(await ownAssessment(request, reply, id, false))) return;
    return reply.send(await assessmentDetail(deps, id));
  });

  app.patch('/assessments/:id/hands/:index', async (request, reply) => {
    const { id, index } = z
      .object({ id: z.string().uuid(), index: z.coerce.number().int().min(0) })
      .parse(request.params);
    if (!(await ownAssessment(request, reply, id, true))) return;
    const result = await saveHandAssessment(deps, id, index, handPatch.parse(request.body));
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.patch('/assessments/:id/progress', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!(await ownAssessment(request, reply, id, true))) return;
    const result = await saveAssessmentProgress(deps, id, position.parse(request.body));
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.post('/assessments/:id/complete', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!(await ownAssessment(request, reply, id, true))) return;
    const result = await completeAssessment(deps, id);
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  /* ---------------------------------------------------------------- */
  /* Inviting a coach                                                  */
  /* ---------------------------------------------------------------- */

  /** What the share dialog needs before it can offer a deadline. */
  app.get('/share-settings', async (request, reply) => {
    if (!requireUser(request, reply)) return;
    return reply.send(await shareSettings(container.prisma));
  });

  app.get('/reviews/:id/invites', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(8).max(64) }).parse(request.params);
    const invites = await listInvites(inviteDeps, user.id, id);
    if (!invites) return problem(reply, Errors.notFound('Review'));
    return reply.send({ items: invites });
  });

  /**
   * The link and the password come back once, here. The password is already a
   * hash in the database by the time this responds, and it never appears in the
   * URL or in a log line.
   */
  app.post('/reviews/:id/invites', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(8).max(64) }).parse(request.params);
    const body = z
      .object({
        coachName: z.string().trim().min(1).max(80),
        password: z.string().min(8).max(8),
        expiresAt: z.string().datetime().optional(),
      })
      .parse(request.body);
    const result = await createInvite(inviteDeps, user.id, {
      reviewSessionId: id,
      coachName: body.coachName,
      password: body.password,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
    if (!result.ok) return problem(reply, result.error);
    return reply.code(201).send(result.value);
  });

  app.post('/invites/:id/revoke', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await revokeInvite(inviteDeps, user.id, id);
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  /* ---------------------------------------------------------------- */
  /* The coach's side — one review, and nothing else in the product    */
  /* ---------------------------------------------------------------- */

  /**
   * Resolves the coach cookie into the invitation it names, checking the
   * deadline and any revocation **on this request**. That is what makes a
   * browser left open past the hour behave like any other: the answer comes
   * from the database now, not from what was true at sign-in.
   */
  async function requireCoach(request: FastifyRequest, reply: FastifyReply) {
    const signed = request.cookies?.[COACH_COOKIE];
    const unsigned = signed ? request.unsignCookie(signed) : undefined;
    if (!unsigned?.valid || !unsigned.value) {
      void problem(reply, Errors.notAuthenticated());
      return undefined;
    }
    const state = await inviteState(inviteDeps, unsigned.value);
    if (state.state === 'expired') {
      void problem(reply, Errors.shareExpired());
      return undefined;
    }
    if (state.state === 'revoked') {
      void problem(reply, Errors.shareRevoked());
      return undefined;
    }
    if (state.state !== 'ok' || !state.invite) {
      void problem(reply, Errors.notAuthenticated());
      return undefined;
    }
    return state.invite;
  }

  /** The way in: the token from the link and the password, both checked here. */
  app.post('/coach/open', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const body = z.object({ token: z.string().min(10).max(64), password: z.string().min(1).max(64) }).parse(request.body);
    const result = await openInvite(inviteDeps, body.token, body.password);
    if (!result.ok) return problem(reply, result.error);

    // The cookie carries the invitation, never the password, and dies with the
    // link — the server checks the deadline again on every request regardless.
    reply.setCookie(COACH_COOKIE, result.value.inviteId, {
      ...cookieOpts,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      signed: true,
      expires: result.value.expiresAt,
    });
    return reply.send({ coachName: result.value.coachName, expiresAt: result.value.expiresAt });
  });

  app.post('/coach/close', async (_request, reply) => {
    reply.clearCookie(COACH_COOKIE, { ...cookieOpts, path: '/' });
    return reply.send({ ok: true });
  });

  /**
   * Everything the coach's screen is allowed to know: who they are reviewing,
   * which session, when their access ends — and their own reading. Not the
   * player's self-assessment, not another coach's, not the library.
   */
  app.get('/coach/session', async (request, reply) => {
    const invite = await requireCoach(request, reply);
    if (!invite) return;
    const assessment = await coachAssessment(deps, invite.id);
    if (!assessment) return problem(reply, Errors.notFound('Assessment'));
    const session = await container.prisma.reviewSession.findUnique({
      where: { id: invite.reviewSessionId },
      select: {
        id: true,
        title: true,
        sourceFileName: true,
        roomDetected: true,
        handCount: true,
        user: { select: { name: true } },
      },
    });
    if (!session) return problem(reply, Errors.notFound('Review'));
    return reply.send({
      coachName: invite.coachName,
      expiresAt: invite.expiresAt,
      assessmentId: assessment.id,
      player: session.user.name,
      session: {
        id: session.id,
        title: session.title,
        sourceFileName: session.sourceFileName,
        room: session.roomDetected,
        handCount: session.handCount,
      },
    });
  });

  app.get('/coach/assessment', async (request, reply) => {
    const invite = await requireCoach(request, reply);
    if (!invite) return;
    const assessment = await coachAssessment(deps, invite.id);
    if (!assessment) return problem(reply, Errors.notFound('Assessment'));
    return reply.send(await assessmentDetail(deps, assessment.id));
  });

  app.patch('/coach/assessment/hands/:index', async (request, reply) => {
    const invite = await requireCoach(request, reply);
    if (!invite) return;
    const { index } = z.object({ index: z.coerce.number().int().min(0) }).parse(request.params);
    const assessment = await coachAssessment(deps, invite.id);
    if (!assessment) return problem(reply, Errors.notFound('Assessment'));
    const result = await saveHandAssessment(deps, assessment.id, index, handPatch.parse(request.body));
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.patch('/coach/assessment/progress', async (request, reply) => {
    const invite = await requireCoach(request, reply);
    if (!invite) return;
    const assessment = await coachAssessment(deps, invite.id);
    if (!assessment) return problem(reply, Errors.notFound('Assessment'));
    const result = await saveAssessmentProgress(deps, assessment.id, position.parse(request.body));
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });

  app.post('/coach/assessment/complete', async (request, reply) => {
    const invite = await requireCoach(request, reply);
    if (!invite) return;
    const assessment = await coachAssessment(deps, invite.id);
    if (!assessment) return problem(reply, Errors.notFound('Assessment'));
    const result = await completeAssessment(deps, assessment.id);
    if (!result.ok) return problem(reply, result.error);
    return reply.send(result.value);
  });
}
