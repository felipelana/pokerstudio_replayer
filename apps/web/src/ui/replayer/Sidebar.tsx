import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Hand } from '@/model/types';
import type { HandMeta } from '@/engine/replay';
import type { PositionLabel } from '@/model/positions';
import { useAppStore } from '@/state/store';
import type { Skin } from '@/skins/types';
import { Card } from '@/ui/cards/Card';
import { IconCheck, IconClose, IconCopy, IconDice, IconSearch, IconUpload, IconUser } from '@/ui/icons';

export interface HandRow {
  hand: Hand;
  meta: HandMeta;
  position?: PositionLabel;
}

interface Props {
  rows: HandRow[];
  currentIndex: number;
  skin: Skin;
  heroName?: string;
  sessionHasHero: boolean;
  players: { name: string; count: number }[];
  /** Indices into `rows`, already filtered and ordered by the page. */
  visible: number[];
  availablePositions: string[];
  fmt: (v: number) => string;
  onSelect(index: number): void;
  onOpenReport(): void;
}

const ROW_HEIGHT = 40;

/** Collapsible block: only search and ordering stay open by default (R19). */
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        className="label-caps flex w-full items-center gap-1 py-1 hover:opacity-80"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .12s' }}>›</span>
        {title}
      </button>
      {open && <div className="flex flex-col gap-1.5 pb-1">{children}</div>}
    </div>
  );
}

