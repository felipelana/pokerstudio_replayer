/// <reference lib="webworker" />
import type { Site } from '@/model/types';
import { parseText } from './registry';
import type { ParseResult } from './types';

export interface ParseRequest {
  id: number;
  text: string;
  override?: Site;
}

export interface ParseResponse {
  id: number;
  result?: ParseResult;
  error?: string;
}

self.onmessage = async (ev: MessageEvent<ParseRequest>) => {
  const { id, text, override } = ev.data;
  try {
    const result = await parseText(text, override);
    const msg: ParseResponse = { id, result };
    self.postMessage(msg);
  } catch (e) {
    const msg: ParseResponse = { id, error: e instanceof Error ? e.message : String(e) };
    self.postMessage(msg);
  }
};
