import { api } from './client';

export interface CloudReviewRow {
  id: string;
  title: string;
  sourceFileName?: string;
  roomDetected?: string;
  handCount: number;
  currentHandIndex: number;
  currentActionIndex?: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  storeHandHistory: boolean;
  lastOpenedAt: string;
  completedAt?: string;
  updatedAt: string;
}

export interface CloudReviewNote {
  tags: string[];
  body: string;
  includeInReport?: boolean;
  capture?: 'NONE' | 'TEXT' | 'IMAGE';
  imageRef?: string;
}

export interface CloudReviewHand {
  index: number;
  handId?: string;
  rawHistory?: string;
  heroPosition?: string;
  /** Did the hero voluntarily put money in? The base for coverage. */
  heroVpip?: boolean;
  result?: 'WON' | 'LOST' | 'FOLDED';
  potWon?: number;
  reviewedAt?: string;
  notes?: CloudReviewNote[];
}

export interface CloudReviewInput {
  title: string;
  sourceFileName?: string;
  roomDetected?: string;
  handCount: number;
  currentHandIndex?: number;
  currentActionIndex?: number;
  status?: 'IN_PROGRESS' | 'COMPLETED';
  storeHandHistory?: boolean;
  hands?: CloudReviewHand[];
}

/** Reviews kept on the account, so a study session can move between machines. */
export const reviewApi = {
  list: () =>
    api.get<{
      items: (CloudReviewRow & { _count: { hands: number } })[];
      quota: { perDay: number; usedToday: number };
    }>('/reviews'),
  get: (id: string) =>
    api.get<CloudReviewRow & { hands: (CloudReviewHand & { notes: CloudReviewNote[] })[] }>(
      `/reviews/${id}`,
    ),
  save: (id: string, review: CloudReviewInput) =>
    api.put<{ id: string; created: boolean }>(`/reviews/${id}`, review),
  progress: (
    id: string,
    body: {
      currentHandIndex: number;
      currentActionIndex?: number;
      status?: 'IN_PROGRESS' | 'COMPLETED';
    },
  ) => api.patch<{ ok: true }>(`/reviews/${id}`, body),
  remove: (id: string) => api.delete<void>(`/reviews/${id}`),
};
