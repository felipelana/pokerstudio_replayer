import type { FastifyInstance, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import type { AppError } from '../../shared/result.js';
import { normaliseRoute, recordError, type RecordErrorDeps } from '../../application/observability/RecordError.js';

/** RFC 7807 problem document. */
export function problem(reply: FastifyReply, error: AppError) {
  return reply
    .status(error.status)
    .type('application/problem+json')
    .send({
      type: `https://pokerstudio.com.br/errors/${error.code}`,
      title: error.message,
      status: error.status,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
}

/** Single place where unexpected failures become responses — never a stack trace. */
export function registerErrorHandler(app: FastifyInstance, isProduction: boolean, observe?: RecordErrorDeps) {
  app.setErrorHandler((err, request, reply) => {
    if (err instanceof ZodError) {
      return problem(reply, {
        code: 'validation_failed',
        message: 'Some fields are invalid.',
        status: 422,
        details: { issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) {
      return problem(reply, { code: 'rate_limited', message: 'Too many requests. Slow down.', status: 429 });
    }
    // A framework error that already knows its status keeps it: a malformed
    // request must not be reported as a server fault.
    if (status && status >= 400 && status < 500) {
      return problem(reply, {
        code: (err as { code?: string }).code ?? 'bad_request',
        message: String((err as Error)?.message ?? 'Bad request'),
        status,
      });
    }
    request.log.error({ err }, 'unhandled error');

    // The same failure, kept where an administrator will look for it. It is
    // deliberately not awaited: the person waiting for this response should not
    // wait for a write to the database as well.
    if (observe) {
      void recordError(observe, {
        source: 'SERVER',
        level: 'ERROR',
        message: String((err as Error)?.message ?? err),
        stack: (err as Error)?.stack,
        route: normaliseRoute(request.method, request.url),
        statusCode: 500,
        requestId: request.id,
        userId: request.currentUser?.id,
        // `trustProxy` is on, so this is already the address behind Caddy.
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        context: { code: (err as { code?: string }).code, name: (err as Error)?.name },
      });
    }

    return problem(reply, {
      code: 'internal_error',
      message: isProduction ? 'Something went wrong.' : String((err as Error)?.message ?? err),
      status: 500,
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    problem(reply, { code: 'not_found', message: 'Resource not found.', status: 404 }),
  );
}
