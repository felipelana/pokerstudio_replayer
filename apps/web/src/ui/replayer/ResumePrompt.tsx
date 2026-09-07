import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/store';
import type { Session } from '@/model/types';

/**
 * A session left half-reviewed reopens exactly where it stopped, so nothing is
 * lost by walking away. This says so, and offers the one thing the reader might
 * want instead: starting over.
 */
export function ResumePrompt({
  session,
  handCount,
  onGoTo,
}: {
  session: Session | undefined;
  handCount: number;
  onGoTo(index: number): void;
}) {
  const { t } = useTranslation();
  const [asked, setAsked] = useState<string>();
  const [saved, setSaved] = useState<number>();
  // Kept in a ref so jumping once does not depend on the callback's identity.
  const goTo = useRef(onGoTo);
  goTo.current = onGoTo;

  useEffect(() => {
    if (!session || asked === session.id) return;
    const index = session.lastHandIndex ?? 0;
    // Nothing to resume at the very beginning, or once the review is finished.
    if (index <= 0 || index >= handCount || session.status === 'completed') {
      setAsked(session.id);
      return;
    }
    // Opening from the library keeps the store's session, so the page would sit
    // on whatever hand it last showed. Jump to the saved one either way.
    goTo.current(index);
    setSaved(index);
    setAsked(session.id);
  }, [session, handCount, asked]);

  if (saved === undefined) return null;

  const restart = () => {
    onGoTo(0);
    void useAppStore.getState().saveProgress({ lastHandIndex: 0, lastFrameIndex: 0, status: 'in-progress' });
    setSaved(undefined);
  };

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-lg border px-4 py-3 shadow-lg"
      role="dialog"
      aria-live="polite"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p className="text-sm">{t('replayer.resumedAt', { current: saved + 1, total: handCount })}</p>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => setSaved(undefined)}>
          {t('replayer.keepGoing')}
        </button>
        <button type="button" className="btn btn-primary" onClick={restart}>
          {t('replayer.startOver')}
        </button>
      </div>
    </div>
  );
}
