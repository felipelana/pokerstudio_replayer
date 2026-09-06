import type { TFunction } from 'i18next';
import type { Frame } from '@/engine/replay';
import type { Action, Hand } from '@/model/types';

/** Human-readable, translated description of a frame (built from the canonical model). */
export function describeFrame(frame: Frame, hand: Hand, t: TFunction, fmt: (v: number) => string): string {
  const a = frame.action;
  switch (frame.kind) {
    case 'start':
      return t('log.start', { number: hand.handNumber, table: hand.tableName });
    case 'deal-hole':
      return t('log.dealHole');
    case 'deal-street':
      if (frame.street === 'flop') return t('log.dealFlop', { cards: frame.board.slice(0, 3).join(' ') });
      if (frame.street === 'turn') return t('log.dealTurn', { cards: frame.board[3] ?? '' });
      if (frame.street === 'river') return t('log.dealRiver', { cards: frame.board[4] ?? '' });
      return t('log.showdown');
    case 'end':
      return t('log.end');
    default:
      return a ? describeAction(a, t, fmt) : '';
  }
}

export function describeAction(a: Action, t: TFunction, fmt: (v: number) => string): string {
  const amount = a.amount !== undefined ? fmt(a.amount) : '';
  const allIn = a.isAllIn ? t('log.allInSuffix') : '';
  const player = a.player;
  switch (a.type) {
    case 'post-sb':
      return t('log.postSb', { player, amount }) + allIn;
    case 'post-bb':
      return t('log.postBb', { player, amount }) + allIn;
    case 'post-ante':
      return t('log.postAnte', { player, amount }) + allIn;
    case 'post-dead':
      return t('log.postDead', { player, amount });
    case 'post-straddle':
      return t('log.postStraddle', { player, amount }) + allIn;
    case 'fold':
      return t('log.fold', { player });
    case 'check':
      return t('log.check', { player });
    case 'call':
      return t('log.call', { player, amount }) + allIn;
    case 'bet':
      return t('log.bet', { player, amount }) + allIn;
    case 'raise':
      return t('log.raise', { player, amount: fmt(a.toAmount ?? a.amount ?? 0) }) + allIn;
    case 'uncalled-return':
      return t('log.uncalled', { player, amount });
    case 'collect': {
      const src = a.detail ?? 'pot';
      if (src === 'pot') return t('log.collect', { player, amount });
      const pot =
        src === 'main pot'
          ? t('log.mainPot')
          : t('log.sidePot', { index: src.includes('-') ? src.split('-')[1] : '1' });
      return t('log.collectFrom', { player, amount, pot });
    }
    case 'show':
      return a.detail
        ? t('log.showWith', { player, cards: (a.cards ?? []).join(' '), detail: a.detail })
        : t('log.show', { player, cards: (a.cards ?? []).join(' ') });
    case 'muck':
      return t('log.muck', { player });
    case 'timeout':
      return t('log.timeout', { player });
    case 'disconnect':
      return a.detail === 'connected' ? t('log.connected', { player }) : t('log.disconnected', { player });
    case 'info': {
      const d = a.detail ?? '';
      if (d.startsWith('finished:')) {
        const [, place, prize] = d.split(':');
        return prize ? t('log.finishedPrize', { player, place, prize }) : t('log.finished', { player, place });
      }
      if (d.startsWith('bounty:')) {
        const [, amt, victim] = d.split(':');
        return t('log.bounty', { player, amount: amt, victim });
      }
      return t('log.info', { text: a.raw });
    }
    default:
      return a.raw;
  }
}
