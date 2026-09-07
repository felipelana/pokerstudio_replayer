import type { Hand, Review, Session } from '@/model/types';
import type { Skin } from '@/skins/types';
import { getDb, type StoredHand } from './db';

/**
 * Single persistence interface. The MVP ships `IndexedDbRepository`; phase 2
 * adds `HttpRepository` (VPS backend with login) without touching the UI.
 */
export interface Repository {
  listSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  saveSession(session: Session, hands: Hand[]): Promise<{ added: number; duplicates: number }>;
  renameSession(id: string, name: string): Promise<void>;
  /** Remembers where the review stopped and whether it is finished. */
  saveSessionProgress(id: string, patch: { lastHandIndex?: number; status?: 'in-progress' | 'completed'; lastOpenedAt?: Date }): Promise<void>;
  deleteSession(id: string): Promise<void>;

  getHands(ids: string[]): Promise<Hand[]>;
  getHand(id: string): Promise<Hand | undefined>;
  hasHand(id: string): Promise<boolean>;

  getReview(handId: string): Promise<Review | undefined>;
  saveReview(review: Review): Promise<void>;
  deleteReview(handId: string): Promise<void>;
  listReviews(): Promise<Review[]>;

  getSetting<T>(key: string, fallback: T): Promise<T>;
  setSetting<T>(key: string, value: T): Promise<void>;

  listSkins(): Promise<Skin[]>;
  saveSkin(skin: Skin): Promise<void>;
  deleteSkin(id: string): Promise<void>;

  saveAsset(id: string, blob: Blob): Promise<void>;
  getAsset(id: string): Promise<Blob | undefined>;
  deleteAsset(id: string): Promise<void>;

  exportLibrary(): Promise<string>;
  importLibrary(json: string): Promise<{ sessions: number; hands: number; reviews: number }>;
  clearAll(): Promise<void>;
}

interface LibraryExport {
  version: 1;
  exportedAt: string;
  sessions: Session[];
  hands: StoredHand[];
  reviews: Review[];
  skins: Skin[];
}

export class IndexedDbRepository implements Repository {
  private db = getDb();

  async listSessions(): Promise<Session[]> {
    return this.db.sessions.orderBy('importedAt').reverse().toArray();
  }

  getSession(id: string) {
    return this.db.sessions.get(id);
  }

  async saveSession(session: Session, hands: Hand[]) {
    let added = 0;
    let duplicates = 0;
    await this.db.transaction('rw', this.db.sessions, this.db.hands, async () => {
      const existing = new Set(
        (await this.db.hands.where('id').anyOf(hands.map((h) => h.id)).primaryKeys()) as string[],
      );
      const fresh: StoredHand[] = [];
      for (const h of hands) {
        if (existing.has(h.id)) {
          duplicates++;
          continue;
        }
        existing.add(h.id);
        fresh.push({ ...h, sessionId: session.id, ts: h.timestamp.getTime() });
        added++;
      }
      await this.db.hands.bulkAdd(fresh);
      await this.db.sessions.put(session);
    });
    return { added, duplicates };
  }

  async renameSession(id: string, name: string) {
    await this.db.sessions.update(id, { name });
  }

  async saveSessionProgress(id: string, patch: { lastHandIndex?: number; status?: 'in-progress' | 'completed'; lastOpenedAt?: Date }) {
    await this.db.sessions.update(id, {
      ...patch,
      ...(patch.status === 'completed' ? { completedAt: new Date() } : {}),
      ...(patch.status === 'in-progress' ? { completedAt: undefined } : {}),
    });
  }

  async deleteSession(id: string) {
    await this.db.transaction('rw', this.db.sessions, this.db.hands, this.db.reviews, async () => {
      const session = await this.db.sessions.get(id);
      if (!session) return;
      // Only delete hands no other session references.
      const others = await this.db.sessions.where('id').notEqual(id).toArray();
      const referenced = new Set(others.flatMap((s) => s.handIds));
      const toDelete = session.handIds.filter((h) => !referenced.has(h));
      await this.db.hands.bulkDelete(toDelete);
      await this.db.reviews.bulkDelete(toDelete);
      await this.db.sessions.delete(id);
    });
  }

  async getHands(ids: string[]): Promise<Hand[]> {
    const rows = await this.db.hands.bulkGet(ids);
    return rows.filter((r): r is StoredHand => !!r);
  }

  getHand(id: string) {
    return this.db.hands.get(id);
  }

  async hasHand(id: string) {
    return (await this.db.hands.where('id').equals(id).count()) > 0;
  }

  getReview(handId: string) {
    return this.db.reviews.get(handId);
  }

  async saveReview(review: Review) {
    await this.db.reviews.put(review);
  }

  async deleteReview(handId: string) {
    await this.db.reviews.delete(handId);
  }

  listReviews() {
    return this.db.reviews.toArray();
  }

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.settings.get(key);
    return row ? (row.value as T) : fallback;
  }

  async setSetting<T>(key: string, value: T) {
    await this.db.settings.put({ key, value });
  }

  listSkins() {
    return this.db.skins.toArray();
  }

  async saveSkin(skin: Skin) {
    await this.db.skins.put({ ...skin, updatedAt: Date.now() });
  }

  async deleteSkin(id: string) {
    await this.db.skins.delete(id);
  }

  async saveAsset(id: string, blob: Blob) {
    await this.db.assets.put({ id, blob, type: blob.type, createdAt: Date.now() });
  }

  async getAsset(id: string) {
    return (await this.db.assets.get(id))?.blob;
  }

  async deleteAsset(id: string) {
    await this.db.assets.delete(id);
  }

  async exportLibrary(): Promise<string> {
    const data: LibraryExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: await this.db.sessions.toArray(),
      hands: await this.db.hands.toArray(),
      reviews: await this.db.reviews.toArray(),
      skins: await this.db.skins.toArray(),
    };
    return JSON.stringify(data);
  }

  async importLibrary(json: string) {
    const data = JSON.parse(json) as LibraryExport;
    if (data.version !== 1) throw new Error('Unsupported library version');
    const revive = <T extends object>(o: T, keys: (keyof T)[]): T => {
      for (const k of keys) {
        const v = o[k] as unknown;
        if (typeof v === 'string' || typeof v === 'number') (o as Record<string, unknown>)[k as string] = new Date(v);
      }
      return o;
    };
    const sessions = data.sessions.map((s) => revive(s, ['importedAt', 'firstHandAt', 'lastHandAt']));
    const hands = data.hands.map((h) => revive(h, ['timestamp']));
    const reviews = data.reviews.map((r) => revive(r, ['createdAt', 'updatedAt']));
    await this.db.transaction(
      'rw',
      this.db.sessions,
      this.db.hands,
      this.db.reviews,
      this.db.skins,
      async () => {
        await this.db.sessions.bulkPut(sessions);
        await this.db.hands.bulkPut(hands);
        await this.db.reviews.bulkPut(reviews);
        if (data.skins?.length) await this.db.skins.bulkPut(data.skins);
      },
    );
    return { sessions: sessions.length, hands: hands.length, reviews: reviews.length };
  }

  async clearAll() {
    await Promise.all([
      this.db.hands.clear(),
      this.db.sessions.clear(),
      this.db.reviews.clear(),
      this.db.skins.clear(),
      this.db.assets.clear(),
    ]);
  }
}

let repo: Repository | undefined;
export function getRepository(): Repository {
  repo ??= new IndexedDbRepository();
  return repo;
}
