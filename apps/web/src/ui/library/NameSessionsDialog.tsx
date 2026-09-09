import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconClose } from '@/ui/icons';
import type { Session } from '@/model/types';

/**
 * Asks what to call what was just imported. Naming afterwards is the honest
 * order: only then is it known how many sessions arrived, and what each one
 * turned out to hold.
 */
export function NameSessionsDialog({
  sessions,
  onCancel,
  onSave,
}: {
  sessions: Session[];
  onCancel(): void;
  onSave(names: Record<string, string>): void;
}) {
  const { t } = useTranslation();
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setNames(Object.fromEntries(sessions.map((s) => [s.id, s.name])));
  }, [sessions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (sessions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t('library.nameDialogTitle')}
        className="panel w-full max-w-[520px] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(names);
        }}
      >
        <div className="mb-2 flex items-start gap-3">
          <h2 className="flex-1 text-lg font-semibold">{t('library.nameDialogTitle')}</h2>
          <button type="button" className="btn-icon" onClick={onCancel} aria-label={t('common.cancel')}>
            <IconClose size={15} />
          </button>
        </div>
        <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('library.nameDialogBody', { count: sessions.length })}
        </p>

        <ul className="flex max-h-[45vh] flex-col gap-2 overflow-auto">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-2">
              <span className="w-[150px] shrink-0 truncate text-xs" style={{ color: 'var(--text-muted)' }} title={session.sourceFileName}>
                {session.sourceFileName ?? '-'}
              </span>
              <input
                className="input flex-1"
                value={names[session.id] ?? ''}
                maxLength={120}
                autoFocus={sessions.length === 1}
                onChange={(e) => setNames({ ...names, [session.id]: e.target.value })}
              />
              <span className="w-12 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {session.handCount}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>
            {t('library.keepFileNames')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
