/**
 * Generates samples/pokerstars-demo.txt — synthetic PokerStars hands WITH
 * `Dealt to Hero`, covering the scenarios the replayer must handle.
 * Run: node scripts/gen-sample.ts   (Node >= 22.6 with type stripping)
 *
 * The mini-simulator computes every amount, uncalled return, pot and winner
 * so the sample is chip-exact; showdown winners come from the real evaluator.
 */
import { writeFileSync } from 'node:fs';
import { evaluate } from '../src/equity/evaluator.ts';
import { cardIndex } from '../src/model/cards.ts';

type Act = ['fold'] | ['check'] | ['call'] | ['bet', number] | ['raise', number] /* raise TO */ | ['allin'];

interface Seat {
  name: string;
  stack: number;
  cards?: string[];
}

interface Script {
  handNo: string;
  time: string;
  button: number;
  seats: Record<number, Seat>;
  hero: string;
  board: string[];
  preflop: [string, Act][];
  flop?: [string, Act][];
  turn?: [string, Act][];
  river?: [string, Act][];
  extra?: string[];
  ante?: number;
  sb: number;
  bb: number;
  tournament?: boolean;
  tableName: string;
  maxSeats: number;
  level?: string;
}

function money(v: number, cash: boolean): string {
  return cash ? `$${v.toFixed(2)}` : String(Math.round(v));
}

function r2(v: number) {
  return Math.round(v * 100) / 100;
}

