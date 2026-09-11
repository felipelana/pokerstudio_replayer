import Dexie, { type Table } from 'dexie';
import type { Hand, Review, Session } from '@/domain/model/types';
import type { Skin } from '@/lib/skins/types';

export interface StoredHand extends Hand {
  /** Session that first imported this hand. */
  sessionId: string;
  /** Millis, duplicated from timestamp for indexing. */
  ts: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface AssetRow {
  id: string;
  type: string;
  blob: Blob;
  createdAt: number;
}

export class ReplayerDb extends Dexie {
  hands!: Table<StoredHand, string>;
  sessions!: Table<Session, string>;
  reviews!: Table<Review, string>;
  settings!: Table<SettingRow, string>;
  skins!: Table<Skin, string>;
  assets!: Table<AssetRow, string>;

  constructor(name = 'lana-replayer') {
    super(name);
    this.version(1).stores({
      hands: 'id, sessionId, ts, handNumber, site',
      sessions: 'id, importedAt',
      reviews: 'handId, updatedAt',
      settings: 'key',
      skins: 'id, updatedAt',
      assets: 'id',
    });
  }
}

let instance: ReplayerDb | undefined;
export function getDb(): ReplayerDb {
  instance ??= new ReplayerDb();
  return instance;
}
