import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Frame, HandReplay } from '@/engine/replay';
import { potOddsFor } from '@/engine/replay';
import { computePositions } from '@/model/positions';
import { anchorSeatFor, computeSeatSlots } from '@/renderers/layout';
import { hasWebGL, type TableRendererProps } from '@/renderers/TableRenderer';
import { SvgTableRenderer } from '@/renderers/svg/SvgTableRenderer';
import { useAppStore, useActiveSkin } from '@/state/store';
import { useEquity } from '@/equity/useEquity';
import { useAmountFormatter, useDateFormatter } from '@/ui/hooks/useFormat';

const ThreeTableRenderer = lazy(() =>
  import('@/renderers/three/ThreeTableRenderer').then((m) => ({ default: m.ThreeTableRenderer })),
);

interface Props {
  replay: HandReplay;
  frame: Frame;
  heroName?: string;
  onSeatClick(player: string): void;
}

export function TableArea({ replay, frame, heroName, onSeatClick }: Props) {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const skin = useActiveSkin();
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

  const equity = useEquity(hand, frame, settings.showEquity, settings.equityIterations);
  const potOdds = useMemo(() => potOddsFor(frame, heroName), [frame, heroName]);
  const heroEquity = heroName ? equity.values[heroName] : undefined;

  const useThree = settings.renderer === 'three' || (settings.renderer === 'auto' && hasWebGL());

  const rendererProps: TableRendererProps = {
    hand,
    frame,
    skin,
    slots,
    heroName,
    positions,
    showKnownHands: settings.showKnownHands,
    animations: settings.animations,
    equity: settings.showEquity ? equity : undefined,
    potOdds,
    fmt,
    exact,
    onSeatClick,
  };

  const gameLine =
    hand.gameType === 'tournament'
      ? `${t('game.tournamentNumber', { id: hand.tournament?.id ?? '' })} · ${t('game.level', { level: hand.tournament?.level ?? '' })} · ${fmt(hand.blinds.sb)}/${fmt(hand.blinds.bb)}${hand.blinds.ante ? ` (${t('game.ante')} ${fmt(hand.blinds.ante)})` : ''}`
      : `${t('game.cash')} · ${fmt(hand.blinds.sb)}/${fmt(hand.blinds.bb)} · ${hand.tableName}`;

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>
          {t('game.hand', { number: hand.handNumber })}
        </span>
        <span>{gameLine}</span>
        <span>{df.dateTime(hand.timestamp)}</span>
        <div className="flex-1" />
        {settings.showEquity && (potOdds || heroEquity !== undefined) && (
          <div className="flex items-center gap-3 rounded-md px-2 py-1 font-medium tabular-nums" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            {potOdds && (
              <span title={t('table.toCall', { amount: fmt(potOdds.toCall) })}>
                {t('table.potOdds')} {df.number(potOdds.ratio, 1)}:1
                <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                  ({t('table.requiredEquity')} {df.percent(potOdds.breakEven)})
                </span>
              </span>
            )}
            {heroEquity !== undefined && (
              <span
                style={{
                  color: potOdds ? (heroEquity >= potOdds.breakEven ? 'var(--result-won)' : 'var(--result-lost)') : undefined,
                  opacity: equity.pending ? 0.6 : 1,
                }}
              >
                {t('table.equity')} {df.percent(heroEquity)}
                {equity.pending && <span className="ml-1 inline-block animate-pulse">…</span>}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-1">
        <div className="mx-auto h-full max-w-[1400px]">
          {useThree ? (
            <Suspense fallback={<SvgTableRenderer {...rendererProps} />}>
              <ThreeTableRenderer {...rendererProps} />
            </Suspense>
          ) : (
            <SvgTableRenderer {...rendererProps} />
          )}
        </div>
      </div>
    </div>
  );
}
