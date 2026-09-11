import type { Site } from './types';

/**
 * Display names for the rooms the parsers can detect, plus the network each one
 * belongs to (used to build external player lookups such as SharkScope).
 * Kept as plain data so it can move to `packages/shared` untouched.
 */
export const SITE_NAMES: Record<Site, string> = {
  pokerstars: 'PokerStars',
  ggpoker: 'GGPoker',
  '888': '888poker',
  ipoker: 'iPoker',
  wpn: 'Winning Poker Network',
  chico: 'Chico Poker Network',
  coinpoker: 'CoinPoker',
};

/** SharkScope network segment; `*` means "every network". */
export const SITE_NETWORKS: Record<Site, string> = {
  pokerstars: 'PokerStars',
  ggpoker: 'GGPoker',
  '888': '888poker',
  ipoker: 'iPoker',
  wpn: 'Winning Poker Network',
  chico: 'Chico Poker Network',
  coinpoker: 'CoinPoker',
};

export function siteName(site?: Site): string | undefined {
  return site ? SITE_NAMES[site] : undefined;
}

export function siteNetwork(site?: Site): string {
  return (site && SITE_NETWORKS[site]) || '*';
}
