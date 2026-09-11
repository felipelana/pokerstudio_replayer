import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Hand, Review, Street } from '@/domain/model/types';
import { STREETS } from '@/domain/model/types';
import { getRepository } from '@/lib/db/repository';
import { STAR_SCORE } from '@pokerstudio/shared';
import { quickResult } from '@/domain/engine/replay';
import { scoreOf } from '@/features/reviews/report/assessment';
import { useAppStore } from '@/lib/state/store';
import { IconCheck, IconEye, IconMore, IconShare } from '@/components/ui/icons';
import type { CoachReading } from '@/components/hooks/useCoachReadings';
import { captureTable } from './capture';

function emptyReview(handId: string): Review {
  return {
    handId,
    notes: '',
    tags: [],
    streetNotes: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function ReviewPanel({
  hand,
  handIndex,
  coaches,
  onShare,
  onClose,
}: {
  hand: Hand;
  /** Position of this hand in the session, which is how a coach files their reading. */
  handIndex: number;
  coaches: CoachReading[];
  /** Raises the sharing dialog on this hand. */
  onShare(): void;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ownTags = useAppStore((s) => s.settings.leakTags);
  const catalogue = useAppStore((s) => s.catalogueLeaks);
  // O catálogo primeiro, porque é o vocabulário que um coach vai reconhecer.
  // Uma etiqueta do leitor com o mesmo identificador vence, porque foi ela
  // que ele nomeou.
  const tags = useMemo(() => {
    const own = new Set(ownTags.map((tag) => tag.id));
    return [...catalogue.filter((leak) => !own.has(leak.id)), ...ownTags];
  }, [catalogue, ownTags]);
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
      const isEmpty =
        !toSave.notes.trim() &&
        toSave.tags.length === 0 &&
        typeof toSave.score !== 'number' &&
        !toSave.rating &&
        !Object.values(toSave.streetNotes ?? {}).some((v) => v?.trim());
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
    update({
      tags: review.tags.includes(tag)
        ? review.tags.filter((x) => x !== tag)
        : [...review.tags, tag],
    });
  };

  return (
    <aside
      className="panel flex h-full w-[300px] shrink-0 flex-col gap-3 overflow-auto p-3"
      aria-label={t('review.title')}
    >
      <div className="flex items-center">
        <h2 className="font-semibold">{t('review.title')}</h2>
        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {status === 'saving' ? t('review.saving') : status === 'saved' ? t('review.saved') : ''}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="btn-icon !px-1.5"
          title={t('share.tooltipHand')}
          aria-label={t('share.tooltipHand')}
          onClick={onShare}
        >
          <IconShare size={14} />
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </div>

      <CoachNotes coaches={coaches} handIndex={handIndex} />

      <ScoreField
        score={scoreOf(review)}
        stars={review.rating}
        played={quickResult(hand).vpip}
        onStars={(rating) =>
          update({ rating, score: rating === undefined ? undefined : STAR_SCORE[rating] })
        }
        onScore={(score) => update({ score, rating: undefined })}
      />

      <div>
        <div className="flex items-center">
          <label className="label">{t('review.tags')}</label>
          <div className="flex-1" />
          <button
            type="button"
            className="btn-icon !px-1 !py-0.5"
            title={t('review.manageTags')}
            aria-label={t('review.manageTags')}
            onClick={() => navigate('/settings?panel=tags')}
          >
            <IconMore size={14} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const on = review.tags.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className="chip-tag"
                aria-pressed={on}
                style={{
                  background: on ? tag.color : undefined,
                  color: on ? '#fff' : undefined,
                  borderColor: on ? 'transparent' : undefined,
                }}
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
      <div
        className="flex flex-col gap-2 rounded-lg border p-2"
        style={{ borderColor: 'var(--border)' }}
      >
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
          <button
            type="button"
            className="btn"
            onClick={() => update({ capture: 'text', imageAssetId: undefined })}
          >
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
                onChange={(e) =>
                  update({ streetNotes: { ...review.streetNotes, [s]: e.target.value } })
                }
              />
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

/**
 * What each coach said about the hand on screen, read only.
 *
 * It sits above the player's own reading because that is the news: the reader
 * came back to this hand to see it. A coach who has not written about this hand
 * is not listed at all, so the panel stays quiet on the hands nobody marked.
 */
function CoachNotes({ coaches, handIndex }: { coaches: CoachReading[]; handIndex: number }) {
  const { t } = useTranslation();
  const said = coaches
    .map((coach) => ({ coach, reading: coach.byIndex.get(handIndex) }))
    .filter(
      (row) =>
        row.reading &&
        (row.reading.comment || typeof row.reading.score === 'number' || row.reading.markedOk),
    );

  if (said.length === 0) return null;

  return (
    <section
      className="flex flex-col gap-2 rounded-lg border p-2.5"
      style={{
        borderColor: 'var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
      }}
      aria-label={t('review.coachTitle')}
    >
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <IconEye size={12} />
        {t('review.coachTitle')}
      </h3>
      {said.map(({ coach, reading }) => (
        <div key={coach.id} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2 text-xs">
            <span className="font-semibold">{coach.coachName}</span>
            {typeof reading?.score === 'number' && (
              <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                {reading.score}/100
              </span>
            )}
            {reading?.markedOk && (
              <span
                className="inline-flex items-center gap-0.5"
                style={{ color: 'var(--result-won)' }}
              >
                <IconCheck size={11} />
                {t('review.coachPlayedWell')}
              </span>
            )}
            {!coach.completedAt && (
              <span style={{ color: 'var(--text-muted)' }}>{t('review.coachInProgress')}</span>
            )}
          </div>
          {reading?.comment && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{reading.comment}</p>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * The reader's score for one hand, from 0 to 100, on the scale a coach writes.
 *
 * The five buttons are the quick way in, and they are the same ruler the report
 * uses to read an old star rating: 10, 30, 50, 75, 95. The slider is there when
 * a hand deserves a number between them. Nothing is scored until the reader
 * says so, and the score can be taken back off.
 *
 * A hand the hero folded before putting money in still takes a score, but the
 * panel says it does not count towards coverage, because coverage asks about
 * hands that were actually played.
 */
function ScoreField({
  score,
  stars,
  played,
  onStars,
  onScore,
}: {
  score?: number;
  stars?: 1 | 2 | 3 | 4 | 5;
  played: boolean;
  onStars(stars: 1 | 2 | 3 | 4 | 5 | undefined): void;
  onScore(score: number | undefined): void;
}) {
  const { t } = useTranslation();
  const steps = [1, 2, 3, 4, 5] as const;
  // A hand rated with the stars shows those stars. One scored with the slider
  // shows the stars it has earned, so the row is never blank on a scored hand.
  const lit =
    stars ?? (score === undefined ? 0 : steps.filter((n) => score >= STAR_SCORE[n]).length);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center">
        <label className="label">{t('review.rating')}</label>
        <div className="flex-1" />
        {stars !== undefined && (
          <button
            type="button"
            className="btn btn-ghost !px-2 !py-0.5 text-xs"
            onClick={() => onStars(undefined)}
          >
            {t('review.clearScore')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1" role="radiogroup" aria-label={t('review.rating')}>
        {steps.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            className="text-xl leading-none"
            title={`${n} · ${STAR_SCORE[n]}`}
            style={{ color: lit >= n ? 'var(--result-break-even)' : 'var(--text-muted)' }}
            onClick={() => onStars(stars === n ? undefined : n)}
          >
            ★
          </button>
        ))}
      </div>

      <div className="flex items-baseline">
        <label className="label" htmlFor="review-score">
          {t('review.score')}
        </label>
        <div className="flex-1" />
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: score === undefined ? 'var(--text-muted)' : 'var(--accent)' }}
        >
          {score === undefined ? t('review.noScore') : score}
        </span>
      </div>

      <input
        id="review-score"
        type="range"
        min={0}
        max={100}
        step={1}
        value={score ?? 50}
        style={{ accentColor: 'var(--accent)' }}
        aria-label={t('review.score')}
        onChange={(e) => onScore(Number(e.target.value))}
      />

      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {played ? t('review.countsForCoverage') : t('review.notPlayed')}
      </p>
    </div>
  );
}
