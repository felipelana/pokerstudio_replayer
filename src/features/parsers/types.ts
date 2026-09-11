import type { Hand, Site } from '@/domain/model/types';

export class NotImplementedError extends Error {
  constructor(site: string) {
    super(`Parser for ${site} is recognised but not implemented yet`);
    this.name = 'NotImplementedError';
  }
}

/**
 * A hand-history parser for one site.
 *  - detect: confidence 0..1 that the text is this site's format.
 *  - split:  cut a file into individual hand blocks (raw text).
 *  - parse:  turn one block into the canonical Hand (never throws on unknown
 *            lines — push to `warnings` instead).
 */
export interface HandHistoryParser {
  site: Site;
  displayName: string;
  detect(text: string): number;
  split(text: string): string[];
  parse(handText: string): Omit<Hand, 'id'>;
}

export interface ParseResult {
  site: Site | 'unknown';
  hands: Hand[];
  /** Blocks that failed hard (should be rare — parsers are tolerant). */
  failures: { raw: string; error: string }[];
  warnings: string[];
}
