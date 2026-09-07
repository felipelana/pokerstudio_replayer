import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/infrastructure/http/client';

interface Status {
  enrolled: boolean;
  pending: boolean;
  verified: boolean;
  recoveryCodesLeft: number;
}

const twoFactorApi = {
  status: () => api.get<Status>('/admin/2fa'),
  enroll: () => api.post<{ keyUri: string; secret: string }>('/admin/2fa/enroll'),
  verify: (code: string) => api.post<{ confirmed: boolean; recoveryCodes?: string[] }>('/admin/2fa/verify', { code }),
  recovery: (code: string) => api.post<{ remaining: number }>('/admin/2fa/recovery', { code }),
};

/**
 * Stands in front of the administrative area. The server refuses every /admin
 * call until the session has passed the second factor — this only puts a face
 * on that refusal and walks the administrator through enrolment.
 */
export function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>();
  const [error, setError] = useState('');
  const [enrolment, setEnrolment] = useState<{ keyUri: string; secret: string }>();
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>();
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    twoFactorApi
      .status()
      .then(setStatus)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.problem.title : t('auth.offline')));
  }, [t]);

  if (!status) {
    return (
      <p className="p-4 text-sm" style={{ color: error ? 'var(--result-lost)' : 'var(--text-muted)' }}>
        {error || t('admstudio.loading')}
      </p>
    );
  }

  if (status.verified && !recoveryCodes) return <>{children}</>;

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      setEnrolment(await twoFactorApi.enroll());
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (useRecovery) {
        await twoFactorApi.recovery(code);
        setStatus({ ...status, verified: true });
      } else {
        const result = await twoFactorApi.verify(code);
        if (result.recoveryCodes) setRecoveryCodes(result.recoveryCodes);
        setStatus({ ...status, verified: true, enrolled: true, pending: false });
      }
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy(false);
    }
  };

  // Shown once, right after enrolment. Nothing can bring them back later.
  if (recoveryCodes) {
    return (
      <div className="mx-auto max-w-[520px]">
        <div className="panel p-5">
          <h2 className="text-lg font-semibold">{t('twofa.recoveryTitle')}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('twofa.recoveryBody')}
          </p>
          <ul className="my-4 grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((value) => (
              <li key={value} className="rounded-md px-2 py-1" style={{ background: 'var(--surface-2)' }}>
                {value}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => void navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
            >
              {t('twofa.copy')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setRecoveryCodes(undefined)}>
              {t('twofa.saved')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="panel p-5">
        <h2 className="text-lg font-semibold">{status.enrolled ? t('twofa.verifyTitle') : t('twofa.setupTitle')}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {status.enrolled ? t('twofa.verifyBody') : t('twofa.setupBody')}
        </p>

        {!status.enrolled && !enrolment && (
          <button type="button" className="btn btn-primary mt-4" onClick={start} disabled={busy}>
            {busy ? t('auth.working') : t('twofa.start')}
          </button>
        )}

        {enrolment && (
          <div className="mt-4 flex flex-col gap-2">
            <span className="label-caps">{t('twofa.secretLabel')}</span>
            <code className="select-all break-all rounded-md px-2 py-2 font-mono text-sm" style={{ background: 'var(--surface-2)' }}>
              {enrolment.secret.replace(/(.{4})/g, '$1 ').trim()}
            </code>
            <a className="btn" href={enrolment.keyUri}>
              {t('twofa.openApp')}
            </a>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('twofa.secretHint')}
            </p>
          </div>
        )}

        {(status.enrolled || enrolment) && (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {useRecovery ? t('twofa.recoveryCode') : t('twofa.code')}
              <input
                className="input font-mono tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode={useRecovery ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                required
              />
            </label>
            {error && (
              <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary justify-center" disabled={busy || code.trim().length < 6}>
              {busy ? t('auth.working') : t('twofa.confirm')}
            </button>
            {status.enrolled && (
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setCode('');
                  setError('');
                }}
              >
                {useRecovery ? t('twofa.useApp') : t('twofa.useRecovery')}
              </button>
            )}
          </form>
        )}

        {error && !status.enrolled && !enrolment && (
          <p className="mt-3 text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
