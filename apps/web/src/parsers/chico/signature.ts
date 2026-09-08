/**
 * Chico exports its hand histories under the PokerStars header, so the header
 * alone cannot be trusted. These are the marks that only Chico leaves. They
 * live in their own file because both parsers read them: Chico to claim a file,
 * PokerStars to let go of one.
 *
 * Derived from 660 real hands of two 2026 tournaments, not from documentation.
 */
const SIGNATURES: { re: RegExp; what: string }[] = [
  { re: /Table 'CHC_\d+/, what: "table named CHC_" },
  { re: /Tournament #\d{3}-[0-9a-f]{7},/, what: 'tournament id 916-1a5ca85' },
  // A level with blinds but no numeral or roman number of its own.
  { re: /- Level \(\d+\/\d+\) -/, what: 'unnumbered level' },
  { re: /from side pot-\d/, what: 'side pot-1' },
];

/**
 * 0 when nothing matches. Two marks are enough to be sure — one alone could be
 * a coincidence in another room's file, two together have never been.
 */
export function chicoConfidence(text: string): number {
  const hits = SIGNATURES.filter((s) => s.re.test(text));
  if (hits.length === 0) return 0;
  return hits.length >= 2 ? 0.95 : 0.5;
}

/** Which marks were found, for the import screen to explain its choice. */
export function chicoSignatures(text: string): string[] {
  return SIGNATURES.filter((s) => s.re.test(text)).map((s) => s.what);
}
