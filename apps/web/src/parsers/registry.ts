import type { Hand, Site } from '@/model/types';
import { normalizeRaw, sha256 } from '@/model/hash';
import { chicoParser } from './chico';
import { pokerStarsParser } from './pokerstars';
import { stubParsers } from './stubs';
import { NotImplementedError, type HandHistoryParser, type ParseResult } from './types';

/**
 * Chico comes before PokerStars deliberately: it publishes under the PokerStars
 * header, and only its own signatures tell the two apart. Detection picks the
 * highest confidence, and PokerStars stands down when Chico's marks are there.
 */
export const parsers: HandHistoryParser[] = [chicoParser, pokerStarsParser, ...stubParsers];

export function parserFor(site: Site): HandHistoryParser | undefined {
  return parsers.find((p) => p.site === site);
}

/** Pick the parser with the highest detect() confidence; undefined if none matches. */
export function detectParser(text: string): { parser: HandHistoryParser; confidence: number } | undefined {
  let best: { parser: HandHistoryParser; confidence: number } | undefined;
  for (const parser of parsers) {
    const confidence = parser.detect(text);
    if (confidence > 0 && (!best || confidence > best.confidence)) best = { parser, confidence };
  }
  return best;
}

/**
 * Parse a whole file (or paste). Never throws for tolerable input; hard
 * failures are collected per block.
 */
export async function parseText(text: string, override?: Site): Promise<ParseResult> {
  const chosen = override ? parserFor(override) : detectParser(text)?.parser;
  if (!chosen) {
    return { site: 'unknown', hands: [], failures: [], warnings: ['Unrecognised hand history format'] };
  }
  const result: ParseResult = { site: chosen.site, hands: [], failures: [], warnings: [] };
  let blocks: string[];
  try {
    blocks = chosen.split(text);
  } catch (e) {
    result.failures.push({ raw: text.slice(0, 200), error: String(e) });
    return result;
  }
  for (const block of blocks) {
    try {
      const partial = chosen.parse(block);
      const id = await sha256(normalizeRaw(block));
      result.hands.push({ id, ...partial } as Hand);
    } catch (e) {
      if (e instanceof NotImplementedError) {
        result.warnings.push(e.message);
        result.failures.push({ raw: block.slice(0, 200), error: e.message });
        break;
      }
      result.failures.push({ raw: block.slice(0, 200), error: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
