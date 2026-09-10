import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SHOTS, type Shot as ShotAsset } from '@landing/assets/shots';
import {
  EvolutionChart,
  ReportIllustration,
  ResumeIllustration,
  SaveIllustration,
  ShareIllustration,
} from '@landing/components/Illustrations';

type Media =
  | { kind: 'shot'; shots: ShotAsset[]; altKeys: string[] }
  | { kind: 'illustration'; node: ReactNode };

interface Slide {
  key: string;
  media: Media;
}

/**
 * Four of these are real captures and four are drawn diagrams. The drawn ones
 * carry an "illustration" badge, so no diagram is ever taken for a screenshot.
 */
const SLIDES: Slide[] = [
  { key: 'replay', media: { kind: 'shot', shots: [SHOTS.table], altKeys: ['alt.table'] } },
  {
    key: 'feedback',
    media: {
      kind: 'shot',
      shots: [SHOTS.reviewPanel, SHOTS.streetNotes],
      altKeys: ['alt.reviewPanel', 'alt.streetNotes'],
    },
  },
  { key: 'resume', media: { kind: 'illustration', node: <ResumeIllustration /> } },
  { key: 'save', media: { kind: 'illustration', node: <SaveIllustration /> } },
  { key: 'share', media: { kind: 'illustration', node: <ShareIllustration /> } },
  { key: 'reports', media: { kind: 'illustration', node: <ReportIllustration /> } },
  { key: 'evolution', media: { kind: 'illustration', node: <EvolutionChart /> } },
  { key: 'skins', media: { kind: 'shot', shots: [SHOTS.skinsFull], altKeys: ['alt.skinsFull'] } },
];

const SWIPE_THRESHOLD = 48;

/** How long each slide stays up while the carousel is playing. */
const AUTOPLAY_MS = 4000;

export function FeatureCarousel() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [paused, setPaused] = useState(false);
  const regionId = useId();
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  /** Wraps around at both ends, so the arrows are never dead. */
  const go = useCallback((next: number) => {
    const total = SLIDES.length;
    setIndex(((next % total) + total) % total);
  }, []);

  /**
   * Advances on its own every four seconds, and stops the moment the reader is
   * near it: while the pointer is over it, while focus is inside it, while the
   * tab is in the background, and for anyone who asked for less motion. The
   * pause button below turns it off for good — required, since content that
   * moves by itself must be stoppable.
   */
  useEffect(() => {
    if (!playing || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing, paused, index]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(SLIDES.length - 1);
    }
  }

  // Touch and pen drags move the carousel; a vertical drag is left to the page.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragged.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = dragStart.current;
    if (!start || dragged.current) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    dragged.current = true;
    go(index + (dx < 0 ? 1 : -1));
  }

  function endDrag() {
    dragStart.current = null;
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={t('features.region')}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="focus:outline-none"
    >
      <div
        id={regionId}
        className="overflow-hidden rounded-2xl border border-line bg-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: 'pan-y' }}
      >
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide, i) => {
            const media = slide.media;
            const isIllustration = media.kind === 'illustration';
            return (
              // Inactive slides are hidden from assistive technology; they hold
              // no focusable elements, so nothing can be tabbed into off-screen.
              <div key={slide.key} className="w-full shrink-0" aria-hidden={i !== index}>
                <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
                  <div className="flex min-h-[260px] items-center justify-center gap-4 bg-bg-2 p-5 sm:min-h-[340px] sm:p-8">
                    {media.kind === 'shot' ? (
                      media.shots.map((shot, si) => (
                        <img
                          key={si}
                          src={shot.src}
                          width={shot.width}
                          height={shot.height}
                          alt={t(media.altKeys[si])}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className="max-h-[220px] w-auto max-w-full rounded-lg border border-line sm:max-h-[300px]"
                        />
                      ))
                    ) : (
                      <div className="w-full max-w-[460px]">{media.node}</div>
                    )}
                  </div>

                  <div className="flex flex-col justify-center gap-4 p-6 sm:p-9">
                    <div className="flex items-center gap-3">
                      <span className="label-caps">
                        {t('features.position', { current: i + 1, total: SLIDES.length })}
                      </span>
                      {isIllustration ? (
                        <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                          {t('illus.label')}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-2xl font-bold leading-snug">
                      {t(`features.items.${slide.key}.title`)}
                    </h3>
                    <p className="text-base leading-relaxed text-muted">
                      {t(`features.items.${slide.key}.text`)}
                    </p>
                    {isIllustration ? (
                      <p className="text-xs text-faint">{t('illus.note')}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Position announced for screen readers without moving focus. */}
      <p className="sr-only" aria-live="polite">
        {t('features.position', { current: index + 1, total: SLIDES.length })} ·{' '}
        {t(`features.items.${SLIDES[index].key}.title`)}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={t('features.prev')}
            aria-controls={regionId}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-content transition-colors hover:border-[color:var(--border-strong)] hover:bg-surface-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={t('features.next')}
            aria-controls={regionId}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-content transition-colors hover:border-[color:var(--border-strong)] hover:bg-surface-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? t('features.pause') : t('features.play')}
            aria-controls={regionId}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-content transition-colors hover:border-[color:var(--border-strong)] hover:bg-surface-2"
          >
            {playing ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
                <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M8 5.5v13l11-6.5L8 5.5Z" />
              </svg>
            )}
          </button>
        </div>

        <ul className="flex flex-wrap items-center gap-2">
          {SLIDES.map((slide, i) => (
            <li key={slide.key}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === index ? 'true' : undefined}
                aria-controls={regionId}
                aria-label={t('features.goTo', {
                  number: i + 1,
                  title: t(`features.items.${slide.key}.title`),
                })}
                className={[
                  'block h-2.5 rounded-full transition-all',
                  i === index
                    ? 'w-8 bg-accent'
                    : 'w-2.5 bg-[color:var(--border-strong)] hover:bg-muted',
                ].join(' ')}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
