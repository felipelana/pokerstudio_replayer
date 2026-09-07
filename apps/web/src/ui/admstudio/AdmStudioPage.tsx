import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COUNTRIES, countryName } from '@pokerstudio/shared';
import {
  adminApi,
  type AdminAccessLogRow,
  type AdminEmailRow,
  type AdminEmailSettings,
  type AdminStats,
  type AdminUserDetail,
  type AdminUserRow,
} from '@/infrastructure/http/adminApi';
import { ApiError } from '@/infrastructure/http/client';
import { useAuthStore } from '@/state/authStore';
import { TwoFactorGate } from './TwoFactorGate';

type Tab = 'dashboard' | 'users' | 'access' | 'email';

/**
 * /admstudio — the administrative area. The role is checked here for the sake
 * of the interface; every request is checked again on the server, which is what
 * actually protects the data.
 */
export function AdmStudioPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('dashboard');

  if (user && user.role !== 'ADMIN') {
    return (
      <div className="mx-auto h-full max-w-[520px] overflow-auto p-6">
        <div className="panel p-6">
          <h1 className="text-lg font-semibold">{t('admstudio.forbiddenTitle')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('admstudio.forbiddenBody')}
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: t('admstudio.dashboard') },
    { id: 'users', label: t('admstudio.users') },
    { id: 'access', label: t('admstudio.access') },
    { id: 'email', label: t('admstudio.email') },
  ];

  return (
    <div className="mx-auto flex h-full max-w-[1180px] flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{t('admstudio.title')}</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('admstudio.subtitle')}
          </p>
        </div>
        <a className="btn" href={adminApi.usersCsvUrl} download>
          {t('admstudio.exportCsv')}
        </a>
      </header>

      <nav className="flex flex-wrap gap-1" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-auto">
        <TwoFactorGate>
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'access' && <AccessTab />}
          {tab === 'email' && <EmailTab />}
        </TwoFactorGate>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/** Runs a request once and keeps its state, so every tab reports errors alike. */
