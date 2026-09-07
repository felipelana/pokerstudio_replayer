/**
 * Contracts shared by the web app and the API. Pure data and types only —
 * nothing here may import React, Prisma, Fastify or any I/O.
 */

export * from './assessment.js';

export const LANGUAGE_CODES = ['pt-BR', 'en', 'es', 'de', 'ru', 'zh-CN', 'ja', 'ko'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const SITES = ['pokerstars', 'ggpoker', '888', 'ipoker', 'wpn', 'chico', 'coinpoker'] as const;
export type Site = (typeof SITES)[number];

/** Display name and external-lookup network for each supported room. */
export const SITE_INFO: Record<Site, { name: string; network: string }> = {
  pokerstars: { name: 'PokerStars', network: 'PokerStars' },
  ggpoker: { name: 'GGPoker', network: 'GGPoker' },
  '888': { name: '888poker', network: '888poker' },
  ipoker: { name: 'iPoker', network: 'iPoker' },
  wpn: { name: 'Winning Poker Network', network: 'Winning Poker Network' },
  chico: { name: 'Chico Poker Network', network: 'Chico Poker Network' },
  coinpoker: { name: 'CoinPoker', network: 'CoinPoker' },
};

export type UserStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'DELETED';
export type UserRole = 'USER' | 'ADMIN';
export type UserPlan = 'FREE' | 'PAID';

/** What `GET /auth/me` returns. */
export interface MeDto {
  id: string;
  email: string;
  name: string;
  countryCode: string;
  language: LanguageCode;
  phoneE164?: string;
  role: UserRole;
  status: UserStatus;
  plan: UserPlan;
  emailVerified: boolean;
  referralCode: string;
  identities: ('PASSWORD' | 'GOOGLE')[];
}

/**
 * A skin saved to the user's account. The body is the same `Skin` object the
 * replayer already uses; it travels as JSON so the editor needs no changes.
 */
export interface SkinDto {
  id: string;
  name: string;
  /** Serialised Skin from the web app. */
  data: unknown;
  updatedAt: string;
}

/** Per-user quotas, enforced by the API and surfaced in the UI. */
export const QUOTAS = {
  /** Review uploads allowed per user per day. */
  reviewUploadsPerDay: 20,
} as const;

export * from './countries';
