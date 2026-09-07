import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRepository } from '@/db/repository';
import type { Session } from '@/model/types';

/**
 * Asks once, when a session that was left half-reviewed is opened again,
 * whether to pick up where it stopped or start from the first hand.
 */
export function ResumePrompt({
  session,
  handCount,
  currentIndex,
  onGoTo,
}: {
  session: Session | undefined;
  handCount: number;
  currentIndex: number;
  onGoTo(index: number): void;
}) {
  const { t } = useTranslation();
  const [asked, setAsked] = useState<string>();
  const [saved, setSaved] = useState<number>();

  useEffect(() => {
    if (!session || asked === session.id) return;
    const index = session.lastHandIndex ?? 0;
    // Nothing to resume at the very beginning, or once the review is finished.
    if (index <= 0 || index >= handCount || session.status === 'completed') {
      setAsked(session.id);
      return;
    }
    setSaved(index);
    setAsked(session.id);
  }, [session, handCount, asked]);

  if (saved === undefined || saved === currentIndex) return null;

  const resume = () => {
    onGoTo(saved);
    setSaved(undefined);
  };

  const restart = () => {
    onGoTo(0);
    if (session) void getRepository().saveSessionProgress(session.id, { lastHandIndex: 0, status: 'in-progress' });
    setSaved(undefined);
  };

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-lg border px-4 py-3 shadow-lg"
      role="dialog"
      aria-live="polite"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p className="text-sm">{t('replayer.resumeQuestion', { current: saved + 1, total: handCount })}</p>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn" onClick={restart}>
          {t('replayer.startOver')}
        </button>
        <button type="button" className="btn btn-primary" onClick={resume}>
          {t('replayer.resume')}
        </button>
      </div>
    </div>
  );
}
