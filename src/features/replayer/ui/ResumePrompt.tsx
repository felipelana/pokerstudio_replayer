import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/state/store';

/**
 * A session reopens exactly where it stopped, so nothing is lost by walking
 * away. This says so — only when reopening actually moved the reader — and
 * offers the one thing they might want instead: starting over.
 */
export function ResumePrompt({
  handCount,
  onGoTo,
}: {
  handCount: number;
  onGoTo(index: number): void;
}) {
  const { t } = useTranslation();
  const resumedFrom = useAppStore((s) => s.resumedFrom);
  const clearResumed = useAppStore((s) => s.clearResumed);

  if (resumedFrom === undefined) return null;

  const restart = () => {
    onGoTo(0);
    void useAppStore
      .getState()
      .saveProgress({ lastHandIndex: 0, lastFrameIndex: 0, status: 'in-progress' });
    clearResumed();
  };

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-lg border px-4 py-3 shadow-lg"
      role="status"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p className="text-sm">
        {t('replayer.resumedAt', { current: resumedFrom + 1, total: handCount })}
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn" onClick={clearResumed}>
          {t('replayer.keepGoing')}
        </button>
        <button type="button" className="btn btn-primary" onClick={restart}>
          {t('replayer.startOver')}
        </button>
      </div>
    </div>
  );
}
