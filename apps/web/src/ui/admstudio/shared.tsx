import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/infrastructure/http/client';

/**
 * The few things every tab of the administration area does the same way, kept
 * here so a new tab inherits them instead of inventing its own.
 */

/** Runs a request once and keeps its state, so every tab reports errors alike. */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[]): { data?: T; error: string; busy: boolean; reload: () => void } {
  const { t } = useTranslation();
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError('');
    load()
      .then((value) => alive && setData(value))
      .catch((err: unknown) => alive && setError(err instanceof ApiError ? err.problem.title : t('auth.offline')))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, busy, reload: () => setNonce((n) => n + 1) };
}

export function Empty({ busy, error, empty }: { busy: boolean; error: string; empty?: boolean }) {
  const { t } = useTranslation();
  if (error)
    return (
      <p className="p-4 text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
        {error}
      </p>
    );
  if (busy)
    return (
      <p className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('admstudio.loading')}
      </p>
    );
  if (empty)
    return (
      <p className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('admstudio.nothing')}
      </p>
    );
  return null;
}

export const dateTime = (value: string | Date) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

export function StatusChip({ status }: { status: string }) {
  const colour =
    status === 'ACTIVE'
      ? 'var(--result-won)'
      : status === 'BLOCKED' || status === 'DELETED'
        ? 'var(--result-lost)'
        : 'var(--result-break-even)';
  return (
    <span className="chip-tag" style={{ color: colour, borderColor: colour }}>
      {status}
    </span>
  );
}
