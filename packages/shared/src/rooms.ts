import type { Site } from './index.js';

/**
 * The catalogue of poker rooms, and the one place that says which of them the
 * importer actually reads.
 *
 * It lives here because three screens have to agree: the landing page grid, the
 * importer's error when it meets a file it cannot read, and the nicknames form
 * in settings. Two copies of this list would drift, and the drift would show up
 * as a promise the product does not keep.
 *
 * This is pure data. The landing page bundles it at build time and keeps no
 * runtime tie to the replayer or the API.
 */

export type RoomStatus = 'available' | 'coming-soon';

export interface Room {
  /** Catalogue id. A superset of the parser's Site: some rooms have no parser. */
  id: string;
  /** Exactly as the room writes it. */
  name: string;
  /** Two or three letters for the monogram tile. */
  monogram: string;
  /**
   * The skins a network exports under, when it has more than one. Rooms change
   * their line-up, so treat this as a label rather than a registry.
   */
  network?: string;
  /**
   * available: a grammar derived from real hands, with an acceptance test.
   * coming-soon: recognised by the importer, or not yet even that.
   */
  status: RoomStatus;
  /** The parser key, for rooms the replayer has one for. */
  site?: Site;
}

export const ROOMS: Room[] = [
  { id: 'pokerstars', name: 'PokerStars', monogram: 'PS', status: 'available', site: 'pokerstars' },
  {
    id: 'chico',
    name: 'Chico',
    network: 'BetOnline · TigerGaming · SportsBetting',
    monogram: 'CH',
    status: 'available',
    site: 'chico',
  },
  { id: 'ggpoker', name: 'GGPoker', monogram: 'GG', status: 'coming-soon', site: 'ggpoker' },
  { id: '888poker', name: '888poker', monogram: '888', status: 'coming-soon', site: '888' },
  {
    id: 'ipoker',
    name: 'iPoker',
    network: 'RedStar · Champion · Betsson · NetBet',
    monogram: 'iP',
    status: 'coming-soon',
    site: 'ipoker',
  },
  { id: 'wpn', name: 'WPN', network: 'ACR · BCP · Ya Poker', monogram: 'WPN', status: 'coming-soon', site: 'wpn' },
  { id: 'coinpoker', name: 'CoinPoker', monogram: 'CP', status: 'coming-soon', site: 'coinpoker' },
  { id: 'ignition', name: 'Ignition / Bodog', monogram: 'IG', status: 'coming-soon' },
  { id: 'winamax', name: 'Winamax', monogram: 'WX', status: 'coming-soon' },
  { id: 'partypoker', name: 'PartyPoker', monogram: 'PP', status: 'coming-soon' },
];

export const AVAILABLE_ROOMS = ROOMS.filter((room) => room.status === 'available');
export const COMING_SOON_ROOMS = ROOMS.filter((room) => room.status === 'coming-soon');

/** The catalogue entry for a parser key, when the room has one. */
export function roomForSite(site: Site): Room | undefined {
  return ROOMS.find((room) => room.site === site);
}

/** Whether the importer can read this room's hands today. */
export function isRoomAvailable(site: Site): boolean {
  return roomForSite(site)?.status === 'available';
}

/**
 * The room name for a parser key, for a message that has to say which room it
 * met. Takes any string: the importer may be holding a key it did not recognise,
 * and the answer to that is nothing rather than a type error at the call site.
 */
export function roomName(site: string): string | undefined {
  return ROOMS.find((room) => room.site === site)?.name;
}
