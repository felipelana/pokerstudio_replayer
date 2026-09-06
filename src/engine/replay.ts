import type { Action, Hand, HandResult, Street } from '@/model/types';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface PlayerState {
  name: string;
  seat: number;
  stack: number;
  /** Chips in front of the player for the current street (pending bet). */
  streetBet: number;
  /** Total chips put into the pot this hand (incl. antes and dead blinds). */
  invested: number;
  folded: boolean;
  allIn: boolean;
  /** Dealt into this hand (false for "out of hand" players). */
  inHand: boolean;
  /** Hole cards have been dealt at this frame (false before the deal-hole frame). */
  dealt: boolean;
  sittingOut: boolean;
  /** Cards visible at this frame (undefined = unknown / face down). */
  cards?: string[];
  /** Whether the cards were revealed publicly at this point (show/summary). */
  revealed: boolean;
  lastAction?: Action['type'];
  /** Amount collected from the pot in this hand so far. */
  collected: number;
}

export type FrameKind =
  | 'start'
  | 'post'
  | 'deal-hole'
  | 'deal-street'
  | 'action'
  | 'uncalled'
  | 'show'
  | 'muck'
  | 'collect'
  | 'event'
  | 'end';

export type FrameStreet = Street | 'showdown' | 'end';

export interface PotView {
  kind: 'main' | 'side';
  index: number;
  amount: number;
  eligible: string[];
}

export interface Frame {
  index: number;
  kind: FrameKind;
  street: FrameStreet;
  board: string[];
  /** Chips already swept into the middle (previous streets + antes). */
  pot: number;
  /** pot + every pending street bet. What the "Pot:" label shows. */
  totalPot: number;
  players: PlayerState[];
  action?: Action;
  /** Player who acts next (the subject of the *next* betting action). */
  actingPlayer?: string;
  /** Highest pending street bet at this point. */
  currentBet: number;
  /** Main/side pots when at least one player is all-in. */
  pots: PotView[];
}

export interface PotOdds {
  toCall: number;
  potAfterCall: number;
  /** "2.3" in "2.3:1" */
  ratio: number;
  /** Break-even equity, 0..1 */
  breakEven: number;
}

export interface HandReplay {
  hand: Hand;
  frames: Frame[];
  /** Index of the "deal" frame for each street (undefined if the street never came). */
  streetStart: Partial<Record<FrameStreet, number>>;
  /** Frame index right before the hero's first voluntary action. */
  heroFirstAction?: number;
  heroResult?: HandResult;
  heroNet?: number;
  heroVpip: boolean;
  warnings: string[];
}

const BETTING: Action['type'][] = ['fold', 'check', 'call', 'bet', 'raise'];
const EPS = 1e-6;
/** Round to micro-chips so repeated cent arithmetic never drifts. */
function fix(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/* ------------------------------------------------------------------ */
/* Pure reducer                                                        */
/* ------------------------------------------------------------------ */

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({ ...p, cards: p.cards ? [...p.cards] : undefined }));
}

function find(players: PlayerState[], name: string): PlayerState | undefined {
  return players.find((p) => p.name === name);
}

/** Move all pending street bets into the middle. */
export function sweepBets(players: PlayerState[], pot: number): number {
  let total = pot;
  for (const p of players) {
    total += p.streetBet;
    p.streetBet = 0;
  }
  return total;
}

/**
 * Apply one action to (players, pot). Mutates the given clones and returns the
 * new pot. Never throws: inconsistent input yields a warning via the callback.
 */
