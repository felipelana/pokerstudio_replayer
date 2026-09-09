/**
 * What changed, and when. Adding a release means adding an entry to this array
 * and its strings to the eight locale files. No component is touched.
 *
 * The text itself lives in i18n, keyed by version, so the notes read in the
 * reader's own language. Only the shape is here.
 */

export type ReleaseChannel = 'beta' | 'stable';

/** The headings a release can group its items under, in the order they read. */
export const RELEASE_SECTIONS = ['rooms', 'replay', 'visual', 'analysis', 'languages', 'next'] as const;
export type ReleaseSection = (typeof RELEASE_SECTIONS)[number];

export interface Release {
  /** Semantic version, and the key its strings are filed under. */
  version: string;
  /** ISO date the build was cut. */
  date: string;
  channel: ReleaseChannel;
  /** How many items each section has, so the keys can be read without guessing. */
  sections: Partial<Record<ReleaseSection, number>>;
}

/** Newest first. The first entry is what the version badge shows. */
export const RELEASES: Release[] = [
  {
    version: '1.0.0',
    date: '2026-09-08',
    channel: 'stable',
    sections: { rooms: 2, replay: 5, visual: 4, analysis: 2, languages: 1, next: 3 },
  },
];

export const CURRENT_RELEASE = RELEASES[0];

/** The i18n key for one item of one section. */
export function itemKey(version: string, section: ReleaseSection, index: number): string {
  return `releases.v${version.replace(/\./g, '_')}.${section}.${index}`;
}

/** The i18n key for a release's own headline. */
export function highlightKey(version: string): string {
  return `releases.v${version.replace(/\./g, '_')}.highlight`;
}

/** Where the last version the reader saw is remembered. Per browser, no account. */
export const LAST_SEEN_KEY = 'pokerstudio.releases.lastSeen';

/** Newer than what this browser has seen? Any failure to read means no badge. */
export function hasUnread(): boolean {
  try {
    return localStorage.getItem(LAST_SEEN_KEY) !== CURRENT_RELEASE.version;
  } catch {
    return false;
  }
}

export function markRead(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, CURRENT_RELEASE.version);
  } catch {
    // A browser that refuses storage simply keeps showing the badge.
  }
}