function nameOfRank(score: number): string {
  const cat = score >> 20;
  const r = (score >> 16) & 0xf;
  const R = ['Deuces', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'];
  const H = ['Deuce', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
  switch (cat) {
    case 0:
      return `high card ${H[r]}`;
    case 1:
      return `a pair of ${R[r]}`;
    case 2:
      return `two pair, ${R[r]} and ${R[(score >> 12) & 0xf]}`;
    case 3:
      return `three of a kind, ${R[r]}`;
    case 4:
      return `a straight, ${H[r === 3 ? 12 : r - 4]} to ${H[r]}`;
    case 5:
      return `a flush, ${H[r]} high`;
    case 6:
      return `a full house, ${R[r]} full of ${R[(score >> 12) & 0xf]}`;
    case 7:
      return `four of a kind, ${R[r]}`;
    default:
      return `a straight flush, ${H[r === 3 ? 12 : r - 4]} to ${H[r]}`;
  }
}

function foldStreet(s: Script, name: string): string {
  const streets: [string, [string, Act][] | undefined][] = [
    ['preflop', s.preflop],
    ['Flop', s.flop],
    ['Turn', s.turn],
    ['River', s.river],
  ];
  for (const [label, acts] of streets) {
    if (acts?.some(([n, a]) => n === name && a[0] === 'fold')) return label;
  }
  return 'preflop';
}

function generate(s: Script): string {
  const cash = !s.tournament;
  const L: string[] = [];
  const m = (v: number) => money(v, cash);
  const seatNos = Object.keys(s.seats)
    .map(Number)
    .sort((a, b) => a - b);
  const stacks: Record<string, number> = {};
  const invested: Record<string, number> = {};
  const folded = new Set<string>();
  const allIn = new Set<string>();
  for (const n of seatNos) {
    stacks[s.seats[n].name] = s.seats[n].stack;
    invested[s.seats[n].name] = 0;
  }
  const bi = seatNos.indexOf(s.button);
  const order = seatNos.slice(bi).concat(seatNos.slice(0, bi));
  const names = order.map((n) => s.seats[n].name);
  const sbName = names.length === 2 ? names[0] : names[1];
  const bbName = names.length === 2 ? names[1] : names[2];
  const seatOf = (n: string) => seatNos.find((k) => s.seats[k].name === n)!;

  const header = s.tournament
    ? `PokerStars Hand #${s.handNo}: Tournament #4100200300, $0.98+$0.12 USD Hold'em No Limit - Level ${s.level ?? 'V'} (${s.sb}/${s.bb}) - ${s.time} ET`
    : `PokerStars Hand #${s.handNo}:  Hold'em No Limit ($0.05/$0.10 USD) - ${s.time} ET`;
  L.push(header);
  L.push(`Table '${s.tableName}' ${s.maxSeats}-max Seat #${s.button} is the button`);
  for (const n of seatNos) L.push(`Seat ${n}: ${s.seats[n].name} (${m(s.seats[n].stack)} in chips)`);

  let pot = 0;
  const put = (name: string, amt: number) => {
    const real = r2(Math.min(amt, stacks[name]));
    stacks[name] = r2(stacks[name] - real);
    invested[name] = r2(invested[name] + real);
    pot = r2(pot + real);
    if (stacks[name] === 0) allIn.add(name);
    return real;
  };
  if (s.ante) for (const n of names) L.push(`${n}: posts the ante ${m(put(n, s.ante))}`);
  const sbPut = put(sbName, s.sb);
  L.push(`${sbName}: posts small blind ${m(sbPut)}${allIn.has(sbName) ? ' and is all-in' : ''}`);
  const bbPut = put(bbName, s.bb);
  L.push(`${bbName}: posts big blind ${m(bbPut)}${allIn.has(bbName) ? ' and is all-in' : ''}`);
  L.push('*** HOLE CARDS ***');
  L.push(`Dealt to ${s.hero} [${s.seats[seatOf(s.hero)].cards!.join(' ')}]`);

  let streetBets: Record<string, number> = {};
  streetBets[sbName] = sbPut;
  streetBets[bbName] = bbPut;
  let lastAggressor: string | undefined = bbName;

  const runStreet = (acts: [string, Act][]) => {
    for (const [name, act] of acts) {
      const cur = Math.max(0, ...Object.values(streetBets));
      const mine = streetBets[name] ?? 0;
      switch (act[0]) {
        case 'fold':
          folded.add(name);
          L.push(`${name}: folds`);
          break;
        case 'check':
          L.push(`${name}: checks`);
          break;
        case 'call': {
          const need = r2(Math.min(cur - mine, stacks[name]));
          put(name, need);
          streetBets[name] = r2(mine + need);
          L.push(`${name}: calls ${m(need)}${allIn.has(name) ? ' and is all-in' : ''}`);
          break;
        }
        case 'bet': {
          const amt = r2(Math.min(act[1], stacks[name]));
          put(name, amt);
          streetBets[name] = r2(mine + amt);
          lastAggressor = name;
          L.push(`${name}: bets ${m(amt)}${allIn.has(name) ? ' and is all-in' : ''}`);
          break;
        }
        case 'raise': {
          const to = r2(Math.min(act[1], mine + stacks[name]));
          put(name, r2(to - mine));
          streetBets[name] = to;
          lastAggressor = name;
          L.push(`${name}: raises ${m(r2(to - cur))} to ${m(to)}${allIn.has(name) ? ' and is all-in' : ''}`);
          break;
        }
        case 'allin': {
          const to = r2(mine + stacks[name]);
          put(name, stacks[name]);
          streetBets[name] = to;
          if (to > cur) {
            lastAggressor = name;
            L.push(cur > 0 ? `${name}: raises ${m(r2(to - cur))} to ${m(to)} and is all-in` : `${name}: bets ${m(to)} and is all-in`);
          } else {
            L.push(`${name}: calls ${m(r2(to - mine))} and is all-in`);
          }
          break;
        }
      }
    }
    const active = names.filter((n) => !folded.has(n));
    const cur = Math.max(0, ...Object.values(streetBets));
    const top = Object.entries(streetBets).filter(([n, v]) => v === cur && !folded.has(n));
    if (top.length === 1 && cur > 0) {
      const [name] = top[0];
      const second = Math.max(0, ...Object.entries(streetBets).filter(([n]) => n !== name).map(([, v]) => v));
      const back = r2(cur - second);
      if (back > 0) {
        stacks[name] = r2(stacks[name] + back);
        invested[name] = r2(invested[name] - back);
        pot = r2(pot - back);
        if (stacks[name] > 0) allIn.delete(name);
        L.push(`Uncalled bet (${m(back)}) returned to ${name}`);
      }
    }
    streetBets = {};
    return active;
  };

  let active = runStreet(s.preflop);
  const streets: [string, [string, Act][] | undefined, number][] = [
    ['FLOP', s.flop, 3],
    ['TURN', s.turn, 4],
    ['RIVER', s.river, 5],
  ];
  let boardShown = 0;
  const everyoneAllIn = () => active.filter((n) => !allIn.has(n)).length <= 1;
  for (const [label, acts, count] of streets) {
    if (active.length < 2) break;
    if (!acts && !everyoneAllIn()) break;
    const cards = s.board.slice(0, count);
    if (label === 'FLOP') L.push(`*** FLOP *** [${cards.join(' ')}]`);
    else L.push(`*** ${label} *** [${s.board.slice(0, count - 1).join(' ')}] [${cards[count - 1]}]`);
    boardShown = count;
    if (acts && !everyoneAllIn()) active = runStreet(acts);
  }

  const rake = cash ? r2(Math.min(pot * 0.045, 3)) : 0;
  const posTag = (n: string) => {
    const tags: string[] = [];
    if (s.seats[s.button].name === n) tags.push('(button)');
    if (n === sbName) tags.push('(small blind)');
    if (n === bbName) tags.push('(big blind)');
    return tags.length ? ' ' + tags.join(' ') : '';
  };
  const winnersDesc: Record<string, string> = {};
  let totalLine = `Total pot ${m(pot)} | Rake ${m(rake)}`;

  if (active.length === 1) {
    const w = active[0];
    const collected = r2(pot - rake);
    L.push(`${w} collected ${m(collected)} from pot`);
    L.push(`${w}: doesn't show hand`);
    stacks[w] = r2(stacks[w] + collected);
    winnersDesc[w] = `collected (${m(collected)})`;
  } else {
    L.push('*** SHOW DOWN ***');
    const scores: Record<string, number> = {};
    for (const n of active) {
      scores[n] = evaluate([...s.board, ...(s.seats[seatOf(n)].cards ?? [])].map(cardIndex), 7);
    }
    const ai = lastAggressor && active.includes(lastAggressor) ? active.indexOf(lastAggressor) : 0;
    const showOrder = active.slice(ai).concat(active.slice(0, ai));
    const shown: Record<string, boolean> = {};
    let bestShown = -1;
    for (const n of showOrder) {
      if (scores[n] >= bestShown || allIn.has(n)) {
        L.push(`${n}: shows [${s.seats[seatOf(n)].cards!.join(' ')}] (${nameOfRank(scores[n])})`);
        shown[n] = true;
        bestShown = Math.max(bestShown, scores[n]);
      } else {
        L.push(`${n}: mucks hand`);
      }
    }
    const levels = Array.from(new Set(active.map((n) => invested[n]))).sort((a, b) => a - b);
    const potsOut: { amount: number; winners: string[] }[] = [];
    let prev = 0;
    for (const level of levels) {
      let amount = 0;
      for (const n of names) amount = r2(amount + Math.max(0, Math.min(invested[n], level) - prev));
      const eligible = active.filter((n) => invested[n] >= level);
      const best = Math.max(...eligible.map((n) => scores[n]));
      potsOut.push({ amount, winners: eligible.filter((n) => scores[n] === best) });
      prev = level;
    }
    potsOut[0].amount = r2(potsOut[0].amount - rake);
    const multi = potsOut.length > 1;
    for (let idx = potsOut.length - 1; idx >= 0; idx--) {
      const p = potsOut[idx];
      const label = !multi ? 'pot' : idx === 0 ? 'main pot' : potsOut.length === 2 ? 'side pot' : `side pot-${idx}`;
      const share = r2(p.amount / p.winners.length);
      p.winners.forEach((w, wi) => {
        const amt = wi === 0 ? r2(p.amount - share * (p.winners.length - 1)) : share;
        L.push(`${w} collected ${m(amt)} from ${label}`);
        stacks[w] = r2(stacks[w] + amt);
      });
    }
    for (const n of active) {
      const won = r2(stacks[n] - (s.seats[seatOf(n)].stack - invested[n]));
      const cards = s.seats[seatOf(n)].cards!.join(' ');
      if (shown[n]) winnersDesc[n] = won > 0 ? `showed [${cards}] and won (${m(won)}) with ${nameOfRank(scores[n])}` : `showed [${cards}] and lost with ${nameOfRank(scores[n])}`;
      else winnersDesc[n] = `mucked [${cards}]`;
    }
    if (multi) {
      const sides = potsOut
        .slice(1)
        .map((p, i) => (potsOut.length === 2 ? `Side pot ${m(p.amount)}.` : `Side pot-${i + 1} ${m(p.amount)}.`))
        .join(' ');
      totalLine = `Total pot ${m(pot)} Main pot ${m(potsOut[0].amount)}. ${sides} | Rake ${m(rake)}`;
    }
  }
  if (s.extra) L.push(...s.extra);
  L.push('*** SUMMARY ***');
  L.push(totalLine);
  if (boardShown > 0) L.push(`Board [${s.board.slice(0, boardShown).join(' ')}]`);
  for (const n of seatNos) {
    const name = s.seats[n].name;
    let desc: string;
    if (winnersDesc[name]) desc = winnersDesc[name];
    else {
      const street = foldStreet(s, name);
      desc =
        street === 'preflop'
          ? invested[name] > (s.ante ?? 0)
            ? 'folded before Flop'
            : "folded before Flop (didn't bet)"
          : `folded on the ${street}`;
    }
    L.push(`Seat ${n}: ${name}${posTag(name)} ${desc}`);
  }
  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* Scripts                                                             */
/* ------------------------------------------------------------------ */

const T = 'Aludra II';
const base = (i: number, seats: Record<number, Seat>, button: number, rest: Partial<Script>): Script => ({
  handNo: String(245100000000 + i),
  time: `2024/03/01 ${String(20 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 10) % 60).padStart(2, '0')}:12`,
  button,
  seats,
  hero: 'Hero',
  board: [],
  preflop: [],
  sb: 0.05,
  bb: 0.1,
  tableName: T,
  maxSeats: 6,
  ...rest,
});

const H = 'Hero';
const V1 = 'villain one';
const V2 = 'José (Ñu)';
const V3 = 'Иван';
const V4 = '김철수';
const V5 = 'shark_88';
const TOUR = { tournament: true, sb: 100, bb: 200, ante: 25, level: 'VIII', tableName: '4100200300 7', maxSeats: 9 };

const scripts: Script[] = [
  // 1. Hero AK 3-bets, c-bets flop, villain folds.
  base(1, { 1: { name: V1, stack: 10.5 }, 2: { name: H, stack: 12, cards: ['Ah', 'Kd'] }, 3: { name: V2, stack: 9.85 }, 4: { name: V3, stack: 25 }, 6: { name: V4, stack: 10 } }, 2, {
    board: ['Ac', '7d', '2s', '9h', '3c'],
    preflop: [[V4, ['fold']], [V1, ['raise', 0.3]], [H, ['raise', 1]], [V2, ['fold']], [V3, ['fold']], [V1, ['call']]],
    flop: [[V1, ['check']], [H, ['bet', 1.2]], [V1, ['fold']]],
  }),
  // 2. Hero QQ short all-in, loses to quads 3-way.
  base(2, { 1: { name: V1, stack: 20.2 }, 2: { name: H, stack: 1.5, cards: ['Qc', 'Qs'] }, 3: { name: V2, stack: 9.8, cards: ['Ad', 'Kd'] }, 4: { name: V3, stack: 24.9, cards: ['5d', '5s'] }, 6: { name: V4, stack: 10 } }, 3, {
    board: ['Qd', '5h', '5c', '8d', 'Kc'],
    preflop: [[V1, ['fold']], [H, ['allin']], [V2, ['call']], [V3, ['call']], [V4, ['fold']]],
    flop: [[V3, ['check']], [V2, ['check']]],
    turn: [[V3, ['check']], [V2, ['check']]],
    river: [[V3, ['check']], [V2, ['check']]],
  }),
  // 3. Hero 72o folds in the BB to a raise (lost blinds).
  base(3, { 1: { name: V1, stack: 20.2 }, 2: { name: H, stack: 10, cards: ['2c', '7d'] }, 3: { name: V2, stack: 8.3 }, 4: { name: V3, stack: 27.8 }, 6: { name: V4, stack: 9.9 } }, 6, {
    board: ['Js', 'Jd', '4h', '2d', '9c'],
    preflop: [[V2, ['fold']], [V3, ['raise', 0.3]], [V4, ['fold']], [V1, ['call']], [H, ['fold']]],
    flop: [[V1, ['check']], [V3, ['bet', 0.4]], [V1, ['fold']]],
  }),
  // 4. Hero folds UTG without investing (grey).
  base(4, { 1: { name: V1, stack: 20 }, 2: { name: H, stack: 10, cards: ['9c', '4d'] }, 3: { name: V2, stack: 8.3 }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 9.9 } }, 4, {
    board: ['Ts', '8d', '4h', '2d', '9c'],
    preflop: [[H, ['fold']], [V2, ['raise', 0.25]], [V3, ['fold']], [V4, ['call']], [V1, ['fold']]],
    flop: [[V4, ['check']], [V2, ['bet', 0.3]], [V4, ['call']]],
    turn: [[V4, ['check']], [V2, ['check']]],
    river: [[V4, ['bet', 0.5]], [V2, ['fold']]],
  }),
  // 5. Hero gets a walk in the BB.
  base(5, { 1: { name: V1, stack: 20 }, 2: { name: H, stack: 10, cards: ['Jh', 'Th'] }, 3: { name: V2, stack: 8 }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 6, {
    preflop: [[V2, ['fold']], [V3, ['fold']], [V4, ['fold']], [V1, ['fold']]],
  }),
  // 6. Split pot: both play the board.
  base(6, { 1: { name: V1, stack: 20, cards: ['2h', '3d'] }, 2: { name: H, stack: 10.05, cards: ['4s', '5c'] }, 3: { name: V2, stack: 8 }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 4, {
    board: ['Ac', 'Kd', 'Qs', 'Jh', 'Tc'],
    preflop: [[H, ['raise', 0.3]], [V2, ['fold']], [V3, ['fold']], [V4, ['fold']], [V1, ['call']]],
    flop: [[V1, ['bet', 0.4]], [H, ['call']]],
    turn: [[V1, ['check']], [H, ['check']]],
    river: [[V1, ['bet', 1]], [H, ['call']]],
  }),
  // 7. Three-way all-in with a side pot, hero wins the main pot.
  base(7, { 1: { name: V1, stack: 6, cards: ['Ah', '4s'] }, 2: { name: H, stack: 3.2, cards: ['Ks', 'Kd'] }, 3: { name: V2, stack: 12, cards: ['Qs', 'Qd'] }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 6, {
    board: ['Kh', '4d', '4c', '8s', 'Jc'],
    preflop: [[V2, ['raise', 0.3]], [V3, ['fold']], [V4, ['fold']], [V1, ['allin']], [H, ['allin']], [V2, ['call']]],
  }),
  // 8. Hero bluffs three streets, villain check-calls with a pair — hero loses.
  base(8, { 1: { name: V1, stack: 15, cards: ['9d', '9s'] }, 2: { name: H, stack: 10, cards: ['6h', '5h'] }, 3: { name: V2, stack: 8 }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 2, {
    board: ['Kc', '7h', '2h', 'Qd', '3s'],
    preflop: [[V4, ['fold']], [V1, ['raise', 0.25]], [H, ['call']], [V2, ['fold']], [V3, ['fold']]],
    flop: [[V1, ['check']], [H, ['bet', 0.35]], [V1, ['call']]],
    turn: [[V1, ['check']], [H, ['bet', 0.9]], [V1, ['call']]],
    river: [[V1, ['check']], [H, ['bet', 2.4]], [V1, ['call']]],
  }),
  // 9. Hero flops a set, gets paid (uncalled part returned).
  base(9, { 1: { name: V1, stack: 12, cards: ['Ad', 'Qc'] }, 2: { name: H, stack: 14, cards: ['7c', '7d'] }, 3: { name: V2, stack: 8 }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 2, {
    board: ['As', '7h', '2d', 'Th', '4c'],
    preflop: [[V4, ['raise', 0.3]], [V1, ['call']], [H, ['call']], [V2, ['fold']], [V3, ['fold']]],
    flop: [[V4, ['bet', 0.5]], [V1, ['call']], [H, ['raise', 1.8]], [V4, ['fold']], [V1, ['call']]],
    turn: [[V1, ['check']], [H, ['bet', 3]], [V1, ['call']]],
    river: [[V1, ['check']], [H, ['allin']], [V1, ['call']]],
  }),
  // 10. Heads-up: hero on the button/SB wins with a flush.
  base(10, { 2: { name: H, stack: 30, cards: ['Ah', '9h'] }, 5: { name: V5, stack: 26, cards: ['Kc', 'Kd'] } }, 2, {
    board: ['2h', '7h', 'Ks', 'Th', '3c'],
    preflop: [[H, ['raise', 0.3]], [V5, ['raise', 1]], [H, ['call']]],
    flop: [[V5, ['bet', 1.2]], [H, ['call']]],
    turn: [[V5, ['bet', 3]], [H, ['raise', 8]], [V5, ['call']]],
    river: [[V5, ['check']], [H, ['bet', 6]], [V5, ['call']]],
  }),
  // 11. Tournament with antes: hero shoves 88, gets called by AQ, wins the flip.
  base(11, { 1: { name: V1, stack: 4200, cards: ['Ac', 'Qd'] }, 2: { name: H, stack: 2300, cards: ['8h', '8s'] }, 3: { name: V2, stack: 9000 }, 4: { name: V3, stack: 6100 }, 5: { name: V5, stack: 12000 }, 6: { name: V4, stack: 5000 } }, 4, {
    ...TOUR,
    board: ['9c', '4d', '2s', '8d', 'Jh'],
    preflop: [[V1, ['raise', 450]], [H, ['allin']], [V2, ['fold']], [V3, ['fold']], [V5, ['fold']], [V4, ['fold']], [V1, ['call']]],
  }),
  // 12. Tournament: hero opens AJ, BB shoves KK, hero folds.
  base(12, { 1: { name: V1, stack: 2075, cards: ['Kc', 'Kh'] }, 2: { name: H, stack: 4825, cards: ['Ad', 'Jc'] }, 3: { name: V2, stack: 8975 }, 4: { name: V3, stack: 6075 }, 5: { name: V5, stack: 11875 }, 6: { name: V4, stack: 4975 } }, 5, {
    ...TOUR,
    preflop: [[H, ['raise', 500]], [V2, ['fold']], [V3, ['fold']], [V5, ['fold']], [V4, ['fold']], [V1, ['allin']], [H, ['fold']]],
  }),
  // 13. Tournament: hero check-raises the turn from the SB and takes it down.
  base(13, { 1: { name: V1, stack: 4600, cards: ['Qs', 'Js'] }, 2: { name: H, stack: 4300, cards: ['Th', '9h'] }, 3: { name: V2, stack: 8975 }, 4: { name: V3, stack: 6075 }, 5: { name: V5, stack: 11875 }, 6: { name: V4, stack: 4975 } }, 1, {
    ...TOUR,
    level: 'IX',
    board: ['Tc', '6d', '2h', '9s', '4c'],
    preflop: [[V3, ['fold']], [V4, ['fold']], [V5, ['fold']], [V1, ['raise', 450]], [H, ['call']], [V2, ['fold']]],
    flop: [[H, ['check']], [V1, ['bet', 500]], [H, ['call']]],
    turn: [[H, ['check']], [V1, ['bet', 1200]], [H, ['raise', 3000]], [V1, ['fold']]],
  }),
  // 14. Cash: hero traps with aces, villain shoves a flush draw and misses.
  base(14, { 1: { name: V1, stack: 18, cards: ['Jd', 'Td'] }, 2: { name: H, stack: 22, cards: ['As', 'Ac'] }, 3: { name: V2, stack: 8 }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 3, {
    board: ['Ad', '9d', '3c', '2s', '7h'],
    preflop: [[V1, ['raise', 0.3]], [H, ['raise', 1]], [V2, ['fold']], [V3, ['fold']], [V4, ['fold']], [V1, ['call']]],
    flop: [[V1, ['check']], [H, ['bet', 1.2]], [V1, ['raise', 3.5]], [H, ['raise', 8]], [V1, ['allin']], [H, ['call']]],
  }),
  // 15. Cash: multiway limped pot, hero wins with top pair at showdown.
  base(15, { 1: { name: V1, stack: 20, cards: ['5c', '6c'] }, 2: { name: H, stack: 12, cards: ['Kh', '8d'] }, 3: { name: V2, stack: 8, cards: ['9h', '3h'] }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 4, {
    board: ['Kc', '4d', 'Jh', '2c', 'Qs'],
    preflop: [[H, ['call']], [V2, ['call']], [V3, ['call']], [V4, ['fold']], [V1, ['check']]],
    flop: [[V1, ['check']], [H, ['check']], [V2, ['check']], [V3, ['check']]],
    turn: [[V1, ['check']], [H, ['bet', 0.3]], [V2, ['call']], [V3, ['fold']], [V1, ['call']]],
    river: [[V1, ['check']], [H, ['check']], [V2, ['check']]],
  }),
  // 16. Cash: hero steals the blinds from the button.
  base(16, { 1: { name: V1, stack: 20 }, 2: { name: H, stack: 12.6, cards: ['3d', '3c'] }, 3: { name: V2, stack: 8 }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 2, {
    preflop: [[V4, ['fold']], [V1, ['fold']], [H, ['raise', 0.25]], [V2, ['fold']], [V3, ['fold']]],
  }),
  // 17. Cash: hero isolates a limper and value bets three streets.
  base(17, { 1: { name: V1, stack: 20, cards: ['Ks', 'Qs'] }, 2: { name: H, stack: 12.75, cards: ['Kd', 'Ad'] }, 3: { name: V2, stack: 8 }, 4: { name: V3, stack: 28 }, 6: { name: V4, stack: 10 } }, 2, {
    board: ['Kh', '5c', '2d', '9s', '6c'],
    preflop: [[V4, ['fold']], [V1, ['call']], [H, ['raise', 0.4]], [V2, ['fold']], [V3, ['fold']], [V1, ['call']]],
    flop: [[V1, ['check']], [H, ['bet', 0.5]], [V1, ['call']]],
    turn: [[V1, ['check']], [H, ['bet', 1.2]], [V1, ['call']]],
    river: [[V1, ['check']], [H, ['bet', 2.6]], [V1, ['call']]],
  }),
];

const out = scripts.map(generate).join('\n\n\n\n') + '\n';
writeFileSync(new URL('../samples/pokerstars-demo.txt', import.meta.url), out, 'utf8');
console.log(`wrote ${scripts.length} hands`);
