import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Session } from '@/model/types';
import { IconCheck, IconPencil, IconPlay, IconTrash } from '@/ui/icons';
import { CloudReviews } from './CloudReviews';
import { getRepository } from '@/db/repository';
import type { ImportSummary } from '@/parsers/importer';
import { importText } from '@/parsers/importer';
import { parsers } from '@/parsers/registry';
import { useDateFormatter } from '@/ui/hooks/useFormat';
import { ImportPanel } from './ImportPanel';
import sampleUrl from '../../../samples/pokerstars-demo.txt?url';

export function LibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const df = useDateFormatter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastImport, setLastImport] = useState<ImportSummary[]>([]);
  const [notice, setNotice] = useState<string>('');
  const libraryInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setSessions(await getRepository().listSessions());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onImported = useCallback(
    (summaries: ImportSummary[]) => {
      setLastImport(summaries);
      void refresh();
    },
    [refresh],
  );

  const rename = async (s: Session) => {
    const name = window.prompt(t('library.renamePrompt'), s.name);
    if (name && name.trim() && name !== s.name) {
      await getRepository().renameSession(s.id, name.trim());
      await refresh();
    }
  };

  const toggleStatus = async (session: Session) => {
    await getRepository().saveSessionProgress(session.id, {
      status: session.status === 'completed' ? 'in-progress' : 'completed',
    });
    await refresh();
  };

  const remove = async (s: Session) => {
    if (window.confirm(t('library.confirmDelete', { name: s.name }))) {
      await getRepository().deleteSession(s.id);
      await refresh();
    }
  };

  const exportLibrary = async () => {
    const json = await getRepository().exportLibrary();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poker-replayer-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importLibrary = async (file: File) => {
    const res = await getRepository().importLibrary(await file.text());
    setNotice(t('library.libraryImported', res));
    await refresh();
  };

  const loadSample = async () => {
    const text = await (await fetch(sampleUrl)).text();
    const summary = await importText('pokerstars-demo.txt', text);
    onImported([summary]);
  };

  const siteName = (site: Session['site']) => parsers.find((p) => p.site === site)?.displayName ?? t('common.unknown');

  return (
    <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col gap-5 overflow-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('library.title')}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('app.tagline')}
        </p>
      </div>

      <ImportPanel onImported={onImported} />

      {lastImport.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lastImport.map((s) => (
            <button
              key={s.session.id}
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/replay/${s.session.id}`)}
            >
              {t('library.openInReplayer')} — {s.session.name}
            </button>
          ))}
        </div>
      )}

      <section className="panel overflow-hidden">
        <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold">{t('library.sessions')}</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('common.hands', { count: sessions.reduce((s, x) => s + x.handCount, 0) })}
          </span>
          <div className="flex-1" />
          <button type="button" className="btn" onClick={() => void exportLibrary()} disabled={!sessions.length}>
            {t('library.exportLibrary')}
          </button>
          <button type="button" className="btn" onClick={() => libraryInput.current?.click()}>
            {t('library.importLibrary')}
          </button>
          <input
            ref={libraryInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importLibrary(f);
              e.target.value = '';
            }}
          />
        </header>
        {notice && (
          <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {notice}
          </div>
        )}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            <div>{t('library.empty')}</div>
            <div className="flex items-center gap-2">
              <span>{t('library.sampleTitle')}</span>
              <button type="button" className="btn" onClick={() => void loadSample()}>
                {t('library.loadSample')}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[52vh] overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--surface)' }}>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-3 py-2">{t('library.colName')}</th>
                  <th className="px-3 py-2">{t('library.colFile')}</th>
                  <th className="px-3 py-2">{t('library.colSite')}</th>
                  <th className="px-3 py-2 text-right">{t('library.colHands')}</th>
                  <th className="px-3 py-2">{t('library.colStatus')}</th>
                  <th className="px-3 py-2">{t('library.colImported')}</th>
                  <th className="px-3 py-2">{t('library.colOpened')}</th>
                  <th className="px-3 py-2">{t('library.colPlayers')}</th>
                  <th className="px-3 py-2 text-right">{t('library.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t align-middle" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-3 py-2">
                      <button type="button" className="font-medium hover:underline" onClick={() => navigate(`/replay/${s.id}`)}>
                        {s.name}
                      </button>
                      {s.warnings.length > 0 && (
                        <span className="ml-2 chip-tag" title={s.warnings.slice(0, 10).join('\n')}>
                          {t('common.warnings', { count: s.warnings.length })}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2" style={{ color: 'var(--text-muted)' }} title={s.sourceFileName}>
                      {s.sourceFileName ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{siteName(s.site)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.handCount}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {s.status === 'completed' ? (
                        <span className="chip-tag" style={{ color: 'var(--result-won)', borderColor: 'var(--result-won)' }}>
                          {t('library.statusDone')}
                        </span>
                      ) : (
                        <span className="chip-tag" style={{ color: 'var(--text-muted)' }}>
                          {s.lastHandIndex
                            ? t('library.statusAt', { current: s.lastHandIndex + 1, total: s.handCount })
                            : t('library.statusOpen')}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {df.dateTime(s.importedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {s.lastOpenedAt ? df.dateTime(s.lastOpenedAt) : '—'}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2" title={s.players.join(', ')}>
                      {s.players.slice(0, 4).join(', ')}
                      {s.players.length > 4 ? ` +${s.players.length - 4}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <span className="inline-flex gap-0.5">
                        <button type="button" className="btn-icon" title={t('library.open')} aria-label={t('library.open')} onClick={() => navigate(`/replay/${s.id}`)}>
                          <IconPlay size={15} />
                        </button>
                        <button type="button" className="btn-icon" title={t('common.rename')} aria-label={t('common.rename')} onClick={() => void rename(s)}>
                          <IconPencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title={s.status === 'completed' ? t('library.markOpen') : t('library.markDone')}
                          aria-label={s.status === 'completed' ? t('library.markOpen') : t('library.markDone')}
                          style={s.status === 'completed' ? { color: 'var(--result-won)' } : undefined}
                          onClick={() => void toggleStatus(s)}
                        >
                          <IconCheck size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          style={{ color: 'var(--result-lost)' }}
                          onClick={() => void remove(s)}
                        >
                          <IconTrash size={15} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CloudReviews sessions={sessions} onImported={() => void refresh()} />

      <footer className="mt-6 flex items-center gap-4 pb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link to="/privacidade" className="hover:underline">
          {t('legal.privacy')}
        </Link>
        <Link to="/termos" className="hover:underline">
          {t('legal.terms')}
        </Link>
      </footer>
    </div>
  );
}
