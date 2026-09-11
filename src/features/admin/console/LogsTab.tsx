import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type ErrorLevel, type ErrorSource } from '@/lib/infrastructure/http/adminApi';
import { Empty, dateTime, useLoader } from './shared';

/**
 * What has been failing.
 *
 * The counts at the top are always the last 24 hours and always ignore the
 * filters, because the question this screen is opened with — is something
 * broken right now — must not change its answer when somebody narrows the
 * table underneath it. The table is the second question: what exactly, and
 * where.
 */

const LEVELS: ErrorLevel[] = ['WARN', 'ERROR', 'FATAL'];
const SOURCES: ErrorSource[] = ['SERVER', 'CLIENT'];
const PAGE_SIZE = 50;

function levelColour(level: ErrorLevel): string {
  return level === 'WARN' ? 'var(--result-break-even)' : 'var(--result-lost)';
}

export function LogsTab() {
  const { t } = useTranslation();
  const [level, setLevel] = useState('');
  const [source, setSource] = useState('');
  const [env, setEnv] = useState('');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();

  const { data, error, busy, reload } = useLoader(
    () =>
      adminApi.errorLogs({
        level: level || undefined,
        source: source || undefined,
        env: env || undefined,
        q: query || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [level, source, env, query, from, to, page],
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  /** Any change of filter starts reading from the first page again. */
  const change = (apply: () => void) => {
    setPage(1);
    apply();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['FATAL', 'ERROR', 'WARN'] as ErrorLevel[]).map((value) => (
          <div key={value} className="panel p-3">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t(`admstudio.levels.${value}`)} · {t('admstudio.last24h')}
            </div>
            <div
              className="mt-1 text-2xl font-semibold tabular-nums"
              style={{ color: levelColour(value) }}
            >
              {data?.summary.find((s) => s.level === value)?.count ?? 0}
            </div>
          </div>
        ))}
        <div className="panel flex flex-col justify-between p-3">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('admstudio.totalRows', { count: data?.total ?? 0 })}
          </div>
          <button type="button" className="btn mt-1" onClick={reload}>
            {t('admstudio.refresh')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.level')}</span>
          <select
            className="input w-[140px]"
            value={level}
            onChange={(e) => change(() => setLevel(e.target.value))}
          >
            <option value="">{t('admstudio.any')}</option>
            {LEVELS.map((value) => (
              <option key={value} value={value}>
                {t(`admstudio.levels.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.source')}</span>
          <select
            className="input w-[140px]"
            value={source}
            onChange={(e) => change(() => setSource(e.target.value))}
          >
            <option value="">{t('admstudio.any')}</option>
            {SOURCES.map((value) => (
              <option key={value} value={value}>
                {t(`admstudio.sources.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.environment')}</span>
          <input
            className="input w-[140px]"
            value={env}
            placeholder={t('admstudio.any')}
            onChange={(e) => change(() => setEnv(e.target.value.trim()))}
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.from')}</span>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => change(() => setFrom(e.target.value))}
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="label">{t('admstudio.to')}</span>
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => change(() => setTo(e.target.value))}
          />
        </label>

        <label className="flex min-w-[200px] flex-1 flex-col text-sm">
          <span className="label">{t('admstudio.search')}</span>
          <input
            className="input"
            value={draft}
            placeholder={t('admstudio.logSearchHint')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && change(() => setQuery(draft.trim()))}
          />
        </label>

        <button type="button" className="btn" onClick={() => change(() => setQuery(draft.trim()))}>
          {t('admstudio.apply')}
        </button>
      </div>

      <div className="panel overflow-x-auto p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
              <th className="p-2">{t('admstudio.level')}</th>
              <th className="p-2">{t('admstudio.colWhen')}</th>
              <th className="p-2">{t('admstudio.source')}</th>
              <th className="p-2">{t('admstudio.colMessage')}</th>
              <th className="p-2">{t('admstudio.colRoute')}</th>
              <th className="p-2">{t('admstudio.environment')}</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="p-2">
                  <span
                    className="chip-tag"
                    style={{ color: levelColour(row.level), borderColor: levelColour(row.level) }}
                  >
                    {t(`admstudio.levels.${row.level}`)}
                  </span>
                </td>
                <td
                  className="whitespace-nowrap p-2 tabular-nums"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {dateTime(row.createdAt)}
                </td>
                <td className="p-2" style={{ color: 'var(--text-muted)' }}>
                  {t(`admstudio.sources.${row.source}`)}
                </td>
                <td className="max-w-[380px] truncate p-2" title={row.message}>
                  {row.message}
                </td>
                <td
                  className="max-w-[240px] truncate p-2 font-mono text-xs"
                  style={{ color: 'var(--text-muted)' }}
                  title={row.route}
                >
                  {row.route ?? '-'}
                </td>
                <td
                  className="whitespace-nowrap p-2 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {row.env}
                  {row.release ? ` · ${row.release}` : ''}
                </td>
                <td className="p-2 text-right">
                  <button type="button" className="btn btn-ghost" onClick={() => setOpenId(row.id)}>
                    {t('admstudio.open')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Empty busy={busy} error={error} empty={data?.items.length === 0} />
      </div>

      {openId && <ErrorDetail id={openId} onClose={() => setOpenId(undefined)} />}

      <div className="flex items-center justify-end gap-2 text-sm">
        <button
          type="button"
          className="btn"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          ←
        </button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <button
          type="button"
          className="btn"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          →
        </button>
      </div>
    </div>
  );
}

/** One failure in full. The stack is the reason this screen exists at all. */
function ErrorDetail({ id, onClose }: { id: string; onClose(): void }) {
  const { t } = useTranslation();
  const { data, error, busy } = useLoader(() => adminApi.errorLog(id), [id]);

  return (
    <section className="panel flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{data?.message ?? t('admstudio.loading')}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t('admstudio.close')}
        </button>
      </div>

      <Empty busy={busy} error={error} />

      {data && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <Field label={t('admstudio.level')} value={t(`admstudio.levels.${data.level}`)} />
            <Field label={t('admstudio.source')} value={t(`admstudio.sources.${data.source}`)} />
            <Field
              label={t('admstudio.environment')}
              value={`${data.env}${data.release ? ` · ${data.release}` : ''}`}
            />
            <Field label={t('admstudio.colWhen')} value={dateTime(data.createdAt)} />
            <Field label={t('admstudio.colRoute')} value={data.route ?? '-'} />
            <Field
              label={t('admstudio.colStatusCode')}
              value={data.statusCode ? String(data.statusCode) : '-'}
            />
            <Field label={t('admstudio.colRequestId')} value={data.requestId ?? '-'} />
            <Field label={t('admstudio.colUser')} value={data.userId ?? '-'} />
          </dl>

          {data.userAgent && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {data.userAgent}
            </p>
          )}

          {data.context && Object.keys(data.context).length > 0 && (
            <pre
              className="max-h-[160px] overflow-auto rounded p-2 font-mono text-[11px]"
              style={{ background: 'var(--bg-elevated, var(--bg))' }}
            >
              {JSON.stringify(data.context, null, 2)}
            </pre>
          )}

          <pre
            className="max-h-[320px] overflow-auto rounded p-2 font-mono text-[11px]"
            style={{ background: 'var(--bg-elevated, var(--bg))' }}
          >
            {data.stack ?? t('admstudio.noStack')}
          </pre>
        </>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="break-all font-mono">{value}</dd>
    </div>
  );
}