export function applyAction(
  players: PlayerState[],
  pot: number,
  action: Action,
  warn: (msg: string) => void,
): number {
  const p = find(players, action.player);
  if (!p && action.type !== 'info') {
    warn(`Action by unknown player "${action.player}": ${action.raw}`);
    return pot;
  }
  if (!p) return pot;
  p.lastAction = action.type;
  const put = (amount: number, toStreet: boolean) => {
    // Cash amounts are cents; tolerate float noise before declaring a short stack.
    const real = amount - p.stack > EPS ? p.stack : amount;
    if (real < amount) warn(`${p.name} put ${amount} with only ${p.stack} behind: ${action.raw}`);
    p.stack = fix(p.stack - real);
    p.invested = fix(p.invested + real);
    if (toStreet) p.streetBet = fix(p.streetBet + real);
    else pot = fix(pot + real);
    if (p.stack <= EPS) {
      p.stack = 0;
      p.allIn = true;
    }
  };
  switch (action.type) {
    case 'post-ante':
    case 'post-dead':
      put(action.amount ?? 0, false);
      break;
    case 'post-sb':
    case 'post-bb':
    case 'post-straddle':
      put(action.amount ?? 0, true);
      break;
    case 'call':
    case 'bet':
    case 'raise':
      put(action.amount ?? 0, true);
      if (action.isAllIn) p.allIn = true;
      break;
    case 'check':
      break;
    case 'fold':
      p.folded = true;
      break;
    case 'uncalled-return': {
      const amount = action.amount ?? 0;
      if (p.streetBet >= amount) {
        p.streetBet -= amount;
      } else {
        // Bet already swept (site ordering quirk): take it from the pot instead.
        const fromStreet = p.streetBet;
        p.streetBet = 0;
        pot -= amount - fromStreet;
      }
      p.stack += amount;
      p.invested -= amount;
      if (p.stack > 0) p.allIn = false;
      break;
    }
    case 'collect': {
      const amount = action.amount ?? 0;
      pot = sweepBets(players, pot);
      pot -= amount;
      p.stack += amount;
      p.collected += amount;
      if (pot < -1e-6) warn(`Pot went negative after ${action.raw}`);
      break;
    }
    case 'show':
      if (action.cards?.length) p.cards = [...action.cards];
      p.revealed = true;
      break;
    case 'muck':
      break;
    default:
      break;
  }
  return pot;
}

/* ------------------------------------------------------------------ */
/* Side pots                                                           */
/* ------------------------------------------------------------------ */

/**
 * Main/side pot breakdown from per-player investment. Only meaningful when at
 * least one player is all-in; returns [] otherwise. Folded players' chips are
 * included in the pot they were contributing to but they are never eligible.
 */
export function computePots(players: PlayerState[]): PotView[] {
  const inHand = players.filter((p) => p.inHand && p.invested > 0);
  const anyAllIn = inHand.some((p) => p.allIn && !p.folded);
  if (!anyAllIn) return [];
  const levels = Array.from(
    new Set(inHand.filter((p) => !p.folded && p.allIn).map((p) => p.invested)),
  ).sort((a, b) => a - b);
  const maxInvested = Math.max(...inHand.map((p) => p.invested));
  if (levels[levels.length - 1] !== maxInvested) levels.push(maxInvested);
  const pots: PotView[] = [];
  let prev = 0;
  levels.forEach((level, i) => {
    let amount = 0;
    for (const p of inHand) amount += Math.max(0, Math.min(p.invested, level) - prev);
    const eligible = inHand.filter((p) => !p.folded && p.invested >= level).map((p) => p.name);
    if (amount > 0) pots.push({ kind: i === 0 ? 'main' : 'side', index: i, amount, eligible });
    prev = level;
  });
  // Merge trailing pots with a single eligible player into the previous one is
  // not done: PokerStars reports them separately ("returned" uncalled instead).
  return pots;
}

/* ------------------------------------------------------------------ */
/* Frame builder                                                       */
/* ------------------------------------------------------------------ */

