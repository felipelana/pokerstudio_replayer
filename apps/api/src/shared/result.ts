/**
 * Explicit result type. Use cases never throw framework errors: they return a
 * failure that the HTTP layer maps to RFC 7807.
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E>(error: E): Result<never, E> => ({ ok: false, error });

export interface AppError {
  /** Stable machine-readable code, also used as the RFC 7807 `type` suffix. */
  code: string;
  message: string;
  /** HTTP status the interface layer should use. */
  status: number;
  details?: Record<string, unknown>;
}

export const appError = (code: string, message: string, status = 400, details?: Record<string, unknown>): AppError => ({
  code,
  message,
  status,
  details,
});
