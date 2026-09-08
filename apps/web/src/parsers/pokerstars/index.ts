import type {
  Action,
  ActionType,
  BetLimit,
  Currency,
  Hand,
  Player,
  Pot,
  TournamentInfo,
  Site,
  Variant,
} from '@/model/types';
import { parseCards } from '@/model/cards';
import { parseMoney } from '@/model/format';
import type { HandHistoryParser } from '../types';
import { chicoConfidence } from '../chico/signature';

/* ------------------------------------------------------------------ */
/* Regexes                                                             */
/* ------------------------------------------------------------------ */

const RE_HEADER_START = /^PokerStars (?:Zoom |Home Game )?(?:Hand|Game) #(\d+):\s*(.*)$/;
// The tournament id is not always numeric — Chico writes 916-1a5ca85 — and the
// level is not always named: Chico publishes "Level (3500/7000)" with no
// numeral at all. Both are optional here so one grammar serves both rooms.
const RE_TOURNEY =
  /^Tournament #([\w-]+),\s*(.+?)\s+(Hold'em|6\+ Hold'em|Omaha Hi\/Lo|Omaha|Courchevel|Razz)\s+(No Limit|Pot Limit|Limit|Fixed Limit)\s*-\s*(?:Match Round [IVXLC\d]+,\s*)?Level (?:([IVXLC\d]+)\s*)?\((\S+)\/(\S+)\)\s*-\s*(.+)$/;
const RE_CASH =
  /^(Hold'em|6\+ Hold'em|Omaha Hi\/Lo|Omaha|Courchevel|Razz)\s+(No Limit|Pot Limit|Limit|Fixed Limit)\s*\(([^)]+)\)\s*-\s*(.+)$/;
const RE_TIMESTAMP = /(\d{4})\/(\d{2})\/(\d{2}) (\d{1,2}):(\d{2}):(\d{2})\s*([A-Z]{2,5})?/;
const RE_TABLE =
  /^Table '(.+)' (\d+)-max(?: \((?:Play Money|Real Money)\))? Seat #(\d+) is the button$/;
const RE_SEAT =
  /^Seat (\d+): (.+?) \(([^() ]+) in chips(?:,\s*([^)]*?)\s*bounty)?\)(?:\s+(.*))?$/;
const RE_POST =
  /^(.+): posts (small blind|big blind|the ante|small & big blinds|straddle|dead blind|big blind & dead) ([^ ]+)( and is all-in)?$/;
const RE_DEALT = /^Dealt to (.+) \[([^\]]+)\]$/;
const RE_FOLD = /^(.+): folds(?: \[([^\]]+)\])?$/;
const RE_CHECK = /^(.+): checks$/;
const RE_CALL = /^(.+): calls ([^ ]+)( and is all-in)?$/;
const RE_BET = /^(.+): bets ([^ ]+)( and is all-in)?$/;
const RE_RAISE = /^(.+): raises ([^ ]+) to ([^ ]+)( and is all-in)?$/;
const RE_UNCALLED = /^Uncalled bet \(([^)]+)\) returned to (.+)$/;
const RE_COLLECT = /^(.+) collected ([^ ]+) from (pot|main pot|side pot(?:-\d+)?)$/;
const RE_SHOWS = /^(.+): shows \[([^\]]+)\](?: \((.*)\))?$/;
const RE_MUCKS = /^(.+): mucks hand$/;
const RE_NOSHOW = /^(.+): doesn't show hand$/;
const RE_STREET =
  /^\*\*\* (HOLE CARDS|FLOP|TURN|RIVER|SHOW DOWN|SUMMARY|FIRST FLOP|FIRST TURN|FIRST RIVER|SECOND FLOP|SECOND TURN|SECOND RIVER|FIRST SHOW DOWN|SECOND SHOW DOWN) \*\*\*(.*)$/;
