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
  /** The skins a room's network exports under, when it has more than one. */
  network?: string;
  /**
   * Whether the importer reads this room's files today. Only a room with a
   * grammar derived from real hands is true — promising the rest would be a
   * promise the product cannot keep.
   */
  available: boolean;
}

// The two that read come first, and say so. The rest are listed because they
// are coming, not because they work.
export const ROOMS: Room[] = [
  { id: 'pokerstars', name: 'PokerStars', monogram: 'PS', available: true },
  { id: 'chico', name: 'Chico', network: 'BetOnline · TigerGaming · Sportsbetting', monogram: 'CH', available: true },
  { id: '888poker', name: '888poker', monogram: '888', available: false },
  { id: 'ggpoker', name: 'GGPoker', monogram: 'GG', available: false },
  { id: 'ipoker', name: 'iPoker', network: 'RedStar · Champion · Betsson · NetBet', monogram: 'iP', available: false },
  { id: 'wpn', name: 'WPN', network: 'ACR · BCP · Ya Poker', monogram: 'WPN', available: false },
  { id: 'winamax', name: 'Winamax', monogram: 'WX', available: false },
  { id: 'coinpoker', name: 'CoinPoker', monogram: 'CP', available: false },
  { id: 'ignition', name: 'Ignition / Bodog', monogram: 'IG', available: false },
  { id: 'partypoker', name: 'PartyPoker', monogram: 'PP', available: false },
];

/** The rooms whose hand histories the importer reads today. */
export const AVAILABLE_ROOMS = ROOMS.filter((room) => room.available);
