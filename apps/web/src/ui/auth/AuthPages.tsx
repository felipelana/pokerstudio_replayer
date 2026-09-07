import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { COUNTRIES, countryName, LANGUAGE_CODES } from '@pokerstudio/shared';
import { accountApi } from '@/infrastructure/http/accountApi';
import { ApiError } from '@/infrastructure/http/client';
import { useAuthStore } from '@/state/authStore';
import { useAppStore } from '@/state/store';
import { IconSpade } from '@/ui/icons';

/** Shell shared by every authentication screen. */
function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="panel w-full max-w-[420px] p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: 'var(--accent)' }}>
            <IconSpade size={16} />
          </span>
          <span className="font-semibold">PokerStudio Replayer</span>
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="mb-4 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

function useApiError() {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const handle = (err: unknown) => {
    if (err instanceof ApiError) setError(err.problem.title);
    else setError(t('auth.offline'));
  };
  return { error, setError, handle };
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { error, setError, handle } = useApiError();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password, remember);
      navigate('/');
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('auth.email')}
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('auth.password')}
          <span className="flex gap-2">
            <input
              className="input flex-1"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
            />
            <button type="button" className="btn" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? t('auth.hide') : t('auth.show')}
            </button>
          </span>
          {capsLock && (
            <span className="text-xs" style={{ color: 'var(--result-break-even)' }}>
              {t('auth.capsLock')}
            </span>
          )}
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {t('auth.rememberMe')}
        </label>
        {error && (
          <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary justify-center" disabled={busy}>
          {busy ? t('auth.working') : t('auth.signIn')}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/signup" className="underline" style={{ color: 'var(--accent)' }}>
          {t('auth.createAccount')}
        </Link>
        <Link to="/forgot-password" className="underline" style={{ color: 'var(--text-muted)' }}>
          {t('auth.forgotPassword')}
        </Link>
      </div>
    </AuthShell>
  );
}

export function SignUpPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const refresh = useAuthStore((s) => s.refresh);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    countryCode: 'BR',
    language: i18n.language,
    phone: '',
    marketingOptIn: false,
    acceptedTerms: false,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { error, setError, handle } = useApiError();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const referralCode = localStorage.getItem('ps.referral') ?? undefined;
      const res = await accountApi.signUp({
        ...form,
        phone: form.phone.trim() || undefined,
        language: LANGUAGE_CODES.includes(form.language as never) ? form.language : 'en',
        referralCode,
      });
      localStorage.removeItem('ps.referral');
      if (res.emailVerificationRequired) setDone(true);
      else {
        await refresh();
        navigate('/');
      }
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell title={t('auth.checkEmailTitle')} subtitle={t('auth.checkEmailBody')}>
        <Link to="/login" className="btn btn-primary w-full justify-center">
          {t('auth.backToLogin')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.signupTitle')} subtitle={t('auth.signupSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('auth.name')}
          <input className="input" required autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('auth.email')}
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('auth.password')}
          <input
            className="input"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('auth.passwordHint')}
          </span>
        </label>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            {t('auth.country')}
            <select className="input" value={form.countryCode} onChange={(e) => set('countryCode', e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {countryName(c.code, i18n.language)} (+{c.dial})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            {t('auth.language')}
            <select className="input" value={form.language} onChange={(e) => set('language', e.target.value)}>
              {LANGUAGE_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          {t('auth.phone')}
          <input className="input" placeholder="+55 11 91234-5678" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.acceptedTerms} onChange={(e) => set('acceptedTerms', e.target.checked)} required />
          <span>
            {t('auth.acceptTerms')}{' '}
            <Link to="/termos" className="underline" target="_blank">
              {t('legal.terms')}
            </Link>{' '}
            &{' '}
            <Link to="/privacidade" className="underline" target="_blank">
              {t('legal.privacy')}
            </Link>
          </span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.marketingOptIn} onChange={(e) => set('marketingOptIn', e.target.checked)} />
          {t('auth.marketing')}
        </label>
        {error && (
          <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary justify-center" disabled={busy}>
          {busy ? t('auth.working') : t('auth.createAccount')}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/login" className="underline" style={{ color: 'var(--accent)' }}>
          {t('auth.haveAccount')}
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { error, setError, handle } = useApiError();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await accountApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t('auth.forgotTitle')} subtitle={sent ? t('auth.forgotSent') : t('auth.forgotSubtitle')}>
      {!sent && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && (
            <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary justify-center" disabled={busy}>
            {busy ? t('auth.working') : t('auth.sendLink')}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link to="/login" className="underline" style={{ color: 'var(--accent)' }}>
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { error, setError, handle } = useApiError();
  const token = params.get('token') ?? '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await accountApi.resetPassword(token, password);
      navigate('/login');
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          className="input"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary justify-center" disabled={busy || !token}>
          {busy ? t('auth.working') : t('auth.setPassword')}
        </button>
      </form>
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const refresh = useAuthStore((s) => s.refresh);
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('failed');
      return;
    }
    void accountApi
      .verifyEmail(token)
      .then(async () => {
        await refresh();
        setState('done');
      })
      .catch(() => setState('failed'));
  }, [params, refresh]);

  return (
    <AuthShell
      title={t('auth.verifyTitle')}
      subtitle={state === 'working' ? t('auth.working') : state === 'done' ? t('auth.verifyDone') : t('auth.verifyFailed')}
    >
      <Link to={state === 'done' ? '/' : '/login'} className="btn btn-primary w-full justify-center">
        {state === 'done' ? t('auth.continue') : t('auth.backToLogin')}
      </Link>
    </AuthShell>
  );
}

