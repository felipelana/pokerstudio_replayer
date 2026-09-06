import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Hand } from '@/model/types';
import type { HandMeta } from '@/engine/replay';
import type { PositionLabel } from '@/model/positions';
import { useAppStore } from '@/state/store';
import type { Skin } from '@/skins/types';
import { Card } from '@/ui/cards/Card';

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
  fmt: (v: number) => string;
  onSelect(index: number): void;
}

export function Sidebar({ rows, currentIndex, skin, heroName, fmt, onSelect }: Props) {
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
    estimateSize: () => 44,
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

  const resultClass = (row: HandRow) => {
    if (!settings.colorHintResults || !row.meta.result) return 'result-none';
    if (settings.colorVpipOnly && !row.meta.vpip) return 'result-none';
    return `result-${row.meta.result}`;
  };

  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col gap-2 border-r p-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <button type="button" className="btn btn-primary w-full" onClick={() => setImportModalOpen(true)}>
        {t('sidebar.loadHands')}
      </button>
      <div className="flex flex-col gap-1 text-xs">
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
      </div>
      {!heroName && (
        <div className="rounded-md px-2 py-1 text-[11px]" style={{ background: 'color-mix(in srgb, var(--result-break-even) 15%, transparent)' }}>
          {t('sidebar.noHero')}
        </div>
      )}
      {focusPlayer && (
        <div className="flex items-center gap-1 text-[11px]">
          <span className="truncate">{t('sidebar.focus', { player: focusPlayer })}</span>
          <div className="flex-1" />
          <button type="button" className="btn btn-ghost !px-1 !py-0 text-[11px]" onClick={() => setFocus(undefined)}>
            {t('sidebar.clearFocus')}
          </button>
        </div>
      )}
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {t('sidebar.hands')} · {rows.length}
        </span>
        <div className="flex-1" />
        <button type="button" className="btn btn-ghost !px-1.5 !py-0.5 text-xs" onClick={() => void copyRaw()} title={t('sidebar.copyRaw')}>
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
      <input className="input !py-1 text-xs" placeholder={t('sidebar.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div ref={listRef} className="min-h-0 flex-1 overflow-auto rounded-md" role="listbox" aria-label={t('sidebar.hands')}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((v) => {
            const { r, i } = filtered[v.index];
            const selected = i === currentIndex;
            return (
              <button
                key={r.hand.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(i)}
                className="absolute left-0 flex w-full items-center gap-2 rounded-md px-1.5 text-left text-xs"
                style={{
                  top: v.start,
                  height: v.size,
                  background: selected ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : undefined,
                }}
              >
                <span className={`h-8 w-1 shrink-0 rounded ${resultClass(r)}`} style={{ opacity: resultClass(r) === 'result-none' ? 0.15 : 1, background: resultClass(r) === 'result-none' ? 'var(--text)' : undefined }} />
                <span className="w-7 shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {i + 1}
                </span>
                <span className="flex w-[50px] shrink-0 gap-[2px]">
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
                <span className="w-10 shrink-0 font-semibold">{r.position ?? t('positions.none')}</span>
                <span
                  className="flex-1 truncate text-right tabular-nums"
                  title={`#${r.hand.handNumber}`}
                  style={{
                    color:
                      r.meta.net === undefined || Math.abs(r.meta.net) < 0.005
                        ? 'var(--text-muted)'
                        : r.meta.net > 0
                          ? 'var(--result-won)'
                          : 'var(--result-lost)',
                  }}
                >
                  {r.meta.net !== undefined ? `${r.meta.net > 0 ? '+' : ''}${fmt(r.meta.net)}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
