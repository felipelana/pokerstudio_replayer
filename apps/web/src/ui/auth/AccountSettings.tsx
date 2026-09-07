import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { COUNTRIES, countryName } from '@pokerstudio/shared';
import { accountApi, type Me } from '@/infrastructure/http/accountApi';
import { ApiError } from '@/infrastructure/http/client';
import { useAuthStore } from '@/state/authStore';
import { useAppStore } from '@/state/store';
import { LanguageChoice } from '@/ui/LanguageChoice';

/** Editable profile: the fields the owner may change without support. */
export function ProfileEditor({ user }: { user: Me }) {
  const { t, i18n } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({
    name: user.name,
    countryCode: user.countryCode,
    language: user.language,
    phone: user.phoneE164 ?? '',
  });
  const [state, setState] = useState<{ busy: boolean; error: string; saved: boolean }>({
    busy: false,
    error: '',
    saved: false,
  });

  const dirty =
    form.name !== user.name ||
    form.countryCode !== user.countryCode ||
    form.language !== user.language ||
    form.phone !== (user.phoneE164 ?? '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '', saved: false });
    try {
      const updated = await accountApi.updateProfile({
        name: form.name,
        countryCode: form.countryCode,
        language: form.language,
        phone: form.phone.trim() === '' ? null : form.phone,
      });
      setUser(updated);
      // The account language wins over the local preference, and is persisted
      // locally too — otherwise a reload would silently undo the change.
      if (updated.language !== i18n.language) {
        void useAppStore.getState().updateSettings({ language: updated.language });
        void i18n.changeLanguage(updated.language);
      }
      setState({ busy: false, error: '', saved: true });
    } catch (err) {
      setState({ busy: false, error: err instanceof ApiError ? err.problem.title : t('auth.offline'), saved: false });
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      <label className="flex flex-col gap-1 text-sm">
        {t('auth.name')}
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('auth.phone')}
        <input
          className="input"
          value={form.phone}
          placeholder="+55 11 91234-5678"
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('auth.country')}
        <select className="input" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {countryName(c.code, i18n.language)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('auth.language')}
        <LanguageChoice value={form.language} onChange={(code) => setForm({ ...form, language: code })} />
      </label>
      <div className="col-span-full flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={state.busy || !dirty}>
          {state.busy ? t('auth.working') : t('account.save')}
        </button>
        {state.saved && !dirty && (
          <span className="text-sm" style={{ color: 'var(--result-won)' }}>
            {t('account.saved')}
          </span>
        )}
        {state.error && (
          <span className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

/** Password: changing one, or setting the first on a provider-only account. */
export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [state, setState] = useState({ busy: false, error: '', done: false });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '', done: false });
    try {
      await accountApi.changePassword(next, hasPassword ? current : undefined);
      setCurrent('');
      setNext('');
      setState({ busy: false, error: '', done: true });
    } catch (err) {
      setState({ busy: false, error: err instanceof ApiError ? err.problem.title : t('auth.offline'), done: false });
    }
  };

  return (
    <section className="panel p-4">
      <h2 className="mb-1 font-semibold">{hasPassword ? t('account.changePassword') : t('account.setPassword')}</h2>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {hasPassword ? t('account.changePasswordHint') : t('account.setPasswordHint')}
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        {hasPassword && (
          <label className="flex flex-col gap-1 text-sm">
            {t('account.currentPassword')}
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          {t('account.newPassword')}
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={10}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={state.busy || next.length < 10}>
          {state.busy ? t('auth.working') : t('account.save')}
        </button>
        {state.done && (
          <span className="text-sm" style={{ color: 'var(--result-won)' }}>
            {t('account.passwordChanged')}
          </span>
        )}
        {state.error && (
          <span className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
            {state.error}
          </span>
        )}
      </form>
    </section>
  );
}
