import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { feedbackApi, type FeedbackKind, type MyFeedbackRow } from '@/infrastructure/http/feedbackApi';
import { ApiError } from '@/infrastructure/http/client';
import { IconClose } from '../icons';

const KINDS: FeedbackKind[] = ['SUGGESTION', 'IMPROVEMENT', 'PROBLEM', 'OTHER'];

/** Colour per state, so a list of notes can be read at a glance. */
const STATUS_COLOR: Record<MyFeedbackRow['status'], string> = {
  NEW: 'var(--text-muted)',
  READ: 'var(--text-muted)',
  PLANNED: 'var(--result-break-even)',
  DONE: 'var(--result-won)',
  DECLINED: 'var(--result-lost)',
};

/**
 * Where a reader says what the tool should do next. It goes straight to the
 * team's box — nothing is filtered on the way — and the sender can see what
 * became of everything they have sent.
 */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [kind, setKind] = useState<FeedbackKind>('SUGGESTION');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<MyFeedbackRow[]>([]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void feedbackApi
      .mine()
      .then((r) => alive && setMine(r.items))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, sent]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      // The screen it was written from travels with it: a report reads very
      // differently once you know where the reader was standing.
      await feedbackApi.submit({ kind, subject, body, appSurface: location.pathname.split('/')[1] || 'library' });
      setSent(true);
      setSubject('');
      setBody('');
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('feedback.title')}
        className="panel flex max-h-[85vh] w-full max-w-[620px] flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pb-2 pt-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{t('feedback.title')}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('feedback.subtitle')}
            </p>
          </div>
          <button ref={closeRef} type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <IconClose size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t('feedback.kind')}
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`feedback.kinds.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('feedback.subject')}
              <input
                className="input"
                required
                minLength={3}
                maxLength={160}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('feedback.subjectHint')}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('feedback.body')}
              <textarea
                className="input min-h-[120px]"
                required
                minLength={10}
                maxLength={4000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('feedback.bodyHint')}
              />
            </label>

            {error && (
              <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
                {error}
              </p>
            )}
            {sent && !error && (
              <p className="text-sm" role="status" style={{ color: 'var(--result-won)' }}>
                {t('feedback.thanks')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={onClose}>
                {t('common.close')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? t('auth.working') : t('feedback.send')}
              </button>
            </div>
          </form>

          {mine.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">{t('feedback.mine')}</h3>
              <ul className="flex flex-col gap-1">
                {mine.map((row) => (
                  <li key={row.id} className="flex items-center gap-2 text-xs">
                    <span className="shrink-0 font-semibold" style={{ color: STATUS_COLOR[row.status] }}>
                      {t(`feedback.statuses.${row.status}`)}
                    </span>
                    <span className="truncate">{row.subject}</span>
                    <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {new Date(row.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
