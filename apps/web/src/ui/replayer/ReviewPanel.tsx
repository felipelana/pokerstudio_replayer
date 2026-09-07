import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hand, Review, Street } from '@/model/types';
import { STREETS } from '@/model/types';
import { getRepository } from '@/db/repository';
import { useAppStore } from '@/state/store';
import { captureTable } from './capture';

function emptyReview(handId: string): Review {
  return { handId, notes: '', tags: [], streetNotes: {}, createdAt: new Date(), updatedAt: new Date() };
}

export function ReviewPanel({ hand, onClose }: { hand: Hand; onClose(): void }) {
  const { t } = useTranslation();
  const tags = useAppStore((s) => s.settings.leakTags);
  const [capturing, setCapturing] = useState(false);
  const [review, setReview] = useState<Review>(() => emptyReview(hand.id));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const dirty = useRef(false);
  const timer = useRef<number>();

  useEffect(() => {
    let cancelled = false;
    dirty.current = false;
    void getRepository()
      .getReview(hand.id)
      .then((r) => {
        if (!cancelled) setReview(r ?? emptyReview(hand.id));
      });
    return () => {
      cancelled = true;
    };
  }, [hand.id]);

  // Debounced autosave.
  useEffect(() => {
    if (!dirty.current) return;
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const toSave = { ...review, updatedAt: new Date() };
      const isEmpty = !toSave.notes.trim() && toSave.tags.length === 0 && !toSave.rating && !Object.values(toSave.streetNotes ?? {}).some((v) => v?.trim());
      if (isEmpty) await getRepository().deleteReview(hand.id);
      else await getRepository().saveReview(toSave);
      setStatus('saved');
    }, 400);
    return () => window.clearTimeout(timer.current);
  }, [review, hand.id]);

  const update = (patch: Partial<Review>) => {
    dirty.current = true;
    setReview((r) => ({ ...r, ...patch }));
  };

  const toggleTag = (tag: string) => {
    update({ tags: review.tags.includes(tag) ? review.tags.filter((x) => x !== tag) : [...review.tags, tag] });
  };

  return (
    <aside className="panel flex h-full w-[300px] shrink-0 flex-col gap-3 overflow-auto p-3" aria-label={t('review.title')}>
      <div className="flex items-center">
        <h2 className="font-semibold">{t('review.title')}</h2>
        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {status === 'saving' ? t('review.saving') : status === 'saved' ? t('review.saved') : ''}
        </span>
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label={t('common.close')}>
          ✕
        </button>
      </div>

      <div>
        <label className="label">{t('review.rating')}</label>
        <div className="flex gap-1" role="radiogroup" aria-label={t('review.rating')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={review.rating === n}
              className="text-xl"
              style={{ color: (review.rating ?? 0) >= n ? 'var(--result-break-even)' : 'var(--text-muted)' }}
              onClick={() => update({ rating: review.rating === n ? undefined : (n as Review['rating']) })}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">{t('review.tags')}</label>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const on = review.tags.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className="chip-tag"
                aria-pressed={on}
                style={{ background: on ? tag.color : undefined, color: on ? '#fff' : undefined, borderColor: on ? 'transparent' : undefined }}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col">
        <label className="label" htmlFor="review-notes">
          {t('review.notes')}
        </label>
        <textarea
          id="review-notes"
          className="input min-h-[120px]"
          placeholder={t('review.notesPlaceholder')}
          value={review.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </div>

      {/* Report options: what goes in, and whether a picture goes with it. */}
      <div className="flex flex-col gap-2 rounded-lg border p-2" style={{ borderColor: 'var(--border)' }}>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!review.includeInReport}
            onChange={(e) => update({ includeInReport: e.target.checked })}
          />
          {t('review.includeInReport')}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn flex-1 justify-center"
            disabled={capturing}
            onClick={async () => {
              setCapturing(true);
              const blob = await captureTable();
              if (blob) {
                const id = `shot-${hand.id.slice(0, 8)}-${Date.now().toString(36)}`;
                await getRepository().saveAsset(id, blob);
                update({ capture: 'image', imageAssetId: id });
              }
              setCapturing(false);
            }}
          >
            {capturing ? t('review.capturing') : t('review.captureImage')}
          </button>
          <button type="button" className="btn" onClick={() => update({ capture: 'text', imageAssetId: undefined })}>
            {t('review.captureText')}
          </button>
        </div>
        {review.capture === 'image' && review.imageAssetId && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('review.captureSaved')}
          </span>
        )}
      </div>

      <div>
        <label className="label">{t('review.streetNotes')}</label>
        <div className="flex flex-col gap-2">
          {STREETS.map((s: Street) => (
            <label key={s} className="flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--text-muted)' }}>{t(`streets.${s}`)}</span>
              <input
                className="input"
                value={review.streetNotes?.[s] ?? ''}
                onChange={(e) => update({ streetNotes: { ...review.streetNotes, [s]: e.target.value } })}
              />
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
