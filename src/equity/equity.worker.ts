/// <reference lib="webworker" />
import { computeEquities, type EquityInput } from './montecarlo.ts';

export interface EquityRequest extends EquityInput {
  id: number;
}

export interface EquityResponse {
  id: number;
  values: Record<string, number | undefined>;
}

self.onmessage = (ev: MessageEvent<EquityRequest>) => {
  const { id, ...input } = ev.data;
  const values = computeEquities(input);
  const msg: EquityResponse = { id, values };
  self.postMessage(msg);
};
