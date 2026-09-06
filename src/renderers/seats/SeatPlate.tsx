import { memo } from 'react';
import type { TFunction } from 'i18next';
import type { PlayerState } from '@/engine/replay';
import type { PositionLabel } from '@/model/positions';
import type { Skin } from '@/skins/types';
import { Card } from '@/ui/cards/Card';

/**
 * Translated strings the plate needs. Passed in as props (instead of calling
 * useTranslation) because plates are rendered inside the R3F canvas root /
 * drei <Html> portals, where React context from the app root is unavailable.
 */
export interface SeatLabels {
  fold: string;
  allIn: string;
  sittingOut: string;
  unknownCards: string;
  equity: string;
}

export function seatLabels(t: TFunction): SeatLabels {
  return {
    fold: t('table.fold'),
    allIn: t('table.allIn'),
    sittingOut: t('table.sittingOut'),
    unknownCards: t('table.unknownCards'),
    equity: t('table.equity'),
  };
}

interface Props {
  player: PlayerState;
  skin: Skin;
  labels: SeatLabels;
  isHero: boolean;
  isActing: boolean;
  isWinner: boolean;
  position?: PositionLabel;
  showCards: boolean;
  equity?: number;
  equityPending?: boolean;
  fmt: (v: number) => string;
  exact: (v: number) => string;
  onClick?: () => void;
  cardWidth?: number;
  /** Extra shrink for crowded tables. */
  scale?: number;
}

/** HTML plate rendered over the canvas (crisp text, i18n-friendly). */
export const SeatPlate = memo(function SeatPlate({
  player,
  skin,
  labels,
  isHero,
  isActing,
  isWinner,
  position,
  showCards,
  equity,
  equityPending,
  fmt,
  exact,
  onClick,
  cardWidth = 34,
  scale = 1,
}: Props) {
  const p = skin.plates;
  const dim = player.folded || !player.inHand;
  const border = isActing ? p.activeBorder : isHero ? p.heroBorder : isWinner ? p.winnerGlow : p.border;
  const hasCards = player.inHand && player.dealt && !player.folded;
  const known = !!player.cards?.length;
  const showFaces = known && (showCards || isHero || player.revealed);

  return (
    <div
      className="seat-plate flex flex-col items-center"
      style={{ transform: `scale(${scale})`, transformOrigin: 'center bottom', opacity: dim ? 0.55 : 1 }}
    >
      {hasCards && (
        <div className="mb-[-6px] flex gap-[2px]" aria-label={known ? player.cards!.join(' ') : labels.unknownCards}>
          {showFaces ? (
            player.cards!.map((c) => (
              <div key={c} className="flip-in">
                <Card card={c} deck={skin.deck} width={cardWidth} />
              </div>
            ))
          ) : (
            <>
              <Card card="back" deck={skin.deck} width={cardWidth} />
              <Card card="back" deck={skin.deck} width={cardWidth} />
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className="relative min-w-[118px] max-w-[160px] rounded-lg border-2 px-2.5 py-1 text-center shadow-lg"
        style={{
          background: p.bg,
          borderColor: border,
          color: p.text,
          boxShadow: isActing
            ? `0 0 0 3px color-mix(in srgb, ${p.activeBorder} 35%, transparent), 0 6px 16px rgba(0,0,0,0.35)`
            : isWinner
              ? `0 0 14px ${p.winnerGlow}`
              : '0 6px 16px rgba(0,0,0,0.35)',
          cursor: onClick ? 'pointer' : 'default',
        }}
        title={`${player.name} · ${exact(player.stack)}`}
      >
        <div className="flex items-center justify-center gap-1.5 truncate text-[13px] font-semibold leading-tight">
          {position && (
            <span
              className="rounded px-1 text-[10px] font-bold"
              style={{ background: `color-mix(in srgb, ${p.text} 14%, transparent)`, color: p.textMuted }}
            >
              {position}
            </span>
          )}
          <span className="truncate">{player.name}</span>
        </div>
        <div className="text-[13px] tabular-nums leading-tight" style={{ color: player.stack === 0 ? p.allInLabel : p.textMuted }}>
          {fmt(player.stack)}
        </div>
        {(player.folded || player.allIn || player.sittingOut) && player.inHand && (
          <div
            className="absolute -top-2 right-1 rounded px-1 text-[9px] font-bold uppercase tracking-wide text-white"
            style={{ background: player.folded ? p.foldLabel : player.allIn ? p.allInLabel : p.foldLabel }}
          >
            {player.folded ? labels.fold : player.allIn ? labels.allIn : labels.sittingOut}
          </div>
        )}
      </button>
      {equity !== undefined && hasCards && (
        <div
          className="mt-0.5 rounded px-1.5 text-[11px] font-semibold tabular-nums"
          style={{
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            opacity: equityPending ? 0.6 : 1,
          }}
          aria-label={labels.equity}
        >
          {(equity * 100).toFixed(1)}%
        </div>
      )}
    </div>
  );
});
