/**
 * Canonical, site-independent poker hand model.
 * Every parser must produce this shape; the replay engine and the UI never
 * look at raw hand-history text again (except for the "Copy" button).
 */

export type Site =
  | 'pokerstars'
  | 'ggpoker'
  | '888'
  | 'ipoker'
  | 'wpn'
  | 'chico'
  | 'coinpoker';

export type GameType = 'cash' | 'tournament';
export type Variant = 'holdem' | 'omaha' | 'omaha-hilo' | 'short-deck';
export type BetLimit = 'NL' | 'PL' | 'FL';

/** 'chips' for tournaments; an ISO-ish code for cash games. */
export type Currency =
  | 'chips'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CAD'
  | 'BRL'
  | 'RUB'
  | 'CNY'
  | 'PLAY';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

export type ActionType =
  | 'post-sb'
  | 'post-bb'
  | 'post-ante'
  | 'post-dead'
  | 'post-straddle'
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'uncalled-return'
  | 'collect'
  | 'show'
  | 'muck'
  | 'timeout'
  | 'disconnect'
  | 'info';

export interface Action {
  player: string;
  type: ActionType;
  /** Chips added to the pot by this action (incremental, never cumulative). */
  amount?: number;
  /** For raises: the total street commitment reached — "raises 400 to 1200" => 1200. */
  toAmount?: number;
  isAllIn: boolean;
  /** Cards revealed by a `show` action. */
  cards?: string[];
  /** Human-readable extra (e.g. "with a pair of Aces"), kept untranslated. */
  detail?: string;
  raw: string;
}

export interface Player {
  seat: number;
  name: string;
  startingStack: number;
  isHero: boolean;
  isSittingOut: boolean;
  /** Bounty won by/for this player, tournaments with knockouts. */
  bounty?: number;
}

export interface Pot {
  /** 'main' | 'side' | 'side-1' … | 'total' when the site does not split. */
  kind: 'main' | 'side' | 'total';
  index?: number;
  amount: number;
  winners: { player: string; amount: number }[];
}

export interface TournamentInfo {
  id: string;
  /** Raw buy-in string, e.g. "$0.49+$0.49+$0.12 USD". */
  buyIn?: string;
  /** Prize-pool portion. */
  buyInMain?: number;
  /** Knockout/bounty portion (3-part buy-ins). */
  bounty?: number;
  /** Fee portion. */
  fee?: number;
  buyInCurrency?: Currency;
  level?: string;
  name?: string;
  isFreeroll?: boolean;
}

export interface Blinds {
  sb: number;
  bb: number;
  ante?: number;
  straddle?: number;
}

export interface HandSummary {
  totalPot: number;
  rake: number;
  pots: Pot[];
}

export interface Hand {
  /** Stable SHA-256 of the normalised raw text; used to dedupe on re-import. */
  id: string;
  /** Site-assigned hand number, kept for display and cross-referencing. */
  handNumber: string;
  site: Site;
  gameType: GameType;
  variant: Variant;
  limit: BetLimit;
  currency: Currency;
  tournament?: TournamentInfo;
  blinds: Blinds;
  tableName: string;
  maxSeats: number;
  buttonSeat: number;
  timestamp: Date;
  players: Player[];
  heroName?: string;
  streets: {
    preflop: Action[];
    flop?: Action[];
    turn?: Action[];
    river?: Action[];
  };
  /** Blinds/antes and other pre-deal postings, in order. */
  posts: Action[];
  board: string[];
  /** Known hole cards, by player name. */
  holeCards: Record<string, string[]>;
  showdown: Action[];
  /** Non-gameplay events worth showing in the log (bounties, eliminations…). */
  events: Action[];
  summary: HandSummary;
  raw: string;
  warnings: string[];
}

/** Result of importing one file / paste. */
export interface Session {
  id: string;
  name: string;
  site: Site | 'unknown';
  handIds: string[];
  handCount: number;
  importedAt: Date;
  firstHandAt?: Date;
  lastHandAt?: Date;
  players: string[];
  warnings: string[];
  /** The file this came from, kept even when the session is renamed. */
  sourceFileName?: string;
  /** Last time the session was opened in the replayer. */
  lastOpenedAt?: Date;
  /** Where the review stopped, so it can be picked up again. */
  lastHandIndex?: number;
  /** And which frame of that hand, so the spot is exact. */
  lastFrameIndex?: number;
  /** Marked by hand — or on its own when the last hand is reached. */
  status?: 'in-progress' | 'completed';
  /** When the review was finished. */
  completedAt?: Date;
}

export type LeakTag =
  | 'overfold'
  | 'underfold'
  | 'sizing'
  | 'icm'
  | 'bluff-catch'
  | 'thin-value'
  | 'position'
  | 'tilt'
  | 'preflop-range'
  | 'missed-value';

/** A leak tag the user defined (L1). */
export interface UserTag {
  id: string;
  label: string;
  color: string;
}

export interface Review {
  handId: string;
  notes: string;
  /** Ids of user tags (L1). */
  tags: string[];
  /** Include this hand in the exported report (L2). */
  includeInReport?: boolean;
  /** What to carry into the report for this hand (L3). */
  capture?: 'text' | 'image';
  /** Asset id of the captured table image (L3). */
  imageAssetId?: string;
  /** Action the note refers to, in words (L3). */
  actionLabel?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  streetNotes?: Partial<Record<Street, string>>;
  createdAt: Date;
  updatedAt: Date;
}

export type HandResult = 'won' | 'lost' | 'folded' | 'break-even';
