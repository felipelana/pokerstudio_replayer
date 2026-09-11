import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

/**
 * The API, unchanged, answering from inside Next.
 *
 * Fastify does not need a socket to answer a request: `inject` is the same
 * mechanism the 148 tests already use. So the seventy-two routes, the auth,
 * the rate limiting and the three OAuth flows stay exactly where they are, in
 * `src/server`, and this file is only the doorway between a web Request and them.
 *
 * The instance is built once and kept on globalThis, because in development
 * Next reloads this module on every change and a second Prisma pool per reload
 * would exhaust the database in minutes.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROJECT_ROOT = process.cwd();

/** The .env at the project root, read once, so there is one file and not two. */
function loadApiEnv() {
  if (process.env.DATABASE_URL) return;
  for (const name of ['.env', '.env.local']) {
    try {
      const text = readFileSync(path.join(PROJECT_ROOT, name), 'utf8');
      for (const line of text.split('\n')) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (!match) continue;
        const value = match[2].replace(/^["']|["']$/g, '');
        if (process.env[match[1]] === undefined) process.env[match[1]] = value;
      }
    } catch {
      // A missing file is normal: in production the values come from the
      // environment itself.
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __pokerstudioApi: Promise<FastifyInstance> | undefined;
}

async function api(): Promise<FastifyInstance> {
  if (!globalThis.__pokerstudioApi) {
    globalThis.__pokerstudioApi = (async () => {
      loadApiEnv();
      const { loadConfig } = await import('@/server/shared/config.js');
      const { createContainer } = await import('@/server/main-container.js');
      const { buildServer } = await import('@/server/interface/http/server.js');
      const container = await createContainer(loadConfig());
      const app = await buildServer(container);
      await app.ready();
      return app;
    })();
  }
  return globalThis.__pokerstudioApi;
}

/** The address the request came from, which is what the rate limiter counts. */
function callerAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

async function handle(request: Request): Promise<Response> {
  const app = await api();
  const url = new URL(request.url);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  const answer = await app.inject({
    method: request.method as 'GET',
    url: url.pathname + url.search,
    headers,
    payload: body && body.length > 0 ? body : undefined,
    remoteAddress: callerAddress(request),
  });

  // A response may set more than one cookie, and a plain object would keep
  // only the last of them.
  const out = new Headers();
  for (const [key, value] of Object.entries(answer.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const one of value) out.append(key, String(one));
    else out.set(key, String(value));
  }
  // The body is already complete; the length Fastify wrote can only disagree.
  out.delete('content-length');
  out.delete('transfer-encoding');

  // rawPayload is a Node Buffer; a Response wants the bytes underneath it.
  const bytes = new Uint8Array(answer.rawPayload);
  return new Response(bytes, { status: answer.statusCode, headers: out });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