const RE_TOTAL_POT =
  /^Total pot ([^ ]+)(?: Main pot ([^ ]+)\.((?: Side pot(?:-\d+)? [^ ]+\.)*))?\s*\|\s*Rake ([^ ]+)$/;
const RE_SIDE_POT = /Side pot(?:-(\d+))? ([^ .]+)\./g;
const RE_BOARD = /^(?:FIRST |SECOND )?Board \[([^\]]*)\]$/;
const RE_SUMMARY_SEAT =
  /^Seat (\d+): (.+?)(?: \((button|small blind|big blind|button\) \(small blind|button\) \(big blind)\))? (folded before Flop(?: \(didn't bet\))?|folded on the (?:Flop|Turn|River)|showed \[([^\]]+)\] and (?:won|lost) \(?[^)]*\)?.*|mucked(?: \[([^\]]+)\])?|collected \(([^)]+)\)|won \(([^)]+)\).*|showed \[([^\]]+)\])$/;

const RE_TIMEOUT = /^(.+) has timed out(?: while (?:being )?disconnected)?$/;
const RE_DISCONNECT = /^(.+) is (disconnected|connected)$/;
const RE_FINISHED = /^(.+) finished the tournament in (\d+)(?:st|nd|rd|th) place(?: and received (.+?))?\.?$/;
const RE_BOUNTY_INFO =
  /^(.+) wins (?:the )?(\S+) (?:bounty )?for eliminating (.+?)(?: and their own bounty increases .*)?$/;
const RE_INFO_LINES = [
  /^(.+) leaves the table$/,
  /^(.+) joins the table at seat #\d+$/,
  /^(.+): sits out$/,
  /^(.+) is sitting out$/,
  /^(.+) has returned$/,
  /^(.+) will be allowed to play after the button$/,
  /^(.+) was removed from the table.*$/,
  /^(.+) re-buys.*$/,
  /^(.+) said, ".*"$/,
  /^(.+) wins the tournament and receives .+$/,
  /^(.+) wins an entry to tournament .+$/,
  /^(.+): is sitting out$/,
  /^Hand was run twice$/,
  /^(.+) receives .+ for eliminating .+$/,
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function money(text: string): number {
  return parseMoney(text);
}

/** Chip arithmetic in cents to avoid 0.15 - 0.1 = 0.0499… */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function currencyFromSymbolOrCode(text: string): Currency {
  if (/USD/.test(text)) return 'USD';
  if (/EUR/.test(text)) return 'EUR';
  if (/GBP/.test(text)) return 'GBP';
  if (/CAD/.test(text)) return 'CAD';
  if (/BRL/.test(text)) return 'BRL';
  if (/RUB/.test(text)) return 'RUB';
  if (/CNY/.test(text)) return 'CNY';
  if (text.includes('$')) return 'USD';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  if (text.includes('₽')) return 'RUB';
  if (text.includes('¥')) return 'CNY';
  return 'PLAY';
}

function variantOf(text: string): Variant {
  if (text.startsWith('6+')) return 'short-deck';
  if (text.startsWith('Omaha Hi/Lo')) return 'omaha-hilo';
  if (text.startsWith('Omaha')) return 'omaha';
  return 'holdem';
}

function limitOf(text: string): BetLimit {
  if (text === 'No Limit') return 'NL';
  if (text === 'Pot Limit') return 'PL';
  return 'FL';
}

/** US Eastern DST: 2nd Sunday March 02:00 -> 1st Sunday November 02:00 (local). */
function isUsEasternDst(y: number, m: number, d: number, h: number): boolean {
  const nthSunday = (year: number, month: number, n: number) => {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const start = nthSunday(y, 2, 2); // March
  const end = nthSunday(y, 10, 1); // November
  const t = Date.UTC(y, m - 1, d, h);
  const s = Date.UTC(y, 2, start, 2);
  const e = Date.UTC(y, 10, end, 2);
  return t >= s && t < e;
}

const TZ_OFFSET_HOURS: Record<string, number | 'ET'> = {
  ET: 'ET',
  EST: -5,
  EDT: -4,
  UTC: 0,
  GMT: 0,
  WET: 0,
  BST: 1,
  CET: 1,
  CEST: 2,
  EET: 2,
  MSK: 3,
  BRT: -3,
  PT: -8,
  MT: -7,
  CT: -6,
  AEST: 10,
  JST: 9,
  KST: 9,
  HKT: 8,
  CST: 8,
};

/**
 * Parse the trailing part of the header: "2026/05/12 20:39:36 WET [2026/05/12 15:39:36 ET]".
 * ET (the bracketed reference when present) wins.
 */
export function parseTimestamp(text: string): Date {
  const bracket = text.match(/\[([^\]]+)\]/);
  const source = bracket ? bracket[1] : text;
  const m = source.match(RE_TIMESTAMP);
  if (!m) return new Date(NaN);
  const [, y, mo, d, h, mi, s, tz] = m;
  const Y = +y,
    M = +mo,
    D = +d,
    H = +h,
    MI = +mi,
    S = +s;
  let offset = 0;
  const known = TZ_OFFSET_HOURS[tz ?? 'ET'];
  if (known === 'ET') offset = isUsEasternDst(Y, M, D, H) ? -4 : -5;
  else if (typeof known === 'number') offset = known;
  return new Date(Date.UTC(Y, M - 1, D, H - offset, MI, S));
}

/** "$0.49+$0.49+$0.12 USD" -> { buyInMain, bounty, fee, currency } */
export function parseBuyIn(text: string): Partial<TournamentInfo> {
  const t = text.trim();
  if (/^Freeroll/i.test(t)) return { buyIn: t, isFreeroll: true, buyInMain: 0, fee: 0 };
  const currency = currencyFromSymbolOrCode(t);
  const parts = t
    .replace(/\s*(USD|EUR|GBP|CAD|BRL|RUB|CNY)\s*$/i, '')
    .split('+')
    .map((p) => money(p));
  if (parts.length === 3) {
    return {
      buyIn: t,
      buyInMain: parts[0],
      bounty: parts[1],
      fee: parts[2],
      buyInCurrency: currency,
    };
  }
  if (parts.length === 2) {
    return { buyIn: t, buyInMain: parts[0], fee: parts[1], buyInCurrency: currency };
  }
  return { buyIn: t, buyInMain: parts[0] ?? 0, buyInCurrency: currency };
}

function act(player: string, type: ActionType, raw: string, extra: Partial<Action> = {}): Action {
  return { player, type, isAllIn: false, raw, ...extra };
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

type Section = 'header' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'summary';

export class PokerStarsParser implements HandHistoryParser {
  // Declared as the wider type so a room that publishes the same grammar —
  // Chico does — can extend this parser and answer with its own name.
  site: Site = 'pokerstars';
  displayName = 'PokerStars';

  detect(text: string): number {
    const head = text.slice(0, 4000);
    // Chico publishes under the PokerStars header; whoever wrote the file, it
    // is not PokerStars, and guessing wrong replays the hand under the wrong
    // grammar in silence.
    if (chicoConfidence(head) > 0) return 0;
    if (/PokerStars (?:Zoom |Home Game )?(?:Hand|Game) #\d+/.test(head)) return 1;
    if (/\*\*\* HOLE CARDS \*\*\*/.test(head) && /Seat #\d+ is the button/.test(head)) return 0.4;
    return 0;
  }

  split(text: string): string[] {
    const clean = text.replace(/^\uFEFF+/, '').replace(/\r\n?/g, '\n');
    const lines = clean.split('\n');
    const blocks: string[] = [];
    let current: string[] | null = null;
    for (const line of lines) {
      if (RE_HEADER_START.test(line.trimEnd())) {
        if (current && current.length) blocks.push(current.join('\n').trim());
        current = [line];
      } else if (current) {
        current.push(line);
      }
    }
    if (current && current.length) blocks.push(current.join('\n').trim());
    return blocks.filter((b) => b.length > 0);
  }

  parse(handText: string): Omit<Hand, 'id'> {
    const raw = handText;
    const lines = handText
      .replace(/^\uFEFF+/, '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((l) => l.trimEnd());

    const warnings: string[] = [];
    const players: Player[] = [];
    const posts: Action[] = [];
    const streets: Hand['streets'] = { preflop: [] };
    const showdown: Action[] = [];
    const events: Action[] = [];
    const holeCards: Record<string, string[]> = {};
    let board: string[] = [];
    let heroName: string | undefined;
    let handNumber = '';
    let gameType: Hand['gameType'] = 'cash';
    let variant: Variant = 'holdem';
    let limit: BetLimit = 'NL';
    let currency: Currency = 'chips';
    let tournament: TournamentInfo | undefined;
    let blinds = { sb: 0, bb: 0 } as Hand['blinds'];
    let tableName = '';
    let maxSeats = 9;
    let buttonSeat = 1;
    let timestamp = new Date(NaN);
    const summary: Hand['summary'] = { totalPot: 0, rake: 0, pots: [] };
    let section: Section = 'header';
    let runItTwice = false;

    // Per-street commitment, used to turn "raises X to Y" into an incremental amount.
    let committed: Record<string, number> = {};
    const resetCommitted = () => {
      committed = {};
    };
    const streetList = (): Action[] => {
      switch (section) {
        case 'flop':
          return (streets.flop ??= []);
        case 'turn':
          return (streets.turn ??= []);
        case 'river':
          return (streets.river ??= []);
        case 'showdown':
          return showdown;
        default:
          return streets.preflop;
      }
    };
    const knownPlayer = (name: string) => players.some((p) => p.name === name);
    const collectTargets: { player: string; amount: number; source: string }[] = [];

    for (const line of lines) {
      if (line.trim() === '') continue;

      /* ---------- header ---------- */
      if (section === 'header' && !handNumber) {
        const h = line.match(RE_HEADER_START);
        if (!h) {
          warnings.push(`Unrecognised header: ${line}`);
          continue;
        }
        handNumber = h[1];
        const rest = h[2].trim();
        const t = rest.match(RE_TOURNEY);
        if (t) {
          gameType = 'tournament';
          currency = 'chips';
          tournament = { id: t[1], ...(t[5] ? { level: t[5] } : {}), ...parseBuyIn(t[2]) };
          variant = variantOf(t[3]);
          limit = limitOf(t[4]);
          blinds = { sb: money(t[6]), bb: money(t[7]) };
          timestamp = parseTimestamp(t[8]);
          continue;
        }
        const c = rest.match(RE_CASH);
        if (c) {
          gameType = 'cash';
          variant = variantOf(c[1]);
          limit = limitOf(c[2]);
          const stakes = c[3];
          currency = currencyFromSymbolOrCode(stakes);
          const parts = stakes
            .replace(/\s*(USD|EUR|GBP|CAD|BRL|RUB|CNY)\s*$/, '')
            .split('/')
            .map((p) => money(p));
          blinds = { sb: parts[0] ?? 0, bb: parts[1] ?? 0 };
          if (parts.length > 2 && parts[2] > 0) blinds.ante = parts[2];
          timestamp = parseTimestamp(c[4]);
          continue;
        }
        warnings.push(`Unrecognised game description: ${rest}`);
        continue;
      }

      /* ---------- section markers ---------- */
      const st = line.match(RE_STREET);
      if (st) {
        const name = st[1];
        const cardsText = st[2] ?? '';
        switch (name) {
          case 'HOLE CARDS':
            section = 'preflop';
            break;
          case 'FLOP':
            section = 'flop';
            streets.flop ??= [];
            board = parseCards(cardsText);
            resetCommitted();
            break;
          case 'TURN':
            section = 'turn';
            streets.turn ??= [];
            board = parseCards(cardsText);
            resetCommitted();
            break;
          case 'RIVER':
            section = 'river';
            streets.river ??= [];
            board = parseCards(cardsText);
            resetCommitted();
            break;
          case 'SHOW DOWN':
            section = 'showdown';
            break;
          case 'SUMMARY':
            section = 'summary';
            break;
          default:
            // Run-it-twice markers
            if (!runItTwice) {
              runItTwice = true;
              warnings.push('Run It Twice detected: only the first board is replayed');
            }
            if (name === 'FIRST FLOP') {
              section = 'flop';
              streets.flop ??= [];
              board = parseCards(cardsText);
              resetCommitted();
            } else if (name === 'FIRST TURN') {
              section = 'turn';
              streets.turn ??= [];
              board = parseCards(cardsText);
              resetCommitted();
            } else if (name === 'FIRST RIVER') {
              section = 'river';
              streets.river ??= [];
              board = parseCards(cardsText);
              resetCommitted();
            } else if (name === 'FIRST SHOW DOWN') {
              section = 'showdown';
            } else {
              // SECOND *: ignore the second run entirely.
              section = 'summary';
            }
            break;
        }
        continue;
      }

      /* ---------- summary ---------- */
      if (section === 'summary') {
        const tp = line.match(RE_TOTAL_POT);
        if (tp) {
          summary.totalPot = money(tp[1]);
          summary.rake = money(tp[4]);
          if (tp[2]) {
            summary.pots.push({ kind: 'main', amount: money(tp[2]), winners: [] });
            const sides = tp[3] ?? '';
            let sm: RegExpExecArray | null;
            RE_SIDE_POT.lastIndex = 0;
            while ((sm = RE_SIDE_POT.exec(sides))) {
              summary.pots.push({
                kind: 'side',
                index: sm[1] ? +sm[1] : 1,
                amount: money(sm[2]),
                winners: [],
              });
            }
          }
          continue;
        }
        const bd = line.match(RE_BOARD);
        if (bd) {
          if (line.startsWith('SECOND')) continue;
          const cards = parseCards(bd[1]);
          if (cards.length >= board.length) board = cards;
          continue;
        }
        const ss = line.match(RE_SUMMARY_SEAT);
        if (ss) {
          const name = ss[2];
          // Cards may come from "showed [..] and won", from "mucked [..]", or
          // from a bare "showed [..]" — the last is all Chico writes.
          const shown = ss[5] ?? ss[6] ?? ss[9];
          if (shown) {
            const cards = parseCards(shown);
            if (cards.length && !holeCards[name]) holeCards[name] = cards;
          }
          continue;
        }
        warnings.push(`Unrecognised summary line: ${line}`);
        continue;
      }

      /* ---------- header section: table, seats ---------- */
      if (section === 'header') {
        const tb = line.match(RE_TABLE);
        if (tb) {
          tableName = tb[1];
          maxSeats = +tb[2];
          buttonSeat = +tb[3];
          continue;
        }
        const seat = line.match(RE_SEAT);
        if (seat) {
          const suffix = (seat[5] ?? '').trim();
          const player: Player = {
            seat: +seat[1],
            name: seat[2],
            startingStack: money(seat[3]),
            isHero: false,
            isSittingOut: /sitting out|out of hand/.test(suffix),
          };
          if (seat[4]) player.bounty = money(seat[4]);
          players.push(player);
          continue;
        }
      }

      /* ---------- posts (before HOLE CARDS or, rarely, mid-hand) ---------- */
      const post = line.match(RE_POST);
      if (post) {
        const [, player, kind, amountText, allIn] = post;
        const amount = money(amountText);
        const isAllIn = !!allIn;
        switch (kind) {
          case 'small blind':
            posts.push(act(player, 'post-sb', line, { amount, isAllIn }));
            committed[player] = (committed[player] ?? 0) + amount;
            if (!blinds.sb) blinds.sb = amount;
            break;
          case 'big blind':
            posts.push(act(player, 'post-bb', line, { amount, isAllIn }));
            committed[player] = (committed[player] ?? 0) + amount;
            if (!blinds.bb) blinds.bb = amount;
            break;
          case 'the ante':
            posts.push(act(player, 'post-ante', line, { amount, isAllIn }));
            if (!blinds.ante || amount > blinds.ante) blinds.ante = amount;
            break;
          case 'straddle':
            posts.push(act(player, 'post-straddle', line, { amount, isAllIn }));
            committed[player] = (committed[player] ?? 0) + amount;
            blinds.straddle = amount;
            break;
          case 'dead blind':
            posts.push(act(player, 'post-dead', line, { amount, isAllIn }));
            break;
          case 'small & big blinds':
          case 'big blind & dead': {
            // Total posted; the BB part is live, the SB part is dead.
            const live = Math.min(blinds.bb || amount, amount);
            const dead = round2(amount - live);
            if (dead > 0) posts.push(act(player, 'post-dead', line, { amount: dead, isAllIn: false }));
            posts.push(act(player, 'post-bb', line, { amount: live, isAllIn }));
            committed[player] = (committed[player] ?? 0) + live;
            break;
          }
        }
        continue;
      }

      /* ---------- hole cards ---------- */
      const dealt = line.match(RE_DEALT);
      if (dealt) {
        const name = dealt[1];
        const cards = parseCards(dealt[2]);
        if (!heroName) {
          heroName = name;
          const p = players.find((x) => x.name === name);
          if (p) p.isHero = true;
        }
        if (cards.length) holeCards[name] = cards;
        continue;
      }

      /* ---------- betting actions ---------- */
      let m: RegExpMatchArray | null;
      if ((m = line.match(RE_FOLD))) {
        const a = act(m[1], 'fold', line);
        if (m[2]) {
          const cards = parseCards(m[2]);
          if (cards.length) {
            a.cards = cards;
            holeCards[m[1]] ??= cards;
          }
        }
        streetList().push(a);
        continue;
      }
      if ((m = line.match(RE_CHECK))) {
        streetList().push(act(m[1], 'check', line));
        continue;
      }
      if ((m = line.match(RE_CALL))) {
        const amount = money(m[2]);
        committed[m[1]] = (committed[m[1]] ?? 0) + amount;
        streetList().push(act(m[1], 'call', line, { amount, isAllIn: !!m[3] }));
        continue;
      }
      if ((m = line.match(RE_BET))) {
        const amount = money(m[2]);
        committed[m[1]] = (committed[m[1]] ?? 0) + amount;
        streetList().push(act(m[1], 'bet', line, { amount, isAllIn: !!m[3] }));
        continue;
      }
      if ((m = line.match(RE_RAISE))) {
        const toAmount = money(m[3]);
        const already = committed[m[1]] ?? 0;
        const amount = round2(Math.max(0, toAmount - already));
        committed[m[1]] = toAmount;
        streetList().push(act(m[1], 'raise', line, { amount, toAmount, isAllIn: !!m[4] }));
        continue;
      }
      if ((m = line.match(RE_UNCALLED))) {
        const amount = money(m[1]);
        committed[m[2]] = Math.max(0, (committed[m[2]] ?? 0) - amount);
        streetList().push(act(m[2], 'uncalled-return', line, { amount }));
        continue;
      }
      if ((m = line.match(RE_COLLECT))) {
        const amount = money(m[2]);
        streetList().push(act(m[1], 'collect', line, { amount, detail: m[3] }));
        collectTargets.push({ player: m[1], amount, source: m[3] });
        continue;
      }
      if ((m = line.match(RE_SHOWS))) {
        const cards = parseCards(m[2]);
        holeCards[m[1]] = cards;
        streetList().push(act(m[1], 'show', line, { cards, detail: m[3] }));
        continue;
      }
      if ((m = line.match(RE_MUCKS)) || (m = line.match(RE_NOSHOW))) {
        streetList().push(act(m[1], 'muck', line));
        continue;
      }

      /* ---------- informational events ---------- */
      if ((m = line.match(RE_TIMEOUT))) {
        events.push(act(m[1], 'timeout', line));
        continue;
      }
      if ((m = line.match(RE_DISCONNECT))) {
        events.push(act(m[1], 'disconnect', line, { detail: m[2] }));
        continue;
      }
      if ((m = line.match(RE_FINISHED))) {
        events.push(
          act(m[1], 'info', line, {
            detail: m[3] ? `finished:${m[2]}:${m[3]}` : `finished:${m[2]}`,
          }),
        );
        continue;
      }
      if ((m = line.match(RE_BOUNTY_INFO))) {
        events.push(
          act(m[1], 'info', line, { detail: `bounty:${m[2]}:${m[3]}`, amount: money(m[2]) }),
        );
        continue;
      }
      if (RE_INFO_LINES.some((re) => re.test(line))) {
        const who = players.map((p) => p.name).find((n) => line.startsWith(n)) ?? '';
        events.push(act(knownPlayer(who) ? who : '', 'info', line));
        continue;
      }

      warnings.push(`Unrecognised line: ${line}`);
    }

    /* ---------- assemble pots ---------- */
    if (summary.pots.length === 0) {
      // Some rooms — Chico among them — print "Total pot N | Rake N" with no
      // breakdown, and name the pots only on the lines that pay them out. When
      // one of those names a side pot, the split is real and worth keeping.
      const sources = [...new Set(collectTargets.map((c) => c.source))];
      const sideIndexes = sources
        .filter((s) => s.startsWith('side pot'))
        .map((s) => (s.includes('-') ? +s.split('-')[1] : 1));

      if (sideIndexes.length > 0) {
        const sum = (match: (source: string) => boolean) =>
          collectTargets.filter((c) => match(c.source)).reduce((total, c) => total + c.amount, 0);
        summary.pots.push({ kind: 'main', amount: round2(sum((src) => src === 'main pot' || src === 'pot')), winners: [] });
        for (const index of [...new Set(sideIndexes)].sort((a, b) => a - b)) {
          summary.pots.push({
            kind: 'side',
            index,
            amount: round2(sum((src) => src.startsWith('side pot') && (src.includes('-') ? +src.split('-')[1] : 1) === index)),
            winners: [],
          });
        }
      } else {
        summary.pots.push({
          kind: 'total',
          amount: summary.totalPot || collectTargets.reduce((s, c) => s + c.amount, 0),
          winners: [],
        });
      }
    }
    for (const c of collectTargets) {
      let pot: Pot | undefined;
      if (c.source === 'main pot') pot = summary.pots.find((p) => p.kind === 'main');
      else if (c.source.startsWith('side pot')) {
        const idx = c.source.includes('-') ? +c.source.split('-')[1] : 1;
        pot = summary.pots.find((p) => p.kind === 'side' && p.index === idx);
      }
      pot ??= summary.pots[0];
      pot.winners.push({ player: c.player, amount: c.amount });
    }

    if (!handNumber) warnings.push('Missing hand number');
    if (players.length === 0) warnings.push('No seats found');
    if (Number.isNaN(timestamp.getTime())) warnings.push('Could not parse timestamp');

    return {
      handNumber,
      site: 'pokerstars',
      gameType,
      variant,
      limit,
      currency,
      tournament,
      blinds,
      tableName,
      maxSeats,
      buttonSeat,
      timestamp,
      players,
      heroName,
      streets,
      posts,
      board,
      holeCards,
      showdown,
      events,
      summary,
      raw,
      warnings,
    };
  }
}

export const pokerStarsParser = new PokerStarsParser();