export function buildReplay(hand: Hand, heroOverride?: string): HandReplay {
  const warnings: string[] = [];
  const heroName = heroOverride ?? hand.heroName;

  const initial: PlayerState[] = hand.players.map((p) => ({
    name: p.name,
    seat: p.seat,
    stack: p.startingStack,
    streetBet: 0,
    invested: 0,
    folded: false,
    allIn: false,
    inHand: true,
    dealt: false,
    sittingOut: p.isSittingOut,
    cards: undefined,
    revealed: false,
    collected: 0,
  }));

  // Players who never post nor act while sitting out are treated as out of hand.
  const participants = new Set<string>();
  for (const a of hand.posts) participants.add(a.player);
  for (const s of Object.values(hand.streets)) for (const a of s ?? []) participants.add(a.player);
  for (const p of initial) if (p.sittingOut && !participants.has(p.name)) p.inHand = false;

  const frames: Frame[] = [];
  const streetStart: HandReplay['streetStart'] = {};
  let players = initial;
  let pot = 0;
  let street: FrameStreet = 'preflop';
  let board: string[] = [];

  // The sequence of every action in order, so we can look ahead for actingPlayer.
  type Step =
    | { kind: 'post'; action: Action }
    | { kind: 'deal-hole' }
    | { kind: 'deal-street'; street: Street }
    | { kind: 'action'; action: Action; street: Street }
    | { kind: 'showdown-start' }
    | { kind: 'showdown'; action: Action };
  const steps: Step[] = [];
  for (const a of hand.posts) steps.push({ kind: 'post', action: a });
  steps.push({ kind: 'deal-hole' });
  for (const a of hand.streets.preflop) steps.push({ kind: 'action', action: a, street: 'preflop' });
  for (const s of ['flop', 'turn', 'river'] as const) {
    const list = hand.streets[s];
    if (!list) continue;
    steps.push({ kind: 'deal-street', street: s });
    for (const a of list) steps.push({ kind: 'action', action: a, street: s });
  }
  if (hand.showdown.length) {
    steps.push({ kind: 'showdown-start' });
    for (const a of hand.showdown) steps.push({ kind: 'showdown', action: a });
  }

  const nextActor = (from: number): string | undefined => {
    for (let i = from; i < steps.length; i++) {
      const s = steps[i];
      if (s.kind === 'deal-street' || s.kind === 'showdown-start') return undefined;
      if (s.kind === 'action' && BETTING.includes(s.action.type)) return s.action.player;
    }
    return undefined;
  };

  const push = (kind: FrameKind, action?: Action, stepIndex = -1) => {
    const snapshot = clonePlayers(players);
    const totalPot = pot + snapshot.reduce((s, p) => s + p.streetBet, 0);
    frames.push({
      index: frames.length,
      kind,
      street,
      board: [...board],
      pot,
      totalPot,
      players: snapshot,
      action,
      actingPlayer: nextActor(stepIndex + 1),
      currentBet: Math.max(0, ...snapshot.map((p) => p.streetBet)),
      pots: computePots(snapshot),
    });
  };

  const frameKindFor = (a: Action): FrameKind => {
    switch (a.type) {
      case 'uncalled-return':
        return 'uncalled';
      case 'show':
        return 'show';
      case 'muck':
        return 'muck';
      case 'collect':
        return 'collect';
      case 'info':
      case 'timeout':
      case 'disconnect':
        return 'event';
      default:
        return 'action';
    }
  };

  push('start', undefined, -1);
  streetStart.preflop = 0;

  let heroFirstAction: number | undefined;
  let heroVpip = false;

  steps.forEach((step, i) => {
    players = clonePlayers(players);
    switch (step.kind) {
      case 'post':
        pot = applyAction(players, pot, step.action, (m) => warnings.push(m));
        push('post', step.action, i);
        break;
      case 'deal-hole':
        for (const p of players) {
          if (p.inHand) p.dealt = true;
          const known = hand.holeCards[p.name];
          if (p.inHand && known && (p.name === heroName || hand.heroName === p.name)) {
            p.cards = [...known];
          }
        }
        push('deal-hole', undefined, i);
        break;
      case 'deal-street':
        pot = sweepBets(players, pot);
        street = step.street;
        board = hand.board.slice(0, step.street === 'flop' ? 3 : step.street === 'turn' ? 4 : 5);
        streetStart[street] = frames.length;
        push('deal-street', undefined, i);
        break;
      case 'action': {
        const a = step.action;
        if (
          heroName &&
          a.player === heroName &&
          heroFirstAction === undefined &&
          BETTING.includes(a.type)
        ) {
          heroFirstAction = frames.length - 1;
        }
        if (heroName && a.player === heroName && ['call', 'bet', 'raise'].includes(a.type)) {
          heroVpip = true;
        }
        pot = applyAction(players, pot, a, (m) => warnings.push(m));
        push(frameKindFor(a), a, i);
        break;
      }
      case 'showdown-start':
        pot = sweepBets(players, pot);
        street = 'showdown';
        board = [...hand.board];
        streetStart.showdown = frames.length;
        push('deal-street', undefined, i);
        break;
      case 'showdown':
        pot = applyAction(players, pot, step.action, (m) => warnings.push(m));
        push(frameKindFor(step.action), step.action, i);
        break;
    }
  });

  // Final frame: reveal every card known from the summary, drop the rake.
  players = clonePlayers(players);
  pot = sweepBets(players, pot);
  for (const p of players) {
    const known = hand.holeCards[p.name];
    if (known && !p.cards) p.cards = [...known];
    if (known) p.revealed = p.revealed || p.name !== heroName;
  }
  const leftover = pot;
  if (Math.abs(leftover - hand.summary.rake) > 0.011 && hand.summary.totalPot > 0) {
    warnings.push(
      `Pot leftover ${leftover.toFixed(2)} does not match rake ${hand.summary.rake.toFixed(2)}`,
    );
  }
  pot = 0;
  street = 'end';
  streetStart.end = frames.length;
  push('end', undefined, steps.length);

  // Validation: stacks conserve chips (minus rake).
  const startSum = hand.players.reduce((s, p) => s + p.startingStack, 0);
  const endSum = players.reduce((s, p) => s + p.stack, 0);
  const diff = startSum - endSum - hand.summary.rake;
  if (Math.abs(diff) > 0.011) {
    warnings.push(`Chip conservation off by ${diff.toFixed(2)} (start ${startSum}, end ${endSum}, rake ${hand.summary.rake})`);
  }

  // Hero result
  let heroResult: HandResult | undefined;
  let heroNet: number | undefined;
  if (heroName) {
    const start = hand.players.find((p) => p.name === heroName)?.startingStack;
    const end = players.find((p) => p.name === heroName)?.stack;
    if (start !== undefined && end !== undefined) {
      heroNet = end - start;
      const heroState = players.find((p) => p.name === heroName)!;
      heroResult = classify(heroState, heroNet, heroVpip);
    }
  }

  return {
    hand,
    frames,
    streetStart,
    heroFirstAction,
    heroResult,
    heroNet,
    heroVpip,
    warnings: [...hand.warnings, ...warnings],
  };
}

