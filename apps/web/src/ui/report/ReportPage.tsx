import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/store';
import { buildReport, handHeadline, type ReportData } from '@/report/buildReport';
import type { UserTag } from '@/model/types';
import { exportDocx, exportPdf } from '@/report/export';
import { leakLabel } from '@/report/assessment';
import { useCoachReadings } from '@/ui/hooks/useCoachReadings';
import { formatScore } from '@pokerstudio/shared';
import { IconClose } from '@/ui/icons';

/** Report preview with the export step (L4). Everything runs in the browser. */
export function ReportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const session = useAppStore((s) => s.session);
  const hands = useAppStore((s) => s.hands);
  const loadSession = useAppStore((s) => s.loadSession);
  const tags = useAppStore((s) => s.settings.leakTags);
  const [report, setReport] = useState<ReportData>();
  const [busy, setBusy] = useState(false);
  const coaches = useCoachReadings(sessionId);

  useEffect(() => {
    if (sessionId && session?.id !== sessionId) void loadSession(sessionId);
  }, [sessionId, session?.id, loadSession]);

  useEffect(() => {
    if (!hands.length) return;
    void buildReport(hands, session?.name ?? t('report.title'), tags, coaches).then(setReport);
  }, [hands, session?.name, tags, t, coaches]);

  const labels = {
    notes: t('review.notes'),
    tags: t('review.tags'),
    rating: t('review.rating'),
    summary: t('report.summary'),
    score: t('report.score'),
    coverage: t('report.coverage'),
    noCoverage: t('report.noCoverage'),
    leaks: t('report.leaks'),
    coach: t('review.coachTitle'),
    noScore: t('report.noScore'),
  };

  if (!report) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-[860px] flex-col gap-4 overflow-auto p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{t('report.title')}</h1>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('report.count', { count: report.items.length })}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!report.items.length || busy}
          onClick={() => {
            setBusy(true);
            exportPdf(report, labels);
            setBusy(false);
          }}
        >
          {t('report.savePdf')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!report.items.length || busy}
          onClick={async () => {
            setBusy(true);
            await exportDocx(report, labels);
            setBusy(false);
          }}
        >
          {t('report.saveDocx')}
        </button>
        <button type="button" className="btn-icon" onClick={() => navigate(-1)} aria-label={t('common.close')}>
          <IconClose size={15} />
        </button>
      </div>

      <Numbers report={report} tags={tags} />

      {report.items.length === 0 ? (
        <p className="panel p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('report.empty')}
        </p>
      ) : (
        report.items.map((item) => (
          <article key={item.hand.id} className="panel flex flex-col gap-2 p-4">
            <h2 className="font-semibold">{handHeadline(item)}</h2>
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span key={tag.id} className="rounded-full px-2 py-[2px] text-[11px] text-white" style={{ background: tag.color }}>
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
            {item.review.rating && <div className="text-sm">{'★'.repeat(item.review.rating)}</div>}
            {item.image && <img src={item.image} alt="" className="w-full rounded-md" />}
            {item.review.notes.trim() && <p className="whitespace-pre-wrap text-sm">{item.review.notes}</p>}
            {item.coaches.map((c) => (
              <div
                key={c.name}
                className="rounded-md border p-2 text-sm"
                style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
              >
                <span className="text-xs font-semibold">{c.name}</span>
                {typeof c.reading.score === 'number' && (
                  <span className="ml-2 text-xs tabular-nums" style={{ color: 'var(--accent)' }}>
                    {c.reading.score}/100
                  </span>
                )}
                {c.reading.comment && <p className="mt-0.5 whitespace-pre-wrap">{c.reading.comment}</p>}
              </div>
            ))}
            {Object.entries(item.review.streetNotes ?? {}).map(([street, note]) =>
              note?.trim() ? (
                <p key={street} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  <strong>{t(`streets.${street}`)}:</strong> {note}
                </p>
              ) : null,
            )}
          </article>
        ))
      )}
    </div>
  );
}

/**
 * The three numbers the report is really about: what the reader scored, how
 * much of what they played they have actually been through, and which leaks
 * came up most. Each coach who read the session gets the same three, so the
 * readings can be compared without either being restated.
 */
function Numbers({ report, tags }: { report: ReportData; tags: UserTag[] }) {
  const { t } = useTranslation();

  const card = (
    title: string,
    value: string,
    detail: string,
    accent = false,
  ) => (
    <div className="panel flex flex-col gap-0.5 p-3" key={title + value}>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {title}
      </span>
      <span className="text-2xl font-semibold tabular-nums" style={{ color: accent ? 'var(--accent)' : undefined }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {detail}
      </span>
    </div>
  );

  // A session where the hero folded every hand has nothing to cover. That is
  // not the same as having no score, and it should not read as one.
  const pct = (value: number | null) => (value === null ? t('report.noCoverage') : `${Math.round(value)}%`);

  return (
    <section className="flex flex-col gap-3" aria-label={t('report.summary')}>
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {t('report.summary')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {card(
          t('report.score'),
          formatScore(report.summary.score) ?? t('report.noScore'),
          t('report.scoreDetail', { count: report.summary.scored }),
          true,
        )}
        {card(
          t('report.coverage'),
          pct(report.summary.coverage.percent),
          t('report.coverageDetail', { reviewed: report.summary.coverage.reviewed, total: report.summary.coverage.total }),
        )}
        {card(t('report.reviewed'), String(report.summary.reviewedHands), t('report.reviewedDetail'))}
      </div>

      {report.summary.leaks.length > 0 && (
        <div className="panel p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {t('report.leaks')}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {report.summary.leaks.slice(0, 8).map((leak) => (
              <li key={leak.tag} className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: 'var(--border)' }}>
                {leakLabel(leak.tag, tags)}
                <span className="ml-1.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {leak.hands}
                  {leak.percent === null ? '' : ` · ${Math.round(leak.percent)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.coaches.length > 0 && (
        <div className="panel p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {t('report.coachNumbers')}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {report.coaches.map((coach) => (
              <li key={coach.name} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="font-semibold">{coach.name}</span>
                <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                  {formatScore(coach.summary.score.value) ?? t('report.noScore')}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('report.coverage')}: {pct(coach.summary.coverage.percent)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {coach.completed ? t('share.stateDone') : t('share.stateReading')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
