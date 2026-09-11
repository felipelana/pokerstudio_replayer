import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/lib/state/store';
import { IconClose, IconCompass, IconKeyboard, IconMegaphone } from '@/components/ui/icons';

/** The topics each run walks through, read here as plain answers. */
const TOPICS = {
  library: ['import', 'sessions', 'settings', 'skins', 'feedback'],
  replayer: [
    'replayHands',
    'replayTable',
    'replayQuick',
    'replayFullscreen',
    'replayNotes',
    'replayLog',
    'replayStreets',
    'replayTransport',
    'replayTimeline',
  ],
} as const;

/**
 * Questions about the tool, answered in one place. It says the same things the
 * guided tour says — because they are the same things — and offers the tour,
 * the shortcut list and the way to ask something that is not here.
 */
export function HelpCenter({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const setTourOpen = useAppStore((s) => s.setTourOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const setFeedbackOpen = useAppStore((s) => s.setFeedbackOpen);
  const inReplayer = location.pathname.startsWith('/replay');

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('help.title')}
        className="panel flex max-h-[85vh] w-full max-w-[620px] flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pb-2 pt-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{t('help.title')}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('help.intro')}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <IconClose size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-sm">
          <h3 className="mt-3 font-semibold">{t('help.howTo')}</h3>
          <dl className="mt-2">
            {TOPICS[inReplayer ? 'replayer' : 'library'].map((topic) => (
              <div key={topic} className="mb-3">
                <dt className="font-semibold">{t(`tour.steps.${topic}.title`)}</dt>
                <dd className="leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {t(`tour.steps.${topic}.body`)}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                setTourOpen(true, inReplayer ? 'replayer' : 'library');
              }}
            >
              <IconCompass size={15} />
              {t('help.startTour')}
            </button>
            {inReplayer && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onClose();
                  setHelpOpen(true);
                }}
              >
                <IconKeyboard size={15} />
                {t('shortcuts.title')}
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                onClose();
                setFeedbackOpen(true);
              }}
            >
              <IconMegaphone size={15} />
              {t('help.askUs')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
