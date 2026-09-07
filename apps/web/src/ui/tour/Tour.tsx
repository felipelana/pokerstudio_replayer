import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/state/store';
import { IconClose, IconHelp } from '../icons';

interface Step {
  /** Element carrying data-tour="…"; absent means a card in the middle. */
  target?: string;
  /** Route this step needs to be looked at on. */
  route?: string;
  key: string;
}

/**
 * The steps of the first run, in the order someone actually meets the app:
 * bring hands in, open one, make it yours, then say what is missing.
 */
const STEPS: Step[] = [
  { key: 'welcome' },
  { key: 'import', target: 'import', route: '/' },
  { key: 'sessions', target: 'sessions', route: '/' },
  { key: 'settings', target: 'settings' },
  { key: 'skins', target: 'skins' },
  { key: 'feedback', target: 'account' },
];

const PADDING = 8;
const CARD_WIDTH = 320;

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Where the target is on screen right now, or nothing if it is not there. */
function measure(target?: string): Spot | undefined {
  if (!target) return undefined;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return undefined;
  return {
    top: Math.max(0, r.top - PADDING),
    left: Math.max(0, r.left - PADDING),
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

/**
 * A guided first run: one part of the screen lit at a time, with a card saying
 * what it is for. It shows itself once, and can be asked for again from the
 * account menu.
 */
export function Tour() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const open = useAppStore((s) => s.tourOpen);
  const setOpen = useAppStore((s) => s.setTourOpen);
  const settings = useAppStore((s) => s.settings);
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setHelpCenterOpen = useAppStore((s) => s.setHelpCenterOpen);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot>();

  const step = STEPS[Math.min(index, STEPS.length - 1)];

  // First run: offer the tour once, and never again unasked.
  useEffect(() => {
    if (settingsLoaded && !settings.tourSeen) {
      setIndex(0);
      setOpen(true);
    }
  }, [settingsLoaded, settings.tourSeen, setOpen]);

  // A step may live on another page; go there before pointing at anything.
  useEffect(() => {
    if (open && step.route && location.pathname !== step.route) navigate(step.route);
  }, [open, step.route, location.pathname, navigate]);

  const relocate = useCallback(() => setSpot(measure(step.target)), [step.target]);

  useLayoutEffect(() => {
    if (!open) return;
    relocate();
    // The target may still be mounting, or the page may still be navigating.
    const again = window.setTimeout(relocate, 250);
    window.addEventListener('resize', relocate);
    window.addEventListener('scroll', relocate, true);
    return () => {
      window.clearTimeout(again);
      window.removeEventListener('resize', relocate);
      window.removeEventListener('scroll', relocate, true);
    };
  }, [open, relocate, location.pathname]);

  const finish = useCallback(() => {
    setOpen(false);
    setIndex(0);
    if (!settings.tourSeen) updateSettings({ tourSeen: true });
  }, [setOpen, settings.tourSeen, updateSettings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, finish]);

  if (!open) return null;

  const last = index === STEPS.length - 1;

  // The card sits under the lit area, or over it when there is no room below.
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const below = spot ? spot.top + spot.height + 12 : 0;
  const placeAbove = !!spot && below + 190 > viewportH;
  const cardTop = spot ? (placeAbove ? Math.max(12, spot.top - 200) : below) : Math.max(12, viewportH / 2 - 110);
  const cardLeft = spot
    ? Math.min(Math.max(12, spot.left + spot.width / 2 - CARD_WIDTH / 2), viewportW - CARD_WIDTH - 12)
    : Math.max(12, viewportW / 2 - CARD_WIDTH / 2);

  return (
    <div className="fixed inset-0 z-[130]" role="dialog" aria-modal="true" aria-label={t('tour.title')}>
      {/* The lit area is a hole in the dark: one transparent box with a very
          large shadow around it. With no target, the whole screen dims. */}
      {spot ? (
        <div
          className="pointer-events-none absolute rounded-lg"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.66)',
            outline: '2px solid var(--accent)',
            outlineOffset: 2,
            transition: 'top 180ms ease, left 180ms ease, width 180ms ease, height 180ms ease',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.66)' }} />
      )}

      <div
        className="panel absolute p-4 shadow-2xl"
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
      >
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-semibold">{t(`tour.steps.${step.key}.title`)}</h2>
          <button
            type="button"
            className="btn-icon"
            title={t('help.title')}
            aria-label={t('help.title')}
            onClick={() => {
              finish();
              setHelpCenterOpen(true);
            }}
          >
            <IconHelp size={14} />
          </button>
          <button type="button" className="btn-icon" onClick={finish} aria-label={t('common.close')}>
            <IconClose size={14} />
          </button>
        </div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t(`tour.steps.${step.key}.body`)}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {index + 1} / {STEPS.length}
          </span>
          <div className="flex-1" />
          <button type="button" className="btn" onClick={finish}>
            {last ? t('tour.done') : t('tour.skip')}
          </button>
          {index > 0 && (
            <button type="button" className="btn" onClick={() => setIndex((i) => i - 1)}>
              {t('common.back')}
            </button>
          )}
          {!last && (
            <button type="button" className="btn btn-primary" onClick={() => setIndex((i) => i + 1)}>
              {t('tour.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
