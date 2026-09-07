import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reviewApi, type CloudReviewHand, type CloudReviewRow } from '@/infrastructure/http/reviewApi';
import { ApiError } from '@/infrastructure/http/client';
import { getRepository } from '@/db/repository';
import { importText } from '@/parsers/importer';
import { useAuthStore } from '@/state/authStore';
import { forgetKnownReviews } from '@/ui/replayer/useCloudProgress';
import { useDateFormatter } from '@/ui/hooks/useFormat';
import { quickResult } from '@/engine/replay';
import type { Session } from '@/model/types';

/** Turns one local session into the payload the API stores. */
export async function buildCloudReview(session: Session, storeHandHistory: boolean) {
  const repo = getRepository();
  const hands = await repo.getHands(session.handIds);
  const reviews = await repo.listReviews();
  const byHand = new Map(reviews.map((r) => [r.handId, r]));

  const payloadHands: CloudReviewHand[] = hands.map((hand, index) => {
    const review = byHand.get(hand.id);
    // The same reducer the hand list uses, so the stored outcome matches what
    // the replayer shows.
    const meta = quickResult(hand);
    return {
      index,
      handId: hand.id,
      rawHistory: storeHandHistory ? hand.raw : undefined,
      result: meta.result === 'won' ? 'WON' : meta.result === 'folded' ? 'FOLDED' : meta.result ? 'LOST' : undefined,
      potWon: meta.net,
      reviewedAt: review?.updatedAt ? new Date(review.updatedAt).toISOString() : undefined,
      notes: review
        ? [
            {
              tags: review.tags ?? [],
              body: review.notes ?? '',
              includeInReport: review.includeInReport,
              capture: review.capture === 'image' ? 'IMAGE' : review.capture === 'text' ? 'TEXT' : 'NONE',
              imageRef: review.imageAssetId,
            } as const,
          ]
        : undefined,
    };
  });

  return {
    title: session.name,
    sourceFileName: session.name,
    roomDetected: session.site,
    handCount: session.handCount,
    storeHandHistory,
    hands: payloadHands,
  };
}

/**
 * Reviews saved on the account. The library stays local — this is the copy that
 * lets a session started on one machine be picked up on another.
 */
export function CloudReviews({ sessions, onImported }: { sessions: Session[]; onImported: () => void }) {
  const { t } = useTranslation();
  const df = useDateFormatter();
  const phase = useAuthStore((s) => s.phase);
  const [rows, setRows] = useState<(CloudReviewRow & { _count: { hands: number } })[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [withHistory, setWithHistory] = useState(true);
  const [chosen, setChosen] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await reviewApi.list();
      setRows(data.items);
      setError('');
    } catch (err) {
      // Offline is not an error here: the library works without the server.
      if (err instanceof ApiError && err.problem.status !== 401) setError(err.problem.title);
    }
  }, []);

  useEffect(() => {
    if (phase === 'authenticated') void load();
  }, [phase, load]);

  if (phase !== 'authenticated') return null;

  const push = async () => {
    const session = sessions.find((s) => s.id === chosen);
    if (!session) return;
    setBusy(session.id);
    setError('');
    try {
      await reviewApi.save(session.id, await buildCloudReview(session, withHistory));
      forgetKnownReviews();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy('');
    }
  };

  /** Rebuilds a local session out of the raw histories kept on the server. */
  const pull = async (row: CloudReviewRow) => {
    setBusy(row.id);
    setError('');
    try {
      const full = await reviewApi.get(row.id);
      const text = full.hands
        .map((h) => h.rawHistory)
        .filter((raw): raw is string => !!raw)
        .join('\n\n');
      if (!text) {
        setError(t('cloud.noHistory'));
        return;
      }
      await importText(full.title, text);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy('');
    }
  };

  const remove = async (row: CloudReviewRow) => {
    if (!window.confirm(t('cloud.confirmDelete', { title: row.title }))) return;
    setBusy(row.id);
    try {
      await reviewApi.remove(row.id);
      forgetKnownReviews();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy('');
    }
  };

  const localIds = new Set(sessions.map((s) => s.id));

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold">{t('cloud.title')}</h2>
        <div className="flex-1" />
        <label className="checkbox text-xs">
          <input type="checkbox" checked={withHistory} onChange={(e) => setWithHistory(e.target.checked)} />
          {t('cloud.withHistory')}
        </label>
        <select className="input !w-auto !py-1 text-xs" value={chosen} onChange={(e) => setChosen(e.target.value)}>
          <option value="">{t('cloud.chooseSession')}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn" disabled={!chosen || busy !== ''} onClick={() => void push()}>
          {busy !== '' && busy === chosen ? t('auth.working') : t('cloud.push')}
        </button>
      </header>

      {error && (
        <p className="px-4 py-2 text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('cloud.empty')}
        </p>
      ) : (
        <ul className="text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 border-t px-4 py-2" style={{ borderColor: 'var(--border)' }}>
              <span className="min-w-[180px] flex-1 font-medium">
                {row.title}
                {localIds.has(row.id) && <span className="ml-2 chip-tag">{t('cloud.here')}</span>}
                {row.status === 'COMPLETED' && (
                  <span className="ml-2 chip-tag" style={{ color: 'var(--result-won)' }}>
                    {t('cloud.completed')}
                  </span>
                )}
              </span>
              <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {t('cloud.progress', { current: row.currentHandIndex + 1, total: row.handCount })}
              </span>
              <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {df.dateTime(new Date(row.lastOpenedAt))}
              </span>
              {row.storeHandHistory && !localIds.has(row.id) && (
                <button type="button" className="btn btn-ghost" disabled={busy !== ''} onClick={() => void pull(row)}>
                  {busy === row.id ? t('auth.working') : t('cloud.pull')}
                </button>
              )}
              <button type="button" className="btn btn-ghost" disabled={busy !== ''} onClick={() => void remove(row)}>
                {t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
