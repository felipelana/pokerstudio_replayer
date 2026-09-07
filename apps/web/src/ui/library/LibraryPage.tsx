import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Session } from '@/model/types';
import { IconCheck, IconDownload, IconPencil, IconPlay, IconTrash } from '@/ui/icons';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { PromptDialog } from '@/ui/PromptDialog';
import { CloudReviews } from './CloudReviews';
import { getRepository } from '@/db/repository';
import type { ImportSummary } from '@/parsers/importer';
import { importText } from '@/parsers/importer';
import { parsers } from '@/parsers/registry';
import { useDateFormatter } from '@/ui/hooks/useFormat';
import { ImportPanel } from './ImportPanel';
import sampleUrl from '../../../samples/pokerstars-demo.txt?url';

/**
 * Width of each frozen column, and where it sits once the table scrolls
 * sideways. Fixed widths are what makes the offsets predictable.
 */
const FROZEN_WIDTHS = [190, 190, 110];

/** Sessions shown per page. */
const PAGE_SIZE = 10;

function frozen(index: number): React.CSSProperties {
  const left = 36 + FROZEN_WIDTHS.slice(0, index).reduce((sum, w) => sum + w, 0);
  return {
    position: 'sticky',
    left,
    zIndex: 2,
    width: FROZEN_WIDTHS[index],
    minWidth: FROZEN_WIDTHS[index],
    maxWidth: FROZEN_WIDTHS[index],
  };
}

