import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Session } from '@/model/types';
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
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-auto p-6">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-4 py-2">{t('library.colName')}</th>
                  <th className="px-4 py-2">{t('library.colSite')}</th>
                  <th className="px-4 py-2 text-right">{t('library.colHands')}</th>
                  <th className="px-4 py-2">{t('library.colStatus')}</th>
                  <th className="px-4 py-2">{t('library.colDate')}</th>
                  <th className="px-4 py-2">{t('library.colPlayers')}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2">
                      <button type="button" className="font-medium hover:underline" onClick={() => navigate(`/replay/${s.id}`)}>
                        {s.name}
                      </button>
                      {s.warnings.length > 0 && (
                        <span className="ml-2 chip-tag" title={s.warnings.slice(0, 10).join('\n')}>
                          {t('common.warnings', { count: s.warnings.length })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{siteName(s.site)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.handCount}</td>
                    <td className="whitespace-nowrap px-4 py-2">
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
                    <td className="px-4 py-2 whitespace-nowrap">{df.dateTime(s.firstHandAt ?? s.importedAt)}</td>
                    <td className="max-w-[320px] truncate px-4 py-2" title={s.players.join(', ')}>
                      {s.players.slice(0, 6).join(', ')}
                      {s.players.length > 6 ? ` +${s.players.length - 6}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button type="button" className="btn btn-ghost" onClick={() => navigate(`/replay/${s.id}`)}>
                        {t('library.open')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => void rename(s)}>
                        {t('common.rename')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => void toggleStatus(s)}>
                        {s.status === 'completed' ? t('library.markOpen') : t('library.markDone')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => void remove(s)}>
                        {t('common.delete')}
                      </button>
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
