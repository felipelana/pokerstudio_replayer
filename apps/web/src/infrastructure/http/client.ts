/**
 * The only place in the web app that talks to the API. Components never call
 * `fetch` directly, so authentication, CSRF and error shaping live in one file.
 */

export interface ApiProblem {
  code: string;
  title: string;
  status: number;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(readonly problem: ApiProblem) {
    super(problem.title);
    this.name = 'ApiError';
  }
}

const BASE = '/api/v1';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    // The session travels in an httpOnly cookie, never in JavaScript.
    credentials: 'include',
    headers: {
      // A cross-site form cannot set this header — it is our CSRF guard.
      'X-Requested-With': 'XMLHttpRequest',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const problem = payload as Partial<ApiProblem> | undefined;
    throw new ApiError({
      code: problem?.code ?? 'unknown_error',
      title: problem?.title ?? `Request failed (${res.status})`,
      status: res.status,
      details: problem?.details,
    });
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** True when the API is not reachable — the app then stays in local-only mode. */
export function isOffline(error: unknown): boolean {
  return !(error instanceof ApiError);
}