/** `/r/:code` — remembers the referral and sends the visitor to sign-up. */
export function ReferralLanding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => {
    const code = window.location.pathname.split('/r/')[1] ?? params.get('code');
    if (code) localStorage.setItem('ps.referral', code.toUpperCase());
    navigate('/signup', { replace: true });
  }, [navigate, params]);
  return null;
}

/** Account area: profile, sessions, referrals and account-level skins. */
export function AccountPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const skins = useAppStore((s) => s.skins);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof accountApi.sessions>>>([]);
  const [referral, setReferral] = useState<Awaited<ReturnType<typeof accountApi.referrals>>>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void accountApi.sessions().then(setSessions).catch(() => undefined);
    void accountApi.referrals().then(setReferral).catch(() => undefined);
  }, []);

  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 overflow-auto p-6">
      <h1 className="text-2xl font-semibold">{t('account.title')}</h1>

      <section className="panel p-4">
        <h2 className="mb-2 font-semibold">{t('account.profile')}</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt style={{ color: 'var(--text-muted)' }}>{t('auth.name')}</dt>
          <dd>{user.name}</dd>
          <dt style={{ color: 'var(--text-muted)' }}>{t('auth.email')}</dt>
          <dd>
            {user.email}{' '}
            {!user.emailVerified && (
              <span className="chip-tag" style={{ color: 'var(--result-break-even)' }}>
                {t('account.unverified')}
              </span>
            )}
          </dd>
          <dt style={{ color: 'var(--text-muted)' }}>{t('auth.country')}</dt>
          <dd>{user.countryCode}</dd>
          <dt style={{ color: 'var(--text-muted)' }}>{t('account.plan')}</dt>
          <dd>{user.plan}</dd>
        </dl>
        <button type="button" className="btn mt-3" onClick={() => void logout()}>
          {t('account.signOut')}
        </button>
      </section>

      <section className="panel p-4">
        <h2 className="mb-2 font-semibold">{t('account.skins')}</h2>
        <p className="mb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('account.skinsHint')}
        </p>
        <ul className="text-sm">
          {skins
            .filter((s) => !s.isBuiltIn)
            .map((s) => (
              <li key={s.id} className="border-t py-1" style={{ borderColor: 'var(--border)' }}>
                {s.name}
              </li>
            ))}
        </ul>
      </section>

      <section className="panel p-4">
        <h2 className="mb-2 font-semibold">{t('account.referral')}</h2>
        {referral && (
          <>
            <div className="flex items-center gap-2">
              <input className="input flex-1 text-xs" readOnly value={referral.link} />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void navigator.clipboard.writeText(referral.link);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? t('common.copied') : t('common.copy')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  const res = await accountApi.invite({ channel: 'WHATSAPP' });
                  if (res.whatsappUrl) window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                WhatsApp
              </button>
            </div>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('account.referralCount', { count: referral.accepted })}
            </p>
          </>
        )}
      </section>

      <section className="panel p-4">
        <h2 className="mb-2 font-semibold">{t('account.sessions')}</h2>
        <ul className="text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-2 border-t py-1" style={{ borderColor: 'var(--border)' }}>
              <span className="flex-1 truncate">
                {s.ip ?? '—'} · {s.userAgent?.slice(0, 48) ?? '—'}
              </span>
              {s.current ? (
                <span className="chip-tag">{t('account.currentSession')}</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    await accountApi.revokeSession(s.id);
                    setSessions(await accountApi.sessions());
                  }}
                >
                  {t('account.revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
