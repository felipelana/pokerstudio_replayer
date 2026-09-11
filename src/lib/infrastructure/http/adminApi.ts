import { api } from './client';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'DELETED';
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PAID';
  countryCode: string;
  createdAt: string;
  emailVerified: boolean;
}

export interface AdminAccessLogRow {
  id: string;
  userId?: string;
  event: string;
  ip?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  origin?: string;
  appSurface?: string;
  createdAt: string;
  detail?: Record<string, unknown>;
}

export interface AdminUserDetail {
  user: AdminUserRow & {
    language: string;
    phoneE164?: string;
    referralCode: string;
    emailVerifiedAt?: string;
  };
  sessions: {
    id: string;
    createdAt: string;
    expiresAt: string;
    revokedAt?: string;
    ip?: string;
    userAgent?: string;
  }[];
  logs: AdminAccessLogRow[];
  identities: string[];
  referrals: { id: string; channel: string; sentAt: string; acceptedAt?: string }[];
}

export interface AdminStats {
  byStatus: { status: string; _count: number }[];
  byPlan: { plan: string; _count: number }[];
  signups: { day: string; value: number }[];
  logins: { day: string; value: number }[];
  devices: { deviceType: string | null; _count: number }[];
  topSkins: { skinId: string | null; _count: number }[];
}

export interface AdminEmailSettings {
  provider: 'NONE' | 'RESEND' | 'SMTP';
  fromAddress?: string;
  fromName?: string;
  replyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecure: boolean;
  requireVerification: boolean;
  /** True when a key is stored; the key itself never comes back. */
  hasSecret: boolean;
  lastError?: string;
  lastTestAt?: string;
  pending: number;
}

export interface AdminEmailRow {
  id: string;
  to: string;
  subject: string;
  status: string;
  createdAt: string;
  sentAt?: string;
  error?: string;
}

export type ErrorLevel = 'WARN' | 'ERROR' | 'FATAL';
export type ErrorSource = 'SERVER' | 'CLIENT';

export interface AdminErrorLogRow {
  id: string;
  source: ErrorSource;
  level: ErrorLevel;
  env: string;
  release?: string;
  message: string;
  /** Only the detail carries it; the list would be unreadable with it. */
  stack?: string;
  route?: string;
  statusCode?: number;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminErrorLogPage {
  total: number;
  items: AdminErrorLogRow[];
  /** Counted over the last 24 hours, whatever the filter says. */
  summary: { level: ErrorLevel; count: number }[];
}

/** Everything under /admstudio. The server checks the role again on each call. */
export const adminApi = {
  users: (query: {
    q?: string;
    status?: string;
    country?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<{ total: number; items: AdminUserRow[] }>(`/admin/users?${toQuery(query)}`),
  user: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`),
  block: (id: string, reason: string) =>
    api.post<{ ok: true }>(`/admin/users/${id}/block`, { reason }),
  unblock: (id: string) => api.post<{ ok: true }>(`/admin/users/${id}/unblock`),
  revokeSessions: (id: string) =>
    api.post<{ revoked: number }>(`/admin/users/${id}/revoke-sessions`),
  accessLogs: (query: {
    userId?: string;
    event?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) =>
    api.get<{ total: number; items: AdminAccessLogRow[] }>(`/admin/access-logs?${toQuery(query)}`),
  errorLogs: (query: {
    level?: string;
    source?: string;
    env?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<AdminErrorLogPage>(`/admin/error-logs?${toQuery(query)}`),
  errorLog: (id: string) => api.get<AdminErrorLogRow>(`/admin/error-logs/${id}`),
  stats: () => api.get<AdminStats>('/admin/stats'),
  emailOutbox: () => api.get<AdminEmailRow[]>('/admin/email-outbox'),
  emailSettings: () => api.get<AdminEmailSettings>('/admin/email-settings'),
  saveEmailSettings: (
    settings: Partial<AdminEmailSettings> & {
      provider: string;
      requireVerification: boolean;
      secret?: string;
    },
  ) => api.post<{ ok: true }>('/admin/email-settings', settings),
  testEmail: (to: string) =>
    api.post<{ delivered: boolean; detail?: string }>('/admin/email-settings/test', { to }),
  usersCsvUrl: '/api/v1/admin/export/users.csv',
};

function toQuery(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}
