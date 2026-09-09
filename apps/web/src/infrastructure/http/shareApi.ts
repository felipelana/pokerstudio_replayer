import { api } from './client';

export interface ShareSettings {
  defaultHours: number;
  maxHours: number;
}

export interface Invite {
  id: string;
  coachName: string;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
  assessment?: { id: string; status: string; completedAt?: string | null } | null;
}

/** What the server hands back once, at creation: the token and nothing else. */
export interface NewInvite {
  id: string;
  token: string;
  coachName: string;
  expiresAt: string;
}

export interface CoachSession {
  coachName: string;
  expiresAt: string;
  assessmentId: string;
  player: string;
  session: { id: string; title: string; sourceFileName?: string | null; room?: string | null; handCount: number };
}

/** One hand as it was written by the room, when the player kept the histories. */
export interface SharedHand {
  index: number;
  handId?: string | null;
  rawHistory: string;
}

/** The coach's own reading of one hand. */
export interface HandReading {
  score?: number | null;
  markedOk?: boolean;
  comment?: string | null;
  tags?: string[];
}

export interface CoachAssessment {
  assessment: { id: string; status: string; completedAt?: string | null };
  rows: { index: number; assessment: (HandReading & { handRecordId?: string }) | null }[];
  summary: { score: number | null; coverage: { total: number; reviewed: number }; pending: number };
}

/** One assessor of a review, as the owner of the review sees them listed. */
export interface SessionAssessmentRow {
  id: string;
  role: 'SELF' | 'COACH';
  status: string;
  completedAt?: string | null;
  coachName?: string;
  inviteId?: string;
  expiresAt?: string;
  revokedAt?: string | null;
  summary: {
    score: { value: number | null; scored: number };
    coverage: { reviewed: number; total: number; percent: number | null };
    leaks: { tag: string; hands: number; percent: number | null }[];
    reviewedHands: number;
  };
}

export const shareApi = {
  settings: () => api.get<ShareSettings>('/share-settings'),
  list: (reviewId: string) => api.get<{ items: Invite[] }>(`/reviews/${reviewId}/invites`),
  create: (reviewId: string, input: { coachName: string; password: string; expiresAt?: string }) =>
    api.post<NewInvite>(`/reviews/${reviewId}/invites`, input),
  revoke: (inviteId: string) => api.post<{ id: string }>(`/invites/${inviteId}/revoke`),
  /** What a coach wrote, read by the player who owns the review. */
  readingOf: (assessmentId: string) => api.get<CoachAssessment>(`/assessments/${assessmentId}`),
  /** Every reading of one review: the player's own, and each coach's. */
  assessmentsOf: (reviewId: string) =>
    api.get<{ session: { id: string; title: string; handCount: number }; items: SessionAssessmentRow[] }>(
      `/reviews/${reviewId}/assessments`,
    ),

  /** The coach's side: the token comes from the link, the password from the player. */
  open: (token: string, password: string) =>
    api.post<{ coachName: string; expiresAt: string }>('/coach/open', { token, password }),
  /** The token travels so a cookie left over from another link cannot answer. */
  session: (token?: string) =>
    api.get<CoachSession>(`/coach/session${token ? `?token=${encodeURIComponent(token)}` : ''}`),
  close: () => api.post<{ ok: boolean }>('/coach/close'),
  hands: () => api.get<{ stored: boolean; items: SharedHand[] }>('/coach/hands'),
  reading: () => api.get<CoachAssessment>('/coach/assessment'),
  saveHand: (index: number, patch: HandReading) =>
    api.patch<{ id: string }>(`/coach/assessment/hands/${index}`, patch),
  finish: () => api.post<{ id: string; status: string }>('/coach/assessment/complete'),
};

/**
 * The address the player hands over. The token travels here; the password never
 * does, which is why it is shown beside the link and copied separately.
 */
export function coachLink(token: string): string {
  return `${window.location.origin}/coach/${token}`;
}