function useLoader<T>(load: () => Promise<T>, deps: unknown[]): { data?: T; error: string; busy: boolean; reload: () => void } {
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

function Empty({ busy, error, empty }: { busy: boolean; error: string; empty?: boolean }) {
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

const dateTime = (value: string | Date) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

function StatusChip({ status }: { status: string }) {
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

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function DashboardTab() {
  const { t } = useTranslation();
  const { data, error, busy } = useLoader<AdminStats>(() => adminApi.stats(), []);

  const totals = useMemo(() => {
    if (!data) return { users: 0, active: 0, blocked: 0, signups30: 0, logins30: 0 };
    const count = (rows: { _count: number }[]) => rows.reduce((sum, row) => sum + row._count, 0);
    const of = (status: string) => data.byStatus.find((row) => row.status === status)?._count ?? 0;
    return {
      users: count(data.byStatus),
      active: of('ACTIVE'),
      blocked: of('BLOCKED'),
      signups30: data.signups.reduce((sum, row) => sum + row.value, 0),
      logins30: data.logins.reduce((sum, row) => sum + row.value, 0),
    };
  }, [data]);

  if (!data) return <Empty busy={busy} error={error} />;

  const cards = [
    { label: t('admstudio.totalUsers'), value: totals.users },
    { label: t('admstudio.activeUsers'), value: totals.active },
    { label: t('admstudio.blockedUsers'), value: totals.blocked },
    { label: t('admstudio.signups30'), value: totals.signups30 },
    { label: t('admstudio.logins30'), value: totals.logins30 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {cards.map((card) => (
          <div key={card.label} className="panel p-4">
            <div className="label-caps">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Sparkline title={t('admstudio.signupsChart')} rows={data.signups} />
        <Sparkline title={t('admstudio.loginsChart')} rows={data.logins} />
        <Breakdown
          title={t('admstudio.devices')}
          rows={data.devices.map((row) => ({ label: row.deviceType ?? '—', value: row._count }))}
        />
        <Breakdown
          title={t('admstudio.topSkins')}
          rows={data.topSkins.map((row) => ({ label: row.skinId ?? '—', value: row._count }))}
        />
      </div>
    </div>
  );
}

/** Thirty days of counts, drawn as bars — no chart dependency for five numbers. */
const WINDOW_DAYS = 30;

function Sparkline({ title, rows }: { title: string; rows: { day: string; value: number }[] }) {
  const { t } = useTranslation();
  const series = useMemo(() => fillDays(rows, WINDOW_DAYS), [rows]);
  const max = Math.max(1, ...series.map((row) => row.value));
  return (
    <div className="panel p-4">
      <div className="label-caps mb-2">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('admstudio.nothing')}
        </p>
      ) : (
        <div className="flex h-24 items-end gap-[3px]">
          {series.map((row) => (
            <div
              key={row.day}
              title={`${new Date(row.day).toLocaleDateString()} — ${row.value}`}
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max(4, (row.value / max) * 100)}%`,
                background: 'var(--accent)',
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const { t } = useTranslation();
  const total = Math.max(1, rows.reduce((sum, row) => sum + row.value, 0));
  return (
    <div className="panel p-4">
      <div className="label-caps mb-2">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('admstudio.nothing')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-2">
              <span className="w-28 truncate" title={row.label}>
                {row.label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(row.value / total) * 100}%`, background: 'var(--accent)' }}
                />
              </span>
              <span className="w-10 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pads a sparse day/value series so every day in the window has a bar. */
function fillDays(rows: { day: string; value: number }[], days: number): { day: string; value: number }[] {
  const byDay = new Map(rows.map((row) => [new Date(row.day).toISOString().slice(0, 10), row.value]));
  const out: { day: string; value: number }[] = [];
  const today = new Date();
  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(today.getTime() - back * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, value: byDay.get(day) ?? 0 });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 25;

function UsersTab() {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();

  const { data, error, busy, reload } = useLoader(
    () => adminApi.users({ q: search, status, country, page, pageSize: PAGE_SIZE }),
    [search, status, country, page],
  );

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.search')}</span>
          <input className="input w-[240px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admstudio.searchHint')} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.status')}</span>
          <select
            className="input w-[150px]"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">{t('admstudio.any')}</option>
            {['PENDING', 'ACTIVE', 'BLOCKED', 'DELETED'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.country')}</span>
          <select
            className="input w-[190px]"
            value={country}
            onChange={(e) => {
              setPage(1);
              setCountry(e.target.value);
            }}
          >
            <option value="">{t('admstudio.any')}</option>
            {COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>
                {countryName(item.code, i18n.language)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn">
          {t('admstudio.apply')}
        </button>
      </form>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th className="p-2 text-left font-medium">{t('admstudio.colUser')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colStatus')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colCountry')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colCreated')}</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <UserRow key={row.id} row={row} onOpen={() => setSelected(row.id)} />
            ))}
          </tbody>
        </table>
        <Empty busy={busy} error={error} empty={data?.items.length === 0} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text-muted)' }}>{t('admstudio.totalRows', { count: data?.total ?? 0 })}</span>
        <span className="flex items-center gap-2">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <button type="button" className="btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            →
          </button>
        </span>
      </div>

      {selected && <UserDrawer id={selected} onClose={() => setSelected(undefined)} onChanged={reload} />}
    </div>
  );
}

function UserRow({ row, onOpen }: { row: AdminUserRow; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td className="p-2">
        <div className="font-medium">
          {row.name}
          {row.role === 'ADMIN' && <span className="chip-tag ml-2">admin</span>}
          {!row.emailVerified && (
            <span className="ml-2 text-xs" style={{ color: 'var(--result-break-even)' }}>
              {t('account.unverified')}
            </span>
          )}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {row.email}
        </div>
      </td>
      <td className="p-2">
        <StatusChip status={row.status} />
      </td>
      <td className="p-2">{countryName(row.countryCode, i18n.language)}</td>
      <td className="p-2 tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {dateTime(row.createdAt)}
      </td>
      <td className="p-2 text-right">
        <button type="button" className="btn" onClick={onOpen}>
          {t('admstudio.open')}
        </button>
      </td>
    </tr>
  );
}

/** The full record of one account, with the three actions the admin can take. */
function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const { data, error, busy, reload } = useLoader<AdminUserDetail>(() => adminApi.user(id), [id]);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setAction('');
      try {
        await fn();
        reload();
        onChanged();
      } catch (err) {
        setAction(err instanceof ApiError ? err.problem.title : t('auth.offline'));
      }
    },
    [reload, onChanged, t],
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[560px] flex-col gap-4 overflow-auto p-4"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{data?.user.name ?? '…'}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {data?.user.email}
            </p>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            {t('admstudio.close')}
          </button>
        </header>

        <Empty busy={busy} error={error} />

        {data && (
          <>
            <section className="panel p-3 text-sm">
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <Field label={t('admstudio.colStatus')}>
                  <StatusChip status={data.user.status} />
                </Field>
                <Field label={t('admstudio.plan')}>{data.user.plan}</Field>
                <Field label={t('admstudio.colCountry')}>{countryName(data.user.countryCode, i18n.language)}</Field>
                <Field label={t('auth.language')}>{data.user.language}</Field>
                <Field label={t('admstudio.referralCode')}>{data.user.referralCode}</Field>
                <Field label={t('admstudio.identities')}>{data.identities.join(', ') || '—'}</Field>
              </div>
            </section>

            <section className="flex flex-wrap items-end gap-2">
              {data.user.status === 'BLOCKED' ? (
                <button type="button" className="btn" onClick={() => run(() => adminApi.unblock(id))}>
                  {t('admstudio.unblock')}
                </button>
              ) : (
                <>
                  <label className="flex flex-1 flex-col text-sm">
                    <span className="label">{t('admstudio.blockReason')}</span>
                    <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    style={{ color: 'var(--result-lost)' }}
                    disabled={reason.trim().length < 3}
                    onClick={() => run(() => adminApi.block(id, reason.trim()))}
                  >
                    {t('admstudio.block')}
                  </button>
                </>
              )}
              <button type="button" className="btn" onClick={() => run(() => adminApi.revokeSessions(id))}>
                {t('admstudio.revokeSessions')}
              </button>
            </section>
            {action && (
              <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
                {action}
              </p>
            )}

            <section>
              <h3 className="label-caps mb-1">{t('admstudio.sessions')}</h3>
              <ul className="flex flex-col gap-1 text-xs">
                {data.sessions.length === 0 && <li style={{ color: 'var(--text-muted)' }}>{t('admstudio.nothing')}</li>}
                {data.sessions.map((session) => (
                  <li key={session.id} className="flex justify-between gap-2 panel p-2">
                    <span className="truncate">{session.userAgent ?? '—'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {session.revokedAt ? t('admstudio.revoked') : dateTime(session.expiresAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="label-caps mb-1">{t('admstudio.recentAccess')}</h3>
              <LogList rows={data.logs} />
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Access log                                                          */
/* ------------------------------------------------------------------ */

const EVENTS = [
  'SIGNUP',
  'LOGIN_OK',
  'LOGIN_FAIL',
  'LOGOUT',
  'VERIFY',
  'RESET_REQUEST',
  'RESET_OK',
  'BLOCKED_ATTEMPT',
  'ADMIN_BLOCK',
  'ADMIN_UNBLOCK',
  'SESSION_REVOKE',
  'TOTP_ENROLLED',
  'TOTP_FAIL',
  'RECOVERY_CODE_USED',
  'GOOGLE_LINKED',
  'GOOGLE_UNLINKED',
];

function AccessTab() {
  const { t } = useTranslation();
  const [event, setEvent] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, error, busy } = useLoader(
    () => adminApi.accessLogs({ event, from: from || undefined, to: to || undefined, page, pageSize: 50 }),
    [event, from, to, page],
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.event')}</span>
          <select
            className="input w-[190px]"
            value={event}
            onChange={(e) => {
              setPage(1);
              setEvent(e.target.value);
            }}
          >
            <option value="">{t('admstudio.any')}</option>
            {EVENTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.from')}</span>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.to')}</span>
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
        </label>
      </div>

      <div className="panel p-2">
        <LogList rows={data?.items ?? []} />
        <Empty busy={busy} error={error} empty={data?.items.length === 0} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text-muted)' }}>{t('admstudio.totalRows', { count: data?.total ?? 0 })}</span>
        <span className="flex items-center gap-2">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <button type="button" className="btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            →
          </button>
        </span>
      </div>
    </div>
  );
}

function LogList({ rows }: { rows: AdminAccessLogRow[] }) {
  return (
    <ul className="flex flex-col text-xs">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5" style={{ borderTop: '1px solid var(--border)' }}>
          <span
            className="w-[168px] shrink-0 font-medium"
            style={{ color: row.event.endsWith('FAIL') || row.event.includes('BLOCK') ? 'var(--result-lost)' : 'var(--text)' }}
          >
            {row.event}
          </span>
          <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {dateTime(row.createdAt)}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{row.ip ?? '—'}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {[row.deviceType, row.os, row.browser].filter(Boolean).join(' · ') || '—'}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* E-mail                                                              */
/* ------------------------------------------------------------------ */

/** Provider, sender and the switch that makes e-mail verification mandatory. */
function EmailSettingsForm() {
  const { t } = useTranslation();
  const { data, error, busy, reload } = useLoader<AdminEmailSettings>(() => adminApi.emailSettings(), []);
  const [form, setForm] = useState<AdminEmailSettings>();
  const [secret, setSecret] = useState('');
  const [testTo, setTestTo] = useState('');
  const [state, setState] = useState({ busy: false, message: '', failed: false });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!form) return <Empty busy={busy} error={error} />;

  const set = <K extends keyof AdminEmailSettings>(key: K, value: AdminEmailSettings[K]) =>
    setForm({ ...form, [key]: value });

  const save = async () => {
    setState({ busy: true, message: '', failed: false });
    try {
      await adminApi.saveEmailSettings({ ...form, secret: secret || undefined });
      setSecret('');
      reload();
      setState({ busy: false, message: t('admstudio.saved'), failed: false });
    } catch (err) {
      setState({ busy: false, message: err instanceof ApiError ? err.problem.title : t('auth.offline'), failed: true });
    }
  };

  const test = async () => {
    setState({ busy: true, message: '', failed: false });
    try {
      const result = await adminApi.testEmail(testTo);
      setState({
        busy: false,
        message: result.delivered ? t('admstudio.testSent') : result.detail ?? t('admstudio.testFailed'),
        failed: !result.delivered,
      });
      reload();
    } catch (err) {
      setState({ busy: false, message: err instanceof ApiError ? err.problem.title : t('auth.offline'), failed: true });
    }
  };

  return (
    <section className="panel p-4">
      <h3 className="mb-2 font-semibold">{t('admstudio.emailSettings')}</h3>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.provider')}
          <select className="input" value={form.provider} onChange={(e) => set('provider', e.target.value as AdminEmailSettings['provider'])}>
            <option value="NONE">{t('admstudio.providerNone')}</option>
            <option value="RESEND">Resend</option>
            <option value="SMTP">SMTP</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.fromAddress')}
          <input className="input" type="email" value={form.fromAddress ?? ''} onChange={(e) => set('fromAddress', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.fromName')}
          <input className="input" value={form.fromName ?? ''} onChange={(e) => set('fromName', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.replyTo')}
          <input className="input" type="email" value={form.replyTo ?? ''} onChange={(e) => set('replyTo', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {form.hasSecret ? t('admstudio.replaceKey') : t('admstudio.providerKey')}
          <input
            className="input"
            type="password"
            autoComplete="off"
            placeholder={form.hasSecret ? '••••••••' : ''}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </label>
      </div>

      <label className="checkbox mt-3">
        <input
          type="checkbox"
          checked={form.requireVerification}
          onChange={(e) => set('requireVerification', e.target.checked)}
        />
        {t('admstudio.requireVerification')}
      </label>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <button type="button" className="btn btn-primary" disabled={state.busy} onClick={() => void save()}>
          {state.busy ? t('auth.working') : t('account.save')}
        </button>
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.testTo')}
          <input className="input" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        </label>
        <button type="button" className="btn" disabled={state.busy || !testTo} onClick={() => void test()}>
          {t('admstudio.sendTest')}
        </button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('admstudio.queued', { count: form.pending })}
        </span>
      </div>

      {state.message && (
        <p className="mt-2 text-sm" role="alert" style={{ color: state.failed ? 'var(--result-lost)' : 'var(--result-won)' }}>
          {state.message}
        </p>
      )}
      {form.lastError && !state.message && (
        <p className="mt-2 text-xs" style={{ color: 'var(--result-lost)' }}>
          {form.lastError}
        </p>
      )}
    </section>
  );
}

function EmailTab() {
  const { t } = useTranslation();
  const { data, error, busy } = useLoader<AdminEmailRow[]>(() => adminApi.emailOutbox(), []);

  return (
    <div className="flex flex-col gap-3">
      <EmailSettingsForm />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('admstudio.emailHint')}
      </p>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th className="p-2 text-left font-medium">{t('admstudio.colTo')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colSubject')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colStatus')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colCreated')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="p-2">{row.to}</td>
                <td className="p-2">{row.subject}</td>
                <td className="p-2">
                  <StatusChip status={row.status} />
                  {row.error && (
                    <div className="text-xs" style={{ color: 'var(--result-lost)' }}>
                      {row.error}
                    </div>
                  )}
                </td>
                <td className="p-2 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {dateTime(row.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Empty busy={busy} error={error} empty={data?.length === 0} />
      </div>
    </div>
  );
}
