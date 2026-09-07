import { api } from './client';

export type FeedbackKind = 'SUGGESTION' | 'IMPROVEMENT' | 'PROBLEM' | 'OTHER';
export type FeedbackStatus = 'NEW' | 'READ' | 'PLANNED' | 'DONE' | 'DECLINED';

export interface MyFeedbackRow {
  id: string;
  kind: FeedbackKind;
  subject: string;
  body: string;
  status: FeedbackStatus;
  createdAt: string;
}

export interface AdminFeedbackRow extends MyFeedbackRow {
  adminNote?: string;
  appSurface?: string;
  appVersion?: string;
  user?: { id: string; name: string; email: string };
}

export interface AdminFeedbackPage {
  total: number;
  page: number;
  pageSize: number;
  unread: number;
  items: AdminFeedbackRow[];
}

export const feedbackApi = {
  submit: (input: { kind: FeedbackKind; subject: string; body: string; appSurface?: string }) =>
    api.post<{ id: string }>('/feedback', input),
  mine: () => api.get<{ items: MyFeedbackRow[] }>('/feedback/mine'),
  list: (query: { status?: FeedbackStatus; kind?: FeedbackKind; page?: number } = {}) => {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.kind) params.set('kind', query.kind);
    if (query.page) params.set('page', String(query.page));
    const qs = params.toString();
    return api.get<AdminFeedbackPage>(`/admin/feedback${qs ? `?${qs}` : ''}`);
  },
  update: (id: string, patch: { status?: FeedbackStatus; adminNote?: string }) =>
    api.patch<{ id: string }>(`/admin/feedback/${id}`, patch),
};
