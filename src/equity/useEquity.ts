import { useEffect, useRef, useState } from 'react';
import type { Frame } from '@/engine/replay';
import type { Hand } from '@/model/types';
import type { EquityInfo } from '@/renderers/TableRenderer';
import type { EquityRequest, EquityResponse } from './equity.worker';

const EMPTY: EquityInfo = { values: {}, pending: false };

let worker: Worker | undefined;
let seq = 0;
const listeners = new Map<number, (r: EquityResponse) => void>();

function getWorker(): Worker | undefined {
  if (typeof Worker === 'undefined') return undefined;
  if (!worker) {
    try {
      worker = new Worker(new URL('./equity.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (ev: MessageEvent<EquityResponse>) => {
        listeners.get(ev.data.id)?.(ev.data);
        listeners.delete(ev.data.id);
      };
    } catch {
      worker = undefined;
    }
  }
  return worker;
}

const cache = new Map<string, Record<string, number | undefined>>();

/**
 * Equity for every active player with known cards at this frame, computed in a
 * Web Worker and cached by (hand, frame signature). While computing, the last
 * value is kept and `pending` is true.
 */
export function useEquity(hand: Hand, frame: Frame, enabled: boolean, iterations: number): EquityInfo {
  const [state, setState] = useState<EquityInfo>(EMPTY);
  const lastValues = useRef<Record<string, number | undefined>>({});

  const active = frame.players.filter((p) => p.inHand && !p.folded);
  const known = active.filter((p) => p.cards?.length === 2);
  const signature = `${hand.id}|${frame.board.join('')}|${active.map((p) => `${p.name}:${p.cards?.join('') ?? '?'}`).join(',')}|${iterations}`;
  const meaningful = enabled && known.length >= 1 && active.length >= 2 && frame.kind !== 'end';

  useEffect(() => {
    if (!meaningful) {
      setState(EMPTY);
      lastValues.current = {};
      return;
    }
    const hit = cache.get(signature);
    if (hit) {
      lastValues.current = hit;
      setState({ values: hit, pending: false });
      return;
    }
    setState({ values: lastValues.current, pending: true });
    const w = getWorker();
    const id = ++seq;
    const req: EquityRequest = {
      id,
      board: frame.board,
      players: active.map((p) => ({ name: p.name, cards: p.cards?.length === 2 ? p.cards : undefined })),
      iterations,
    };
    let cancelled = false;
    const done = (r: EquityResponse) => {
      if (cancelled) return;
      cache.set(signature, r.values);
      lastValues.current = r.values;
      setState({ values: r.values, pending: false });
    };
    if (w) {
      listeners.set(id, done);
      w.postMessage(req);
    } else {
      // No worker (tests): compute inline.
      void import('./montecarlo').then((m) => done({ id, values: m.computeEquities(req) }));
    }
    return () => {
      cancelled = true;
      listeners.delete(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, meaningful]);

  return state;
}
