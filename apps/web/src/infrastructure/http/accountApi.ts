import { api } from './client';
import type { Skin } from '@/skins/types';

export interface Me {
  id: string;
  email: string;
  name: string;
  countryCode: string;
  language: string;
  phoneE164?: string;
  role: 'USER' | 'ADMIN';
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'DELETED';
  plan: 'FREE' | 'PAID';
  emailVerified: boolean;
  referralCode: string;
  identities: string[];
}

export interface SignUpPayload {
  email: string;
  password: string;
  name: string;
  countryCode: string;
  language: string;
  phone?: string;
  phoneCountry?: string;
  marketingOptIn?: boolean;
  acceptedTerms: boolean;
  referralCode?: string;
  captchaToken?: string;
}

export const accountApi = {
  /** Which sign-in providers this deployment offers. */
  providers: () => api.get<{ google: boolean }>('/auth/providers'),
  googleLinked: () => api.get<{ linked: boolean }>('/auth/google/link'),
  unlinkGoogle: () => api.delete<void>('/auth/google/link'),
  me: () => api.get<Me>('/auth/me'),
  updateProfile: (patch: {
    name?: string;
    phone?: string | null;
    phoneCountry?: string;
    countryCode?: string;
    language?: string;
    marketingOptIn?: boolean;
  }) => api.patch<Me>('/auth/me', patch),
  changePassword: (newPassword: string, currentPassword?: string) =>
    api.post<{ ok: true }>('/auth/change-password', { newPassword, currentPassword }),
  exportData: () => api.get<Record<string, unknown>>('/auth/me/export'),
  deleteAccount: (password?: string) => api.delete<void>('/auth/me', password ? { password } : undefined),
  signUp: (payload: SignUpPayload) => api.post<{ id: string; emailVerificationRequired: boolean }>('/auth/signup', payload),
  login: (email: string, password: string, rememberMe?: boolean) =>
    api.post<Me>('/auth/login', { email, password, rememberMe }),
  logout: () => api.post<void>('/auth/logout'),
  forgotPassword: (email: string, captchaToken?: string) =>
    api.post<{ ok: true }>('/auth/forgot-password', { email, captchaToken }),
  resetPassword: (token: string, password: string) => api.post<{ ok: true }>('/auth/reset-password', { token, password }),
  verifyEmail: (token: string) => api.post<{ ok: true }>('/auth/verify-email', { token }),
  sessions: () => api.get<{ id: string; current: boolean; expiresAt: string; ip?: string; userAgent?: string }[]>('/auth/sessions'),
  revokeSession: (id: string) => api.delete<void>(`/auth/sessions/${id}`),
  referrals: () =>
    api.get<{ code: string; link: string; accepted: number; invites: { id: string; channel: string; sentAt: string; acceptedAt?: string }[] }>(
      '/referrals/me',
    ),
  invite: (payload: { channel: 'WHATSAPP' | 'EMAIL' | 'LINK'; email?: string; phone?: string; locale?: string }) =>
    api.post<{ ok: true; link: string; whatsappUrl?: string }>('/referrals/invite', payload),
};

/** Skins stored on the account, so a customisation follows the user. */
export const skinApi = {
  list: () => api.get<{ id: string; name: string; data: Skin; updatedAt: string }[]>('/skins'),
  save: (skin: Skin) => api.put<{ id: string; name: string; updatedAt: string }>('/skins', { skinId: skin.id, name: skin.name, data: skin }),
  remove: (skinId: string) => api.delete<void>(`/skins/${skinId}`),
};
