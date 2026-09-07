import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Hand } from '@/model/types';
import type { HandMeta } from '@/engine/replay';
import type { PositionLabel } from '@/model/positions';
import { useAppStore } from '@/state/store';
import type { Skin } from '@/skins/types';
import { Card } from '@/ui/cards/Card';
import { IconCheck, IconCopy, IconDice, IconSearch, IconUpload, IconUser } from '@/ui/icons';

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
  /** True when at least one hand of the session names a hero ("Dealt to"). */
  sessionHasHero: boolean;
  /** Every player seen in the session, most frequent first (focus picker). */
  players: { name: string; count: number }[];
  fmt: (v: number) => string;
  onSelect(index: number): void;
}

const ROW_HEIGHT = 40;

export function Sidebar({ rows, currentIndex, skin, heroName, sessionHasHero, players, fmt, onSelect }: Props) {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setImportModalOpen = useAppStore((s) => s.setImportModalOpen);
  const focusPlayer = useAppStore((s) => s.focusPlayer);
  const setFocus = useAppStore((s) => s.setFocus);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const indexed = rows.map((r, i) => ({ r, i }));
    if (!q) return indexed;
    return indexed.filter(
      ({ r }) =>
        r.hand.handNumber.includes(q) ||
        r.hand.players.some((p) => p.name.toLowerCase().includes(q)) ||
        (r.meta.heroCards ?? []).join(' ').toLowerCase().includes(q),
    );
  }, [rows, filter]);

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

  return (
    <aside
      className="flex h-full w-[268px] shrink-0 flex-col gap-2 border-r p-2.5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <button type="button" className="btn btn-primary w-full justify-center" onClick={() => setImportModalOpen(true)}>
        <IconUpload size={15} />
        {t('sidebar.loadHands')}
      </button>

      <div className="flex flex-col gap-1.5 text-xs">
        <label className="checkbox">
          <input type="checkbox" checked={settings.showKnownHands} onChange={(e) => updateSettings({ showKnownHands: e.target.checked })} />
          {t('sidebar.showKnownHands')}
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={settings.colorHintResults} onChange={(e) => updateSettings({ colorHintResults: e.target.checked })} />
          {t('sidebar.colorHintResults')}
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={settings.colorVpipOnly} onChange={(e) => updateSettings({ colorVpipOnly: e.target.checked })} />
          {t('sidebar.colorVpipOnly')}
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={settings.hideResults} onChange={(e) => updateSettings({ hideResults: e.target.checked })} />
          {t('sidebar.hideResults')}
        </label>
        <label className="checkbox" title={t('sidebar.skipPostsHint')}>
          <input type="checkbox" checked={settings.skipPosts} onChange={(e) => updateSettings({ skipPosts: e.target.checked })} />
          {t('sidebar.skipPosts')}
        </label>
      </div>

      {/* Focus player is pinned for the whole session (every hand where they sit). */}
      <div
        className="flex flex-col gap-1 rounded-lg border px-2 py-1.5"
        style={{
          borderColor: !sessionHasHero && !focusPlayer ? 'color-mix(in srgb, var(--result-break-even) 55%, transparent)' : 'var(--border)',
          background: 'var(--surface-2)',
        }}
      >
        <span className="label-caps flex items-center gap-1.5">
          <IconUser size={12} />
          {t('sidebar.focusSelect')}
        </span>
        <select className="input !py-1 text-xs" value={focusPlayer ?? ''} onChange={(e) => setFocus(e.target.value || undefined)} aria-label={t('sidebar.focusSelect')}>
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
      </div>

      <button type="button" className="btn w-full justify-center" onClick={() => rows.length && onSelect(Math.floor(Math.random() * rows.length))}>
        <IconDice size={15} />
        {t('sidebar.randomHand')}
      </button>

      <div className="flex items-center gap-2">
        <span className="label-caps">{t('sidebar.hands')}</span>
        <span className="rounded-full px-1.5 text-[10px] font-semibold tabular-nums" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          {rows.length}
        </span>
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost !px-1.5 !py-1" onClick={() => void copyRaw()} title={t('sidebar.copyRaw')} aria-label={t('sidebar.copyRaw')}>
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
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
                  {r.meta.net !== undefined && !settings.hideResults
                    ? `${r.meta.net > 0 ? '+' : ''}${fmt(r.meta.net)}`
                    : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
