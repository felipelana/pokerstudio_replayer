import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LegalLink } from '@/features/onboarding/legal/LegalDialog';
import { ShareReviewDialog } from '@/features/reviews/share/ShareReviewDialog';
import type { Session } from '@/domain/model/types';
import {
  IconCloudCheck,
  IconCloudDown,
  IconCloudOff,
  IconCloudUp,
  IconDownload,
  IconPencil,
  IconPlay,
  IconShare,
  IconTrash,
} from '@/components/ui/icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { reviewApi, type CloudReviewRow } from '@/lib/infrastructure/http/reviewApi';
import { buildCloudReview } from './CloudReviews';
import { forgetKnownReviews } from '@/features/replayer/ui/useCloudProgress';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { NameSessionsDialog } from './NameSessionsDialog';
import { getRepository } from '@/lib/db/repository';
import { useAppStore } from '@/lib/state/store';
import type { ImportSummary } from '@/features/parsers/importer';
import { importText } from '@/features/parsers/importer';
import { parsers } from '@/features/parsers/registry';
import { useDateFormatter } from '@/components/hooks/useFormat';
import { ImportPanel } from './ImportPanel';
import sampleUrl from '@/lib/assets/samples/pokerstars-demo.txt?url';

/** Choices for how many sessions a page shows. */
const PAGE_SIZES = [5, 10, 20, 50];

/**
 * Column widths as shares of the table, in order: the checkbox, name, file,
 * room, hands, situation, last hand, storage, imported, last opened and the
 * actions. Shares rather than pixels, so the grid always fits its container
 * and never scrolls sideways.
 */
const COLUMN_WIDTHS = ['3%', '11%', '10%', '7%', '4%', '11%', '7%', '11%', '10%', '11%', '15%'];

/** The situation reads at a glance: colour closed, glyph inside the list. */
function statusStyle(session: Session): React.CSSProperties {
  if (session.status === 'completed')
    return { color: 'var(--result-won)', borderColor: 'var(--result-won)' };
  if (session.lastHandIndex)
    return { color: 'var(--result-break-even)', borderColor: 'var(--result-break-even)' };
  return { color: 'var(--text-muted)' };
}

