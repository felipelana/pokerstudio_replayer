import type { Hand, Session, Site } from '@/domain/model/types';
import { getRepository } from '@/lib/db/repository';
import type { ParseRequest, ParseResponse } from './parse.worker';
import type { ParseResult } from './types';
import { parseText } from './registry';
import { track } from '@/lib/infrastructure/usage';

let worker: Worker | undefined;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (r: ParseResult) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | undefined {
  if (typeof Worker === 'undefined') return undefined;
  if (!worker) {
    try {
      worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (ev: MessageEvent<ParseResponse>) => {
        const p = pending.get(ev.data.id);
        if (!p) return;
        pending.delete(ev.data.id);
        if (ev.data.result) p.resolve(ev.data.result);
        else p.reject(new Error(ev.data.error ?? 'Parse failed'));
      };
      worker.onerror = () => {
        for (const p of pending.values()) p.reject(new Error('Parser worker crashed'));
        pending.clear();
        worker = undefined;
      };
    } catch {
      worker = undefined;
    }
  }
  return worker;
}

/** Parse text off the main thread (falls back to inline parsing in tests / old browsers). */
export function parseInWorker(text: string, override?: Site): Promise<ParseResult> {
  const w = getWorker();
  if (!w) return parseText(text, override);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    const req: ParseRequest = { id, text, override };
    w.postMessage(req);
  });
}

export interface ImportSummary {
  session: Session;
  result: ParseResult;
  added: number;
  duplicates: number;
}

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/** Parse + persist one file/paste as a session. */
export async function importText(
  name: string,
  text: string,
  override?: Site,
  sourceFileName?: string,
  /**
   * O identificador a usar, quando ele já existe em outro lugar.
   *
   * Uma revisão guardada na conta e reconstruída aqui é a mesma revisão, e
   * precisa do mesmo identificador: com um novo, a biblioteca listaria as duas
   * como coisas diferentes e a linha da nuvem nunca se reconheceria como já
   * baixada. Uma importação comum não passa nada e ganha um identificador novo.
   */
  sessionId?: string,
): Promise<ImportSummary> {
  const result = await parseInWorker(text, override);
  const hands: Hand[] = result.hands;
  const players = Array.from(new Set(hands.flatMap((h) => h.players.map((p) => p.name)))).sort();
  const times = hands.map((h) => h.timestamp.getTime()).filter((t) => !Number.isNaN(t));
  const session: Session = {
    id: sessionId ?? newId(),
    name,
    // Only a real file has a file name; a pasted import has none.
    sourceFileName,
    site: result.site,
    handIds: hands.map((h) => h.id),
    handCount: hands.length,
    importedAt: new Date(),
    firstHandAt: times.length ? new Date(Math.min(...times)) : undefined,
    lastHandAt: times.length ? new Date(Math.max(...times)) : undefined,
    players,
    warnings: [
      ...result.warnings,
      ...result.failures.map((f) => f.error),
      ...hands.flatMap((h) => h.warnings.map((w) => `#${h.handNumber}: ${w}`)),
    ],
  };
  if (hands.length === 0) {
    return { session, result, added: 0, duplicates: 0 };
  }
  const { added, duplicates } = await getRepository().saveSession(session, hands);
  track('HAND_IMPORT', { meta: { hands: added, site: result.site } });
  return { session, result, added, duplicates };
}

/** Read File objects (from drop / picker / directory) and import each. */
export async function importFiles(
  files: File[],
  override?: Site,
  name?: string,
): Promise<ImportSummary[]> {
  const out: ImportSummary[] = [];
  const textFiles = files.filter((f) => /\.txt$/i.test(f.name) || f.type.startsWith('text/'));
  for (const [index, f] of textFiles.entries()) {
    const text = await f.text();
    if (!text.trim()) continue;
    // A chosen name wins over the file name; with several files it is numbered
    // so the sessions stay apart in the library.
    const chosen = name?.trim();
    const label = chosen ? (textFiles.length > 1 ? `${chosen} (${index + 1})` : chosen) : f.name;
    out.push(await importText(label, text, override, f.name));
  }
  return out;
}

/** Recursively collect files from a DataTransfer (supports dropped folders). */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? []);
  const entries = items
    .map((i) => (typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (entries.length === 0) return Array.from(dt.files ?? []);
  const files: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) =>
        (entry as FileSystemFileEntry).file(res, rej),
      );
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readAll = async (): Promise<FileSystemEntry[]> => {
        const acc: FileSystemEntry[] = [];
        for (;;) {
          const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
            reader.readEntries(res, rej),
          );
          if (!batch.length) break;
          acc.push(...batch);
        }
        return acc;
      };
      for (const child of await readAll()) await walk(child);
    }
  };
  for (const e of entries) await walk(e);
  return files;
}
