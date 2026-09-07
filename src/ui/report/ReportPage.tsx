import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/store';
import { buildReport, handHeadline, type ReportData } from '@/report/buildReport';
import { exportDocx, exportPdf } from '@/report/export';
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

  useEffect(() => {
    if (sessionId && session?.id !== sessionId) void loadSession(sessionId);
  }, [sessionId, session?.id, loadSession]);

  useEffect(() => {
    if (!hands.length) return;
    void buildReport(hands, session?.name ?? t('report.title'), tags).then(setReport);
  }, [hands, session?.name, tags, t]);

  const labels = { notes: t('review.notes'), tags: t('review.tags'), rating: t('review.rating') };

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
