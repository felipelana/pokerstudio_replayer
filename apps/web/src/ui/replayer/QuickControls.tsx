import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hand } from '@/model/types';
import { SEAT_DISTANCE_DEFAULT } from '@/renderers/layout';
import { useActiveSkin, useAppStore } from '@/state/store';
import { DECK_PRESETS } from '@/skins/presets';
import { IconEye } from '@/ui/icons';

/**
 * Deck and visibility controls right inside the replayer (R8), so studying a
 * hand never means a trip to the settings page.
 */
export function QuickControls({ hand }: { hand: Hand }) {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const update = useAppStore((s) => s.updateSettings);
  const skins = useAppStore((s) => s.skins);
  const skin = useActiveSkin();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Revealing villains only makes sense when the history actually shows cards.
  const knownVillainCards = Object.keys(hand.holeCards).some((name) => name !== hand.heroName);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-icon"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={t('quick.title')}
        aria-label={t('quick.title')}
      >
        <IconEye size={15} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 z-30 flex w-[240px] flex-col gap-2 rounded-lg border p-3 text-xs shadow-2xl"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          role="dialog"
          aria-label={t('quick.title')}
        >
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('quick.deck')}</span>
            <select className="input !py-1 text-xs" value={settings.skinId} onChange={(e) => update({ skinId: e.target.value })}>
              {skins.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('quick.deckColours')}</span>
            <select
              className="input !py-1 text-xs"
              value={settings.deckPreset}
              onChange={(e) => update({ deckPreset: e.target.value })}
            >
              <option value="skin">{t('quick.layoutSkin')}</option>
              {DECK_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="label-caps">{t('quick.layout')}</span>
            <select
              className="input !py-1 text-xs"
              value={settings.holeLayoutOverride}
              onChange={(e) => update({ holeLayoutOverride: e.target.value as 'skin' | 'spread' | 'overlap' | 'fan' })}
            >
              <option value="skin">{t('quick.layoutSkin')}</option>
              <option value="spread">{t('admin.deck.layoutSpread')}</option>
              <option value="overlap">{t('admin.deck.layoutOverlap')}</option>
              <option value="fan">{t('admin.deck.layoutFan')}</option>
            </select>
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={settings.hideHeroCards} onChange={(e) => update({ hideHeroCards: e.target.checked })} />
            {t('quick.hideHero')}
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={settings.chipDenominations} onChange={(e) => update({ chipDenominations: e.target.checked })} />
            {t('quick.chipDenominations')}
          </label>

          <div className="flex items-center gap-2">
            <span className="label-caps flex-1">{t('quick.zoom')}</span>
            <button
              type="button"
              className="text-[10.5px] underline"
              style={{ color: 'var(--text-muted)' }}
              onClick={() =>
                update({
                  zoomTable: 1,
                  zoomCards: 1,
                  zoomChips: 1,
                  boardGapOverride: 'skin',
                  seatDistance: SEAT_DISTANCE_DEFAULT,
                })
              }
            >
              {t('common.reset')}
            </button>
          </div>
          {(
            [
              ['zoomTable', 'quick.zoomTable'],
              ['zoomCards', 'quick.zoomCards'],
              ['zoomChips', 'quick.zoomChips'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5">
              <span className="w-[52px] shrink-0 text-[10.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                {t(label)}
              </span>
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.05}
                value={settings[key]}
                onChange={(e) => update({ [key]: Number(e.target.value) })}
                className="w-full min-w-0 flex-1"
                style={{ accentColor: 'var(--accent)' }}
                aria-label={t(label)}
              />
              <span className="w-9 shrink-0 text-right text-[10.5px] tabular-nums">{Math.round(settings[key] * 100)}%</span>
            </label>
          ))}

          <label className="flex items-center gap-2">
            <span className="w-[52px] shrink-0 text-[10.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>
              {t('replayer.seatDistance')}
            </span>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.05}
              value={settings.seatDistance}
              onChange={(e) => update({ seatDistance: Number(e.target.value) })}
              className="w-full min-w-0 flex-1"
              style={{ accentColor: 'var(--accent)' }}
              aria-label={t('replayer.seatDistance')}
            />
            <span className="w-9 shrink-0 text-right text-[10.5px] tabular-nums">{Math.round(settings.seatDistance * 100)}%</span>
          </label>

          <label className="flex items-center gap-2">
            <span className="w-[52px] shrink-0 text-[10.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>
              {t('replayer.boardGap')}
            </span>
            <input
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={settings.boardGapOverride === 'skin' ? (skin.deck.boardGap ?? 0.36) : settings.boardGapOverride}
              onChange={(e) => update({ boardGapOverride: Number(e.target.value) })}
              className="w-full min-w-0 flex-1"
              style={{ accentColor: 'var(--accent)' }}
              aria-label={t('replayer.boardGap')}
            />
            <span className="w-9 shrink-0 text-right text-[10.5px] tabular-nums">
              {Math.round((settings.boardGapOverride === 'skin' ? (skin.deck.boardGap ?? 0.36) : settings.boardGapOverride) * 100)}%
            </span>
          </label>

          <label className="checkbox" title={knownVillainCards ? undefined : t('quick.revealDisabled')}>
            <input
              type="checkbox"
              disabled={!knownVillainCards}
              checked={settings.showKnownHands && knownVillainCards}
              onChange={(e) => update({ showKnownHands: e.target.checked })}
            />
            <span style={{ opacity: knownVillainCards ? 1 : 0.5 }}>{t('quick.revealVillains')}</span>
          </label>
        </div>
      )}
    </div>
  );
}