/**
 * Result colour: green = profit, red = lost chips, grey = folded without
 * voluntarily investing, yellow = got chips back without profit (split pot,
 * chop, or a split that only lost the rake).
 */
export function classify(hero: PlayerState, net: number, vpip: boolean): HandResult {
  if (hero.folded && !vpip) return 'folded';
  if (net > 0.005) return 'won';
  if (hero.collected > 0) return 'break-even';
  if (net < -0.005) return 'lost';
  return 'break-even';
}

/* ------------------------------------------------------------------ */
/* Pot odds                                                            */
/* ------------------------------------------------------------------ */

/** Pot odds faced by `player` at this frame, or undefined if not facing a bet. */
export function potOddsFor(frame: Frame, player: string | undefined): PotOdds | undefined {
  if (!player || frame.actingPlayer !== player) return undefined;
  const p = frame.players.find((x) => x.name === player);
  if (!p || p.folded || p.allIn) return undefined;
  const toCall = Math.min(Math.max(0, frame.currentBet - p.streetBet), p.stack);
  if (toCall <= 0) return undefined;
  const potAfterCall = frame.totalPot;
  return {
    toCall,
    potAfterCall,
    ratio: potAfterCall / toCall,
    breakEven: toCall / (potAfterCall + toCall),
  };
}

/** Players still contesting the pot at this frame. */
export function activePlayers(frame: Frame): PlayerState[] {
  return frame.players.filter((p) => p.inHand && !p.folded);
}

/* ------------------------------------------------------------------ */
/* Lightweight per-hand summary (hand list / timeline)                 */
/* ------------------------------------------------------------------ */

export interface HandMeta {
  heroName?: string;
  heroCards?: string[];
  result?: HandResult;
  net?: number;
  vpip: boolean;
}

/** Same reducer as buildReplay but without frame snapshots — cheap for thousands of hands. */
export function quickResult(hand: Hand, heroOverride?: string): HandMeta {
  const heroName = heroOverride ?? hand.heroName;
  if (!heroName || !hand.players.some((p) => p.name === heroName)) {
    return { vpip: false };
  }
  const players: PlayerState[] = hand.players.map((p) => ({
    name: p.name,
    seat: p.seat,
    stack: p.startingStack,
    streetBet: 0,
    invested: 0,
    folded: false,
    allIn: false,
    inHand: true,
    dealt: false,
    sittingOut: p.isSittingOut,
    revealed: false,
    collected: 0,
  }));
  let pot = 0;
  const noop = () => {};
  let vpip = false;
  for (const a of hand.posts) pot = applyAction(players, pot, a, noop);
  for (const s of ['preflop', 'flop', 'turn', 'river'] as const) {
    const list = hand.streets[s];
    if (!list) continue;
    pot = sweepBets(players, pot);
    for (const a of list) {
      if (a.player === heroName && ['call', 'bet', 'raise'].includes(a.type)) vipTrue();
      pot = applyAction(players, pot, a, noop);
    }
  }
  pot = sweepBets(players, pot);
  for (const a of hand.showdown) pot = applyAction(players, pot, a, noop);
  function vipTrue() {
    vpip = true;
  }
  const hero = players.find((p) => p.name === heroName)!;
  const start = hand.players.find((p) => p.name === heroName)!.startingStack;
  const net = hero.stack - start;
  const result = classify(hero, net, vpip);
  return { heroName, heroCards: hand.holeCards[heroName], result, net, vpip };
}
