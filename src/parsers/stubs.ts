import type { Hand, Site } from '@/model/types';
import { NotImplementedError, type HandHistoryParser } from './types';

/**
 * Header-signature detectors for sites whose grammar has not been derived from
 * real fixtures yet. `parse` throws NotImplementedError so the UI can show
 * "format recognised, not supported yet" instead of silently producing garbage.
 *
 * Do NOT guess formats here — derive them from real fixtures when they arrive.
 */
function stub(site: Site, displayName: string, signatures: RegExp[]): HandHistoryParser {
  return {
    site,
    displayName,
    detect(text: string): number {
      const head = text.slice(0, 4000);
      return signatures.some((re) => re.test(head)) ? 0.9 : 0;
    },
    split(text: string): string[] {
      return text
        .replace(/^\uFEFF+/, '')
        .replace(/\r\n?/g, '\n')
        .split(/\n{2,}/)
        .map((b) => b.trim())
        .filter(Boolean);
    },
    parse(): Omit<Hand, 'id'> {
      throw new NotImplementedError(displayName);
    },
  };
}

export const wpnParser = stub('wpn', 'WPN (ACR / BCP / Ya Poker)', [
  /^Game Hand #\d+ - /m,
  /Winning Poker Network/i,
]);

export const ggPokerParser = stub('ggpoker', 'GGPoker', [
  /^Poker Hand #(?:TM|RC|HD|SD|OM)\d+:/m,
  /GGPoker/i,
]);

export const eight88Parser = stub('888', '888poker', [
  /^\*\*\*\*\* 888poker Hand History for Game \d+/m,
  /^#Game No : \d+/m,
]);

export const iPokerParser = stub('ipoker', 'iPoker', [
  /<session sessioncode=/i,
  /<general>\s*<mode>/i,
]);

export const chicoParser = stub('chico', 'Chico Poker Network', [
  /^Game ID: \d+ .* \(.*\) - /m,
  /^Hand #\d+-\d+ - /m,
]);

export const coinPokerParser = stub('coinpoker', 'CoinPoker', [
  /^CoinPoker Hand #\d+:/m,
  /CoinPoker/i,
]);

export const stubParsers: HandHistoryParser[] = [
  wpnParser,
  ggPokerParser,
  eight88Parser,
  iPokerParser,
  chicoParser,
  coinPokerParser,
];