export function Sidebar({
  rows,
  currentIndex,
  skin,
  heroName,
  sessionHasHero,
  players,
  visible,
  availablePositions,
  fmt,
  onSelect,
  onOpenReport,
}: Props) {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setImportModalOpen = useAppStore((s) => s.setImportModalOpen);
  const focusPlayer = useAppStore((s) => s.focusPlayer);
  const setFocus = useAppStore((s) => s.setFocus);
  const filterPositions = useAppStore((s) => s.filterPositions);
  const filterResult = useAppStore((s) => s.filterResult);
  const filterPlayedOnly = useAppStore((s) => s.filterPlayedOnly);
  const setFilterPlayedOnly = useAppStore((s) => s.setFilterPlayedOnly);
  const sortMode = useAppStore((s) => s.sortMode);
  const togglePosition = useAppStore((s) => s.togglePosition);
  const setFilterResult = useAppStore((s) => s.setFilterResult);
  const setSortMode = useAppStore((s) => s.setSortMode);
  const clearFilters = useAppStore((s) => s.clearFilters);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const indexed = visible.map((i) => ({ r: rows[i], i })).filter((x) => x.r);
    if (!q) return indexed;
    return indexed.filter(
      ({ r }) =>
        r.hand.handNumber.includes(q) ||
        r.hand.players.some((p) => p.name.toLowerCase().includes(q)) ||
        (r.meta.heroCards ?? []).join(' ').toLowerCase().includes(q),
    );
  }, [rows, visible, filter]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  useEffect(() => {
    const pos = filtered.findIndex((x) => x.i === currentIndex);
    if (pos >= 0) virtualizer.scrollToIndex(pos, { align: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, filtered]);

  // Drag the divider to resize (R5).
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = asideRef.current?.getBoundingClientRect().width ?? settings.sidebarWidth;
    const onMove = (ev: MouseEvent) => setSidebarWidth(startW + (ev.clientX - startX));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const copyRaw = async () => {
    const hand = rows[currentIndex]?.hand;
    if (!hand) return;
    try {
      await navigator.clipboard.writeText(hand.raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const showResult = (row: HandRow) =>
    !settings.hideResults &&
    settings.colorHintResults &&
    !!row.meta.result &&
    !(settings.colorVpipOnly && !row.meta.vpip);

  const netColor = (row: HandRow) => {
    if (settings.hideResults || row.meta.net === undefined || Math.abs(row.meta.net) < 0.005) return 'var(--text-muted)';
    return row.meta.net > 0 ? 'var(--result-won)' : 'var(--result-lost)';
  };

  const activeChips = [
    ...filterPositions.map((p) => ({ key: `pos:${p}`, label: p, clear: () => togglePosition(p) })),
    ...(filterPlayedOnly ? [{ key: 'played', label: t('sidebar.playedOnly'), clear: () => setFilterPlayedOnly(false) }] : []),
    ...(filterResult !== 'all'
      ? [{ key: 'result', label: t(`sidebar.result${filterResult === 'won' ? 'Won' : 'Lost'}`), clear: () => setFilterResult('all') }]
      : []),
    ...(sortMode !== 'default'
      ? [{ key: 'sort', label: t(`sidebar.sort${sortMode === 'potDesc' ? 'Pot' : 'Reverse'}`), clear: () => setSortMode('default') }]
      : []),
  ];

  if (settings.sidebarCollapsed) {
    return (
      <div className="flex h-full shrink-0 flex-col items-center gap-2 border-r p-1.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <button type="button" className="btn-icon" onClick={toggleSidebar} title={t('sidebar.expand')} aria-label={t('sidebar.expand')}>
          ›
        </button>
        <span className="label-caps [writing-mode:vertical-rl]">{t('sidebar.hands')}</span>
      </div>
    );
  }

  return (
    <aside
      ref={asideRef}
      className="relative flex h-full shrink-0 flex-col gap-2 border-r p-2.5"
      style={{ width: settings.sidebarWidth, borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {/* Drag handle (R5) */}
      <div
        onMouseDown={startResize}
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('sidebar.resize')}
      />

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1 justify-center" onClick={() => setImportModalOpen(true)}>
          <IconUpload size={15} />
          {t('sidebar.loadHands')}
        </button>
        <button type="button" className="btn-icon" onClick={toggleSidebar} title={t('sidebar.collapse')} aria-label={t('sidebar.collapse')}>
          ‹
        </button>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
          <IconSearch size={13} />
        </span>
        <input
          className="input !py-1 pl-7 text-xs"
          placeholder={t('sidebar.filter')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={t('sidebar.filter')}
        />
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        <label className="flex flex-1 items-center gap-1.5">
          <span className="label-caps">{t('sidebar.sort')}</span>
          <select
            className="input !w-auto flex-1 !py-1 text-xs"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as 'default' | 'potDesc' | 'reverse')}
          >
            <option value="default">{t('sidebar.sortDefault')}</option>
            <option value="potDesc">{t('sidebar.sortPot')}</option>
            <option value="reverse">{t('sidebar.sortReverse')}</option>
          </select>
        </label>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              className="flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px]"
              style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }}
            >
              {c.label}
              <IconClose size={9} />
            </button>
          ))}
          <button type="button" className="text-[10.5px] underline" style={{ color: 'var(--text-muted)' }} onClick={clearFilters}>
            {t('sidebar.clearFilters')}
          </button>
        </div>
      )}

      <Section title={t('sidebar.moreFilters')}>
        <div className="flex flex-wrap gap-1">
          {availablePositions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePosition(p)}
              aria-pressed={filterPositions.includes(p)}
              className="rounded px-1.5 py-[2px] text-[10.5px] font-semibold"
              style={{
                background: filterPositions.includes(p) ? 'var(--accent)' : 'var(--surface-2)',
                color: filterPositions.includes(p) ? '#fff' : 'var(--text-muted)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'won', 'lost'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilterResult(v)}
              aria-pressed={filterResult === v}
              className="flex-1 rounded px-1 py-[2px] text-[10.5px]"
              style={{
                background: filterResult === v ? 'var(--accent)' : 'var(--surface-2)',
                color: filterResult === v ? '#fff' : 'var(--text-muted)',
              }}
            >
              {t(`sidebar.result${v === 'all' ? 'All' : v === 'won' ? 'Won' : 'Lost'}`)}
            </button>
          ))}
        </div>
        <label className="checkbox mt-1 text-[11px]">
          <input type="checkbox" checked={filterPlayedOnly} onChange={(e) => setFilterPlayedOnly(e.target.checked)} />
          {t('sidebar.playedOnly')}
        </label>
      </Section>

      <Section title={t('sidebar.display')}>
        {(
          [
            ['showKnownHands', 'sidebar.showKnownHands'],
            ['colorHintResults', 'sidebar.colorHintResults'],
            ['colorVpipOnly', 'sidebar.colorVpipOnly'],
            ['hideResults', 'sidebar.hideResults'],
            ['skipPosts', 'sidebar.skipPosts'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="checkbox">
            <input type="checkbox" checked={settings[key]} onChange={(e) => updateSettings({ [key]: e.target.checked })} />
            {t(label)}
          </label>
        ))}
      </Section>

      <Section title={t('sidebar.focusSelect')} defaultOpen={!sessionHasHero && !focusPlayer}>
        <span className="label-caps flex items-center gap-1.5">
          <IconUser size={12} />
          {t('sidebar.focusSelect')}
        </span>
        <select className="input !py-1 text-xs" value={focusPlayer ?? ''} onChange={(e) => setFocus(e.target.value || undefined)}>
          <option value="">{sessionHasHero ? t('sidebar.fileHero') : t('sidebar.choosePlayer')}</option>
          {players.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.count})
            </option>
          ))}
        </select>
        {!heroName && (
          <span className="text-[10.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            {t('sidebar.noHero')}
          </span>
        )}
        <button type="button" className="btn w-full justify-center" onClick={() => filtered.length && onSelect(filtered[Math.floor(Math.random() * filtered.length)].i)}>
          <IconDice size={15} />
          {t('sidebar.randomHand')}
        </button>
      </Section>

      <div className="flex items-center gap-2">
        <span className="label-caps">{t('sidebar.hands')}</span>
        <span className="rounded-full px-1.5 text-[10px] font-semibold tabular-nums" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          {filtered.length === rows.length ? rows.length : `${filtered.length}/${rows.length}`}
        </span>
        <div className="flex-1" />
        <button type="button" className="btn !px-2 !py-1 text-[11px]" onClick={onOpenReport} title={t('report.preview')}>
          {t('report.preview')}
        </button>
        <button type="button" className="btn-icon !px-1.5 !py-1" onClick={() => void copyRaw()} title={t('sidebar.copyRaw')} aria-label={t('sidebar.copyRaw')}>
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </button>
      </div>

      <div ref={listRef} className="-mx-0.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden" role="listbox" aria-label={t('sidebar.hands')}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((v) => {
            const { r, i } = filtered[v.index];
            const selected = i === currentIndex;
            const coloured = showResult(r);
            return (
              <button
                key={r.hand.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(i)}
                title={`#${r.hand.handNumber}`}
                className="absolute left-0 flex w-full items-center gap-2 rounded-md pr-2 text-left text-xs transition-colors"
                style={{
                  top: v.start,
                  height: v.size - 2,
                  background: selected ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : undefined,
                  boxShadow: selected ? 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent)' : undefined,
                }}
              >
                <span
                  className={`h-[26px] w-[3px] shrink-0 rounded-full ${coloured ? `result-${r.meta.result}` : ''}`}
                  style={coloured ? undefined : { background: 'color-mix(in srgb, var(--text) 14%, transparent)' }}
                />
                <span className="w-5 shrink-0 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {i + 1}
                </span>
                <span className="flex w-[48px] shrink-0 items-center gap-[2px]">
                  {r.meta.heroCards?.length ? (
                    r.meta.heroCards.map((c) => <Card key={c} card={c} deck={skin.deck} width={22} />)
                  ) : r.meta.heroName ? (
                    <>
                      <Card card="back" deck={skin.deck} width={22} />
                      <Card card="back" deck={skin.deck} width={22} />
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>{t('positions.none')}</span>
                  )}
                </span>
                <span className="w-[34px] shrink-0 font-semibold" style={{ color: r.position ? 'var(--text)' : 'var(--text-muted)' }}>
                  {r.position ?? t('positions.none')}
                </span>
                <span className="min-w-0 flex-1 text-right font-medium tabular-nums" style={{ color: netColor(r) }}>
                  {r.meta.net !== undefined && !settings.hideResults ? `${r.meta.net > 0 ? '+' : ''}${fmt(r.meta.net)}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
