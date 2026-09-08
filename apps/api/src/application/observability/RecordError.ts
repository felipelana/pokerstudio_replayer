import type { ErrorLevel, ErrorLogInput, ErrorLogRepository, ErrorSource } from '../../domain/repositories/index.js';

/**
 * Storing a failure so that it can be read later without becoming a leak.
 *
 * Two rules govern everything here. Nothing secret is ever written: keys that
 * look like a credential are replaced by a marker before the row exists, and
 * the redaction happens on the way in, not on the way out, so a value that was
 * never stored cannot be exposed by a later bug in the admin screen. And
 * nothing unbounded is ever written: a message, a stack and a context all have
 * a ceiling, because an error loop must not be able to fill the disk.
 */

/** Keys whose value is never worth keeping, whatever it happens to hold. */
const SECRET_KEY = /(pass|secret|token|cookie|authorization|auth|session|otp|totp|apikey|api_key|credential|private)/i;

const MAX_MESSAGE = 500;
const MAX_STACK = 8_000;
const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_KEYS = 40;

export const REDACTED = '[redacted]';

/** Trims a value to something a log can hold, dropping anything secret. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      out[key] = SECRET_KEY.test(key) ? REDACTED : redact(inner, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function redactContext(context: unknown): Record<string, unknown> | undefined {
  if (!context || typeof context !== 'object') return undefined;
  const out = redact(context) as Record<string, unknown>;
  return Object.keys(out).length ? out : undefined;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_NUMBER = /\b\d{4,}\b/g;
const TOKENISH = /\b[A-Za-z0-9_-]{24,}\b/g;

/**
 * `GET /api/v1/reviews/9f0c…/hands/12` becomes `GET /api/v1/reviews/:id/hands/:id`,
 * so a hundred failures on a hundred sessions read as one fault, not a hundred.
 */
export function normaliseRoute(method: string, url: string): string {
  const path = url.split('?')[0] ?? url;
  const cleaned = path.replace(UUID, ':id').replace(TOKENISH, ':id').replace(LONG_NUMBER, ':id');
  return `${method.toUpperCase()} ${cleaned}`.slice(0, 200);
}

export interface RecordErrorDeps {
  errors: ErrorLogRepository;
  env: string;
  release?: string;
  /** Somewhere to complain when even the recording fails. */
  onFailure?: (err: unknown) => void;
}

export interface RecordErrorInput {
  source: ErrorSource;
  level?: ErrorLevel;
  message: string;
  stack?: string;
  route?: string;
  statusCode?: number;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  context?: unknown;
}

/**
 * Never throws and never rejects. A failure to write the log of a failure must
 * not become a second failure on the request that is already going badly.
 */
export async function recordError(deps: RecordErrorDeps, input: RecordErrorInput): Promise<void> {
  const row: ErrorLogInput = {
    source: input.source,
    level: input.level ?? 'ERROR',
    env: deps.env,
    release: deps.release,
    message: (input.message || 'Unknown error').slice(0, MAX_MESSAGE),
    stack: input.stack?.slice(0, MAX_STACK),
    route: input.route?.slice(0, 200),
    statusCode: input.statusCode,
    requestId: input.requestId?.slice(0, 60),
    userId: input.userId,
    ip: input.ip,
    userAgent: input.userAgent?.slice(0, 300),
    context: redactContext(input.context),
  };
  try {
    await deps.errors.record(row);
  } catch (err) {
    deps.onFailure?.(err);
  }
}