export function LibraryPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<'all' | 'selected' | undefined>(undefined);
  const [naming, setNaming] = useState<Session[]>([]);
  const [sharing, setSharing] = useState<Session | undefined>();

  // The view lives in the store: coming back from the replayer should land on
  // the same list, in the same order and on the same page.
  const view = useAppStore((state) => state.libraryView);
  const setView = useAppStore((state) => state.setLibraryView);
  const { query, site: siteFilter, from, to, storage, sort, pageIndex, pageSize } = view;
  const setQuery = (value: string) => setView({ query: value });
  const setSiteFilter = (value: string) => setView({ site: value });
  const setFrom = (value: string) => setView({ from: value });
  const setTo = (value: string) => setView({ to: value });
  const setStorage = (value: 'all' | 'saved' | 'local') => setView({ storage: value });
  const setSort = (value: 'imported' | 'opened' | 'name') => setView({ sort: value });
  const setPageIndex = (value: number) => setView({ pageIndex: value });
  const setPageSize = (value: number) => setView({ pageSize: value });
  /** What the account holds, so each row can say where it lives — and so a
   *  review saved from another machine can be brought down here. */
  const [cloud, setCloud] = useState<CloudReviewRow[]>([]);
  const savedIds = useMemo(() => new Set(cloud.map((row) => row.id)), [cloud]);
  const [savingId, setSavingId] = useState('');
  const [pulling, setPulling] = useState('');
  const [renaming, setRenaming] = useState<Session>();
  const renameResolver = useRef<((name: string | undefined) => void) | undefined>(undefined);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const df = useDateFormatter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastImport, setLastImport] = useState<ImportSummary[]>([]);
  const [notice] = useState<string>('');

  /** Asks the account which reviews it holds; silent when signed out. */
  const refreshSaved = useCallback(async () => {
    try {
      const data = await reviewApi.list();
      setCloud(data.items);
    } catch {
      setCloud([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setSessions(await getRepository().listSessions());
  }, []);

  useEffect(() => {
    void refresh();
    void refreshSaved();
  }, [refresh, refreshSaved]);

  const onImported = useCallback(
    (summaries: ImportSummary[]) => {
      setLastImport(summaries);
      // Naming comes after the import: only now is it clear how many sessions
      // arrived and what each one holds.
      setNaming(summaries.filter((s) => s.result.hands.length > 0).map((s) => s.session));
      void refresh();
    },
    [refresh],
  );

  /** Applies the names typed in the dialog. */
  const applyNames = async (names: Record<string, string>) => {
    for (const [id, value] of Object.entries(names)) {
      const name = value.trim();
      const original = naming.find((session) => session.id === id);
      if (name && original && name !== original.name) await getRepository().renameSession(id, name);
    }
    setNaming([]);
    await refresh();
  };

  const rename = async (s: Session) => {
    const name = await askName(s);
    if (name && name.trim() && name !== s.name) {
      await getRepository().renameSession(s.id, name.trim());
      await refresh();
    }
  };

  /** Sets the review's situation from the grid. */
  const setStatus = async (session: Session, value: 'open' | 'progress' | 'completed') => {
    const patch =
      value === 'completed'
        ? { status: 'completed' as const }
        : value === 'open'
          ? { status: 'in-progress' as const, lastHandIndex: 0, lastFrameIndex: 0 }
          : // "In progress" with nothing recorded starts at the first hand.
            {
              status: 'in-progress' as const,
              lastHandIndex: Math.max(1, session.lastHandIndex ?? 1),
            };
    await getRepository().saveSessionProgress(session.id, patch);
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

  const siteName = useCallback(
    (site: Session['site']) =>
      parsers.find((parser) => parser.site === site)?.displayName ?? t('common.unknown'),
    [t],
  );

  /** Name, file and room by text; the import date by range. */
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    const after = from ? new Date(`${from}T00:00:00`) : undefined;
    const before = to ? new Date(`${to}T23:59:59`) : undefined;
    const rows = sessions.filter((session) => {
      if (siteFilter && session.site !== siteFilter) return false;
      const imported = new Date(session.importedAt);
      if (after && imported < after) return false;
      if (before && imported > before) return false;
      if (!q) return true;
      return [session.name, session.sourceFileName, siteName(session.site)]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    });

    const stored = rows.filter((session) => {
      if (storage === 'saved') return savedIds.has(session.id);
      if (storage === 'local') return !savedIds.has(session.id);
      return true;
    });

    const at = (d?: Date) => (d ? new Date(d).getTime() : 0);
    const local = [...stored].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'opened') return at(b.lastOpenedAt) - at(a.lastOpenedAt);
      return at(b.importedAt) - at(a.importedAt);
    });

    // A review saved from another machine is not in this browser yet; it still
    // belongs in the list, with the one action that makes sense for it.
    const localIds = new Set(sessions.map((session) => session.id));
    const q2 = query.trim().toLowerCase();
    const elsewhere =
      storage === 'local'
        ? []
        : cloud
            .filter((row) => !localIds.has(row.id))
            .filter((row) => !q2 || row.title.toLowerCase().includes(q2))
            .map((row): Session => ({
              id: row.id,
              name: row.title,
              site: (row.roomDetected as Session['site']) ?? 'unknown',
              handIds: [],
              handCount: row.handCount,
              importedAt: new Date(row.lastOpenedAt),
              players: [],
              warnings: [],
              lastHandIndex: row.currentHandIndex,
              status: row.status === 'COMPLETED' ? 'completed' : 'in-progress',
            }));

    return [...local, ...elsewhere];
  }, [sessions, query, siteFilter, from, to, siteName, storage, savedIds, sort, cloud]);

  /** Ten at a time keeps the table readable on any screen. */
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const pageRows = matching.slice(page * pageSize, page * pageSize + pageSize);

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

  /** How many of the sessions about to go are also stored on the account. */
  const deletingSaved = (
    confirming === 'all' ? matching.map((row) => row.id) : [...selected]
  ).filter((id) => savedIds.has(id)).length;

  /**
   * Rebuilds a review saved elsewhere into this browser.
   *
   * O identificador da nuvem viaja junto, senão a mesma revisão apareceria duas
   * vezes na lista: a linha baixada, com um identificador novo, e a da conta,
   * que nunca se reconheceria como já trazida.
   */
  const pullFromAccount = async (id: string): Promise<boolean> => {
    setPulling(id);
    try {
      const full = await reviewApi.get(id);
      const text = full.hands
        .map((hand) => hand.rawHistory)
        .filter((raw): raw is string => !!raw)
        .join('\n\n');
      if (!text) return false;
      await importText(full.title, text, undefined, undefined, id);
      await refresh();
      return true;
    } catch {
      // Offline, or saved without the hand histories: nothing to rebuild.
      return false;
    } finally {
      setPulling('');
    }
  };

  /**
   * Abrir uma linha da lista.
   *
   * As mãos vivem no IndexedDB deste navegador. Uma revisão que só existe na
   * conta precisa ser trazida antes, ou o replayer abre numa tela de
   * carregamento que nunca sai. Antes o clique navegava direto, sempre.
   */
  const openSession = async (session: Session) => {
    if (session.handIds.length > 0) {
      navigate(`/replay/${session.id}`);
      return;
    }
    if (await pullFromAccount(session.id)) navigate(`/replay/${session.id}`);
  };

  /** Stores this session on the account, hand histories included. */
  const saveToAccount = async (session: Session) => {
    setSavingId(session.id);
    try {
      await reviewApi.save(session.id, await buildCloudReview(session, true));
      forgetKnownReviews();
      await refreshSaved();
    } catch {
      // Signed out or offline: the row simply stays "this browser only".
    } finally {
      setSavingId('');
    }
  };

  /** Hands back every selected session as one hand-history file. */
  const downloadSelected = async () => {
    const chosen = sessions.filter((row) => selected.has(row.id));
    const parts: string[] = [];
    for (const session of chosen) {
      const hands = await getRepository().getHands(session.handIds);
      parts.push(
        `### ${session.sourceFileName ?? session.name}\n\n${hands.map((h) => h.raw.trim()).join('\n\n')}`,
      );
    }
    const url = URL.createObjectURL(
      new Blob([parts.join('\n\n')], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `pokerstudio-hand-histories-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Runs the deletion the dialog just confirmed. A session stored on the
   * account is removed there too — leaving the copy behind would contradict
   * what the dialog says.
   */
  const deleteChosen = async () => {
    const ids = confirming === 'all' ? matching.map((row) => row.id) : [...selected];
    for (const id of ids) {
      if (savedIds.has(id)) {
        try {
          await reviewApi.remove(id);
        } catch {
          // Offline: the local copy still goes, and the row will show as saved
          // again on the next refresh rather than pretending it is gone.
        }
      }
      await getRepository().deleteSession(id);
    }
    forgetKnownReviews();
    setSelected(new Set());
    setConfirming(undefined);
    setPageIndex(0);
    await refresh();
    await refreshSaved();
  };

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
              {t('library.openInReplayer')} ·{' '}
              {sessions.find((row) => row.id === s.session.id)?.name ?? s.session.name}
            </button>
          ))}
        </div>
      )}

      <section className="panel shrink-0 overflow-hidden">
        <header
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="font-semibold">{t('library.sessions')}</h2>
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
        </header>
        <div
          className="flex flex-wrap items-end gap-2 border-b px-4 py-2 text-xs"
          style={{ borderColor: 'var(--border)' }}
        >
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('library.search')}</span>
            <input
              className="input !py-1 w-[220px] text-xs"
              value={query}
              placeholder={t('library.searchHint')}
              onChange={(e) => {
                setPageIndex(0);
                setQuery(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('library.colSite')}</span>
            <select
              className="input !py-1 !w-auto text-xs"
              value={siteFilter}
              onChange={(e) => {
                setPageIndex(0);
                setSiteFilter(e.target.value);
              }}
            >
              <option value="">{t('library.anySite')}</option>
              {parsers.map((parser) => (
                <option key={parser.site} value={parser.site}>
                  {parser.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('library.from')}</span>
            <input
              type="date"
              className="input !py-1 !w-auto text-xs"
              value={from}
              onChange={(e) => {
                setPageIndex(0);
                setFrom(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('library.to')}</span>
            <input
              type="date"
              className="input !py-1 !w-auto text-xs"
              value={to}
              onChange={(e) => {
                setPageIndex(0);
                setTo(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('library.storage')}</span>
            <select
              className="input !py-1 !w-auto text-xs"
              value={storage}
              onChange={(e) => {
                setPageIndex(0);
                setStorage(e.target.value as 'all' | 'saved' | 'local');
              }}
            >
              <option value="all">{t('library.storageAll')}</option>
              <option value="saved">{t('library.storageSaved')}</option>
              <option value="local">{t('library.storageLocal')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('library.sort')}</span>
            <select
              className="input !py-1 !w-auto text-xs"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'imported' | 'opened' | 'name')}
            >
              <option value="imported">{t('library.colImported')}</option>
              <option value="opened">{t('library.colOpened')}</option>
              <option value="name">{t('library.colName')}</option>
            </select>
          </label>
          {(query || siteFilter || from || to || storage !== 'all') && (
            <button
              type="button"
              className="btn !py-1 text-xs"
              onClick={() => {
                setQuery('');
                setSiteFilter('');
                setFrom('');
                setTo('');
                setStorage('all');
                setPageIndex(0);
              }}
            >
              {t('common.reset')}
            </button>
          )}
          <div className="flex-1" />
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('library.perPage')}</span>
            <select
              className="input !py-1 !w-auto text-xs"
              value={pageSize}
              onChange={(e) => {
                setPageIndex(0);
                setPageSize(Number(e.target.value));
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="self-end pb-1" style={{ color: 'var(--text-muted)' }}>
            {t('library.showing', { count: matching.length })}
          </span>
        </div>

        <p className="px-4 pb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('library.storageHint')}
        </p>

        {notice && (
          <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {notice}
          </div>
        )}
        {matching.length === 0 ? (
          <div
            className="flex flex-col items-start gap-3 p-6 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <div>{t('library.empty')}</div>
            <div className="flex items-center gap-2">
              <span>{t('library.sampleTitle')}</span>
              <button type="button" className="btn" onClick={() => void loadSample()}>
                {t('library.loadSample')}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[52vh] overflow-auto" data-tour="sessions">
            <table className="table-zebra w-full table-fixed text-sm">
              <colgroup>
                {COLUMN_WIDTHS.map((width, index) => (
                  <col key={index} style={{ width }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr
                  className="text-left text-xs font-bold uppercase tracking-wide"
                  style={{ color: '#e8e8ee', background: '#000' }}
                >
                  {/* The first three columns stay put while the rest scrolls. */}
                  <th className="w-9 px-2 py-2" style={{ background: '#000' }}>
                    <input
                      type="checkbox"
                      aria-label={t('library.selectAll')}
                      checked={pageRows.length > 0 && pageRows.every((row) => selected.has(row.id))}
                      onChange={(e) => togglePage(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2" style={{ background: '#000' }}>
                    {t('library.colName')}
                  </th>
                  <th className="px-3 py-2" style={{ background: '#000' }}>
                    {t('library.colFile')}
                  </th>
                  <th className="px-3 py-2" style={{ background: '#000' }}>
                    {t('library.colSite')}
                  </th>
                  <th className="px-3 py-2 text-right">{t('library.colHands')}</th>
                  <th className="px-3 py-2">{t('library.colStatus')}</th>
                  <th className="truncate px-3 py-2 text-right" title={t('library.colLastHand')}>
                    {t('library.colLastHand')}
                  </th>
                  <th className="px-3 py-2">{t('library.colStorage')}</th>
                  <th className="px-3 py-2">{t('library.colImported')}</th>
                  <th className="px-3 py-2">{t('library.colOpened')}</th>
                  <th className="px-3 py-2 text-right">{t('library.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-default border-t align-middle"
                    style={{ borderColor: 'var(--border)' }}
                    onDoubleClick={() => void openSession(s)}
                    title={t('library.openHint')}
                  >
                    <td
                      className="w-9 px-2 py-2"
                      style={{ background: 'var(--row-bg, var(--surface))' }}
                    >
                      <input
                        type="checkbox"
                        aria-label={s.name}
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                      />
                    </td>
                    {/* A dash when the session carries no name of its own. Both
                        cells open it, as does the play button on the right. */}
                    <td
                      className="px-3 py-2"
                      style={{ background: 'var(--row-bg, var(--surface))' }}
                    >
                      <button
                        type="button"
                        className="block max-w-full truncate font-medium hover:underline"
                        title={s.name}
                        onClick={() => void openSession(s)}
                      >
                        {s.name === s.sourceFileName ? '-' : s.name}
                      </button>
                    </td>
                    <td
                      className="px-3 py-2"
                      style={{
                        background: 'var(--row-bg, var(--surface))',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <button
                        type="button"
                        className="block max-w-full truncate hover:underline"
                        title={s.sourceFileName ?? undefined}
                        onClick={() => void openSession(s)}
                      >
                        {s.sourceFileName ?? '-'}
                      </button>
                    </td>
                    <td
                      className="truncate whitespace-nowrap px-3 py-2"
                      style={{ background: 'var(--row-bg, var(--surface))' }}
                      title={siteName(s.site)}
                    >
                      {siteName(s.site)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.handCount}</td>
                    <td className="truncate whitespace-nowrap px-3 py-2">
                      {s.handIds.length ? (
                        // Editable in place: the reader is the one who knows
                        // whether a review is done, and where they left it.
                        <span className="inline-flex items-center gap-1">
                          <select
                            className="input !w-auto !py-0.5 text-[11px] font-medium"
                            value={
                              s.status === 'completed'
                                ? 'completed'
                                : s.lastHandIndex
                                  ? 'progress'
                                  : 'open'
                            }
                            aria-label={t('library.colStatus')}
                            style={statusStyle(s)}
                            onChange={(e) =>
                              void setStatus(s, e.target.value as 'open' | 'progress' | 'completed')
                            }
                          >
                            <option
                              value="open"
                              style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}
                            >
                              ○ {t('library.statusOpen')}
                            </option>
                            <option
                              value="progress"
                              style={{
                                color: 'var(--result-break-even)',
                                background: 'var(--surface)',
                              }}
                            >
                              ◐ {t('library.statusInProgress')}
                            </option>
                            <option
                              value="completed"
                              style={{ color: 'var(--result-won)', background: 'var(--surface)' }}
                            >
                              ✓ {t('library.statusDone')}
                            </option>
                          </select>
                        </span>
                      ) : s.status === 'completed' ? (
                        <span
                          className="chip-tag"
                          style={{ color: 'var(--result-won)', borderColor: 'var(--result-won)' }}
                        >
                          {t('library.statusDone')}
                        </span>
                      ) : (
                        <span className="chip-tag" style={{ color: 'var(--text-muted)' }}>
                          {s.lastHandIndex
                            ? t('library.statusAt', {
                                current: s.lastHandIndex + 1,
                                total: s.handCount,
                              })
                            : t('library.statusOpen')}
                        </span>
                      )}
                    </td>
                    <td
                      className="truncate whitespace-nowrap px-3 py-2 text-right tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {s.lastHandIndex ? `${s.lastHandIndex + 1} / ${s.handCount}` : '-'}
                    </td>
                    <td className="truncate whitespace-nowrap px-3 py-2">
                      {savedIds.has(s.id) ? (
                        <span
                          className="inline-flex items-center gap-1.5"
                          style={{ color: 'var(--result-won)' }}
                        >
                          <IconCloudCheck size={14} />
                          {t('library.storedSaved')}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <IconCloudOff size={14} />
                          {t('library.storedLocal')}
                        </span>
                      )}
                    </td>
                    <td
                      className="truncate whitespace-nowrap px-3 py-2 text-xs tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span title={df.dateTime(s.importedAt)}>{df.dateTime(s.importedAt)}</span>
                    </td>
                    <td
                      className="truncate whitespace-nowrap px-3 py-2 text-xs tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span title={s.lastOpenedAt ? df.dateTime(s.lastOpenedAt) : undefined}>
                        {s.lastOpenedAt ? df.dateTime(s.lastOpenedAt) : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="inline-flex flex-nowrap justify-end gap-0.5">
                        {!s.handIds.length && (
                          <button
                            type="button"
                            className="btn-icon !px-1.5"
                            title={t('cloud.pull')}
                            aria-label={t('cloud.pull')}
                            disabled={pulling === s.id}
                            onClick={() => void pullFromAccount(s.id)}
                          >
                            <IconCloudDown size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-icon !px-1.5"
                          title={t('library.open')}
                          aria-label={t('library.open')}
                          onClick={() => void openSession(s)}
                        >
                          <IconPlay size={15} />
                        </button>
                        {!!s.handIds.length && !savedIds.has(s.id) && (
                          <button
                            type="button"
                            className="btn-icon !px-1.5"
                            title={t('library.saveToAccount')}
                            aria-label={t('library.saveToAccount')}
                            disabled={savingId === s.id}
                            onClick={() => void saveToAccount(s)}
                          >
                            <IconCloudUp size={15} />
                          </button>
                        )}
                        {savedIds.has(s.id) && (
                          <button
                            type="button"
                            className="btn-icon !px-1.5"
                            title={t('share.tooltip')}
                            aria-label={`${t('share.title')}: ${s.name || s.sourceFileName || ''}`}
                            onClick={() => setSharing(s)}
                          >
                            <IconShare size={13} />
                          </button>
                        )}
                        {!!s.handIds.length && (
                          <button
                            type="button"
                            className="btn-icon !px-1.5"
                            title={t('library.download')}
                            aria-label={t('library.download')}
                            onClick={() => void download(s)}
                          >
                            <IconDownload size={15} />
                          </button>
                        )}
                        {!!s.handIds.length && (
                          <button
                            type="button"
                            className="btn-icon !px-1.5"
                            title={t('common.rename')}
                            aria-label={t('common.rename')}
                            onClick={() => void rename(s)}
                          >
                            <IconPencil size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-icon !px-1.5"
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
          <div
            className="flex items-center justify-between gap-2 border-t px-4 py-2 text-sm"
            style={{ borderColor: 'var(--border)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>
              {t('library.pageOf', { page: page + 1, pages: pageCount })}
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                className="btn"
                disabled={page === 0}
                onClick={() => setPageIndex(page - 1)}
              >
                ←
              </button>
              <button
                type="button"
                className="btn"
                disabled={page >= pageCount - 1}
                onClick={() => setPageIndex(page + 1)}
              >
                →
              </button>
            </span>
          </div>
        )}
      </section>

      <NameSessionsDialog
        sessions={naming}
        onCancel={() => setNaming([])}
        onSave={(names) => void applyNames(names)}
      />

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
        body={`${
          confirming === 'all'
            ? t('library.confirmDeleteAll', { count: matching.length })
            : t('library.confirmDeleteSelected', { count: selected.size })
        }${deletingSaved ? ` ${t('library.confirmDeleteSaved', { count: deletingSaved })}` : ''}`}
        confirmLabel={t('common.delete')}
        danger
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => void deleteChosen()}
      />

      <ShareReviewDialog
        reviewId={sharing?.id ?? ''}
        reviewTitle={sharing?.name || sharing?.sourceFileName || ''}
        open={!!sharing}
        onClose={() => setSharing(undefined)}
      />

      <footer
        className="mt-6 flex items-center gap-4 pb-4 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <NavLink to="/novidades" className="hover:underline">
          {t('releases.title')}
        </NavLink>
        <LegalLink doc="privacy" className="hover:underline">
          {t('legal.privacy')}
        </LegalLink>
        <LegalLink doc="terms" className="hover:underline">
          {t('legal.terms')}
        </LegalLink>
      </footer>
    </div>
  );
}
