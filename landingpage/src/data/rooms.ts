/**
 * The rooms whose .txt hand histories the importer reads, as confirmed by the
 * product owner.
 *
 * `logo` is deliberately empty. Redistributing a room's logo means shipping
 * someone else's trademark with the site, and a wrong or outdated file would be
 * worse than no file at all — so the grid shows the room's name set as a
 * wordmark instead, which is accurate and claims nothing. Drop an official
 * asset into src/assets/rooms/ and point `logo` at it to switch a card over;
 * the card already renders an <img> when one is present. ASSETS.md lists the
 * official brand pages each file should come from.
 */
export interface Room {
  id: string;
  /** Exactly as the room writes it. */
  name: string;
  /** Two or three letters for the monogram tile. */
  monogram: string;
}

export const ROOMS: Room[] = [
  { id: 'pokerstars', name: 'PokerStars', monogram: 'PS' },
  { id: '888poker', name: '888poker', monogram: '888' },
  { id: 'ggpoker', name: 'GGPoker', monogram: 'GG' },
  { id: 'ipoker', name: 'iPoker', monogram: 'iP' },
  { id: 'wpn', name: 'WPN', monogram: 'WPN' },
  { id: 'chico', name: 'Chico', monogram: 'CH' },
  { id: 'winamax', name: 'Winamax', monogram: 'WX' },
  { id: 'coinpoker', name: 'CoinPoker', monogram: 'CP' },
  { id: 'ignition', name: 'Ignition / Bodog', monogram: 'IG' },
  { id: 'partypoker', name: 'PartyPoker', monogram: 'PP' },
];