export function LibraryPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<'all' | 'selected' | undefined>(undefined);
  const [pageIndex, setPageIndex] = useState(0);
  const [renaming, setRenaming] = useState<Session>();
  const renameResolver = useRef<((name: string | undefined) => void) | undefined>(undefined);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const df = useDateFormatter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastImport, setLastImport] = useState<ImportSummary[]>([]);
  const [notice] = useState<string>('');

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
    const name = await askName(s);
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

  /**
   * Hands the original hand history back. The text is rebuilt from the hands
   * as they were imported, so the file can be recovered from the browser even
   * when the .txt itself is long gone.
   */
  const download = async (session: Session) => {
    const hands = await getRepository().getHands(session.handIds);
    const text = hands.map((h) => h.raw.trim()).join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = session.sourceFileName ?? `${session.name}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const remove = (session: Session) => {
    setSelected(new Set([session.id]));
    setConfirming('selected');
  };



  const loadSample = async () => {
    const text = await (await fetch(sampleUrl)).text();
    const summary = await importText('pokerstars-demo.txt', text);
    onImported([summary]);
  };

  /** Ten at a time keeps the table readable on any screen. */
  const pageCount = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const page = Math.min(pageIndex, pageCount - 1);
  const pageRows = sessions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = (checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const row of pageRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });

  /** Opens the rename dialog and resolves with what the user typed. */
  const askName = (session: Session) =>
    new Promise<string | undefined>((resolve) => {
      renameResolver.current = resolve;
      setRenaming(session);
    });

  const closeRename = (name?: string) => {
    renameResolver.current?.(name);
    renameResolver.current = undefined;
    setRenaming(undefined);
  };

  /** Hands back every selected session as one hand-history file. */
  const downloadSelected = async () => {
    const chosen = sessions.filter((row) => selected.has(row.id));
    const parts: string[] = [];
    for (const session of chosen) {
      const hands = await getRepository().getHands(session.handIds);
      parts.push(`### ${session.sourceFileName ?? session.name}\n\n${hands.map((h) => h.raw.trim()).join('\n\n')}`);
    }
    const url = URL.createObjectURL(new Blob([parts.join('\n\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pokerstudio-hand-histories-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /** Runs the deletion the dialog just confirmed. */
  const deleteChosen = async () => {
    const ids = confirming === 'all' ? sessions.map((row) => row.id) : [...selected];
    for (const id of ids) await getRepository().deleteSession(id);
    setSelected(new Set());
    setConfirming(undefined);
    setPageIndex(0);
    await refresh();
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
          {selected.size > 0 && (
            <>
              <button type="button" className="btn" onClick={() => void downloadSelected()}>
                <IconDownload size={14} />
                {t('library.downloadSelected', { count: selected.size })}
              </button>
              <button
                type="button"
                className="btn"
                style={{ color: 'var(--result-lost)' }}
                onClick={() => setConfirming('selected')}
              >
                <IconTrash size={14} />
                {t('library.deleteSelected', { count: selected.size })}
              </button>
            </>
          )}
          <button type="button" className="btn" disabled={!sessions.length} onClick={() => setConfirming('all')}>
            {t('library.deleteAll')}
          </button>
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
                  {/* The first three columns stay put while the rest scrolls. */}
                  <th className="w-9 px-2 py-2" style={{ background: 'var(--surface)', position: 'sticky', left: 0, zIndex: 2 }}>
                    <input
                      type="checkbox"
                      aria-label={t('library.selectAll')}
                      checked={pageRows.length > 0 && pageRows.every((row) => selected.has(row.id))}
                      onChange={(e) => togglePage(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2" style={{ ...frozen(0), background: 'var(--surface)' }}>
                    {t('library.colName')}
                  </th>
                  <th className="px-3 py-2" style={{ ...frozen(1), background: 'var(--surface)' }}>
                    {t('library.colFile')}
                  </th>
                  <th className="px-3 py-2" style={{ ...frozen(2), background: 'var(--surface)' }}>
                    {t('library.colSite')}
                  </th>
                  <th className="px-3 py-2 text-right">{t('library.colHands')}</th>
                  <th className="px-3 py-2">{t('library.colStatus')}</th>
                  <th className="px-3 py-2">{t('library.colImported')}</th>
                  <th className="px-3 py-2">{t('library.colOpened')}</th>
                  <th className="px-3 py-2 text-right">{t('library.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <tr key={s.id} className="border-t align-middle" style={{ borderColor: 'var(--border)' }}>
                    <td className="w-9 px-2 py-2" style={{ background: 'var(--surface)', position: 'sticky', left: 0, zIndex: 2 }}>
                      <input
                        type="checkbox"
                        aria-label={s.name}
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                      />
                    </td>
                    {/* A dash when the session carries no name of its own. Both
                        cells open it, as does the play button on the right. */}
                    <td className="px-3 py-2" style={{ ...frozen(0), background: 'var(--surface)' }}>
                      <button
                        type="button"
                        className="block max-w-full truncate font-medium hover:underline"
                        title={s.name}
                        onClick={() => navigate(`/replay/${s.id}`)}
                      >
                        {s.name === s.sourceFileName ? '—' : s.name}
                      </button>
                    </td>
                    <td className="px-3 py-2" style={{ ...frozen(1), background: 'var(--surface)', color: 'var(--text-muted)' }}>
                      <button
                        type="button"
                        className="block max-w-full truncate hover:underline"
                        title={s.sourceFileName ?? undefined}
                        onClick={() => navigate(`/replay/${s.id}`)}
                      >
                        {s.sourceFileName ?? '—'}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2" style={{ ...frozen(2), background: 'var(--surface)' }}>
                      {siteName(s.site)}
                    </td>
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
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <span className="inline-flex gap-0.5">
                        <button type="button" className="btn-icon" title={t('library.open')} aria-label={t('library.open')} onClick={() => navigate(`/replay/${s.id}`)}>
                          <IconPlay size={15} />
                        </button>
                        <button type="button" className="btn-icon" title={t('library.download')} aria-label={t('library.download')} onClick={() => void download(s)}>
                          <IconDownload size={15} />
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

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('library.pageOf', { page: page + 1, pages: pageCount })}</span>
            <span className="flex items-center gap-2">
              <button type="button" className="btn" disabled={page === 0} onClick={() => setPageIndex((n) => n - 1)}>
                ←
              </button>
              <button type="button" className="btn" disabled={page >= pageCount - 1} onClick={() => setPageIndex((n) => n + 1)}>
                →
              </button>
            </span>
          </div>
        )}
      </section>

      <PromptDialog
        open={!!renaming}
        title={t('common.rename')}
        label={t('library.colName')}
        initialValue={renaming?.name ?? ''}
        confirmLabel={t('common.save')}
        onCancel={() => closeRename(undefined)}
        onConfirm={(name) => closeRename(name)}
      />

      <ConfirmDialog
        open={confirming !== undefined}
        title={t('library.confirmDeleteTitle')}
        body={
          confirming === 'all'
            ? t('library.confirmDeleteAll', { count: sessions.length })
            : t('library.confirmDeleteSelected', { count: selected.size })
        }
        confirmLabel={t('common.delete')}
        danger
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => void deleteChosen()}
      />

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
