import { useMemo } from 'react';
import { DECK_PRESETS } from '@/skins/presets';
import { useDeckArt } from '@/ui/hooks/useDeckArt';
import { useTranslation } from 'react-i18next';
import type { Frame, HandReplay } from '@/engine/replay';
import { potOddsFor } from '@/engine/replay';
import { siteName } from '@/model/sites';
import { buildLookupUrl } from '@/model/lookup';
import { IconCompress, IconExpand } from '@/ui/icons';
import { QuickControls } from './QuickControls';
import { computePositions } from '@/model/positions';
import { anchorSeatFor, computeSeatSlots } from '@/renderers/layout';
import type { TableRendererProps } from '@/renderers/TableRenderer';
import { TableSurface } from '@/renderers/TableSurface';
import { useAppStore, useActiveSkin } from '@/state/store';
import { useAmountFormatter, useDateFormatter } from '@/ui/hooks/useFormat';

interface Props {
  replay: HandReplay;
  frame: Frame;
  heroName?: string;
  onSeatClick(player: string): void;
}

export function TableArea({ replay, frame, heroName, onSeatClick }: Props) {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const fullscreen = useAppStore((s) => s.fullscreen);
  const setFullscreen = useAppStore((s) => s.setFullscreen);
  const baseSkin = useActiveSkin();
  const { fmt, exact } = useAmountFormatter(replay.hand);
  const df = useDateFormatter();
  const hand = replay.hand;

  const positions = useMemo(() => computePositions(hand), [hand]);
  const slots = useMemo(
    () =>
      computeSeatSlots({
        maxSeats: hand.maxSeats,
        anchorSeat: anchorSeatFor(hand, heroName),
        buttonSeat: hand.buttonSeat,
        rotate: settings.rotateToHero,
      }),
    [hand, heroName, settings.rotateToHero],
  );

  const potOdds = useMemo(() => potOddsFor(frame, heroName), [frame, heroName]);

  // A deck chosen in the quick controls rides over the skin for this session
  // only — the skin itself is untouched.
  const skin = useMemo(() => {
    const preset = DECK_PRESETS.find((d) => d.id === settings.deckPreset);
    return preset ? { ...baseSkin, deck: { ...preset.deck, boardGap: baseSkin.deck.boardGap } } : baseSkin;
  }, [baseSkin, settings.deckPreset]);

  // Artwork the skin sets per card, loaded once for the whole table.
  const deckArt = useDeckArt(skin.deck);

  const rendererProps: TableRendererProps = {
    hand,
    frame,
    skin,
    slots,
    heroName,
    positions,
    showKnownHands: settings.showKnownHands,
    hideHeroCards: settings.hideHeroCards,
    holeLayout: settings.holeLayoutOverride === 'skin' ? undefined : settings.holeLayoutOverride,
    zoomCards: settings.zoomCards,
    boardGapRatio: settings.boardGap === 'skin' ? undefined : settings.boardGap,
    deckArt,
    zoomChips: settings.zoomChips,
    chipDenominations: settings.chipDenominations,
    lookupUrlFor: settings.playerLookupUrl
      ? (nick: string) => buildLookupUrl(settings.playerLookupUrl, nick, hand.site)
      : undefined,
    animations: settings.animations,
    neon: settings.neon,
    potOdds,
    fmt,
    exact,
    onSeatClick,
  };

  const session = useAppStore((s) => s.session);
  const sessionTitle = session?.name || session?.sourceFileName;

  const gameLine =
    hand.gameType === 'tournament'
      ? `${t('game.tournamentNumber', { id: hand.tournament?.id ?? '' })} · ${t('game.level', { level: hand.tournament?.level ?? '' })} · ${fmt(hand.blinds.sb)}/${fmt(hand.blinds.bb)}${hand.blinds.ante ? ` (${t('game.ante')} ${fmt(hand.blinds.ante)})` : ''}`
      : `${t('game.cash')} · ${fmt(hand.blinds.sb)}/${fmt(hand.blinds.bb)} · ${hand.tableName}`;

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      {sessionTitle && (
        <div className="truncate px-3 pt-1.5 text-sm font-semibold" title={sessionTitle}>
          {sessionTitle}
        </div>
      )}
      <div className="flex items-center gap-3 px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        {/* Room name only when the parser actually identified it (R7). */}
        {siteName(hand.site) && (
          <span
            className="rounded px-1.5 py-[1px] text-[11px] font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            {siteName(hand.site)}
          </span>
        )}
        <span className="font-semibold" style={{ color: 'var(--text)' }}>
          {t('game.hand', { number: hand.handNumber })}
        </span>
        <span>{gameLine}</span>
        <span>{df.dateTime(hand.timestamp)}</span>
        <div className="flex-1" />
        <QuickControls hand={hand} />
        <button
          type="button"
          className="btn-icon"
          onClick={() => setFullscreen(!fullscreen)}
          title={t('footer.fullscreen')}
          aria-label={t('footer.fullscreen')}
          aria-pressed={fullscreen}
        >
          {fullscreen ? <IconCompress size={15} /> : <IconExpand size={15} />}
        </button>
        {potOdds && (
          <div className="flex items-center gap-3 rounded-md px-2 py-1 font-medium tabular-nums" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            <span title={t('table.toCall', { amount: fmt(potOdds.toCall) })}>
              {t('table.potOdds')} {df.number(potOdds.ratio, 1)}:1
              <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                ({df.percent(potOdds.breakEven)})
              </span>
            </span>
          </div>
        )}
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-1">
        <div
          className="relative mx-auto h-full max-w-[1400px]"
          style={{ transform: `scale(${settings.zoomTable})`, transformOrigin: 'center center', zIndex: 1 }}
        >
          <TableSurface {...rendererProps} renderer={settings.renderer} />
        </div>
      </div>
    </div>
  );
}
