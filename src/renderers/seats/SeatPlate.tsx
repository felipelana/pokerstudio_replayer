import { memo } from 'react';
import type { TFunction } from 'i18next';
import type { PlayerState } from '@/engine/replay';
import type { PositionLabel } from '@/model/positions';
import type { Skin } from '@/skins/types';
import { Card } from '@/ui/cards/Card';
import { CARD_H, CARD_W } from '@/ui/cards/primitives';
import { Amount } from '../Amount';

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
}

export function seatLabels(t: TFunction): SeatLabels {
  return {
    fold: t('table.fold'),
    allIn: t('table.allIn'),
    sittingOut: t('table.sittingOut'),
    unknownCards: t('table.unknownCards'),
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
  fmt: (v: number) => string;
  exact: (v: number) => string;
  onClick?: () => void;
  cardWidth?: number;
  /** Extra shrink for crowded tables. */
  scale?: number;
}

/** Halo drawn around the player to act — colour and spread come from the skin. */
function actingGlow(p: Skin['plates']): string {
  const colour = p.activeGlow ?? p.activeBorder;
  const s = p.activeGlowStrength ?? 0.5;
  const ring = (1 + 2 * s).toFixed(1);
  const blur = Math.round(10 + 28 * s);
  const spread = Math.round(1 + 6 * s);
  const alpha = Math.round(28 + 42 * s);
  return [
    `0 0 0 ${ring}px color-mix(in srgb, ${colour} 60%, transparent)`,
    `0 0 ${blur}px ${spread}px color-mix(in srgb, ${colour} ${alpha}%, transparent)`,
    '0 6px 16px rgba(0,0,0,0.45)',
  ].join(', ');
}

/** Fanned pair: the second card sits on top, both tilted outwards. */
const OVERLAP_RATIO = 0.44;
const TILT_DEG = 6;

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
  fmt,
  exact,
  onClick,
  cardWidth = 50,
  scale = 1,
}: Props) {
  const p = skin.plates;
  const dim = player.folded || !player.inHand;
  const border = isActing ? p.activeBorder : isHero ? p.heroBorder : isWinner ? p.winnerGlow : p.border;
  const hasCards = player.inHand && player.dealt && !player.folded;
  const known = !!player.cards?.length;
  const showFaces = known && (showCards || isHero || player.revealed);
  const faces: (string | 'back')[] = showFaces ? player.cards! : ['back', 'back'];

  const overlap = skin.deck.holeLayout === 'overlap';
  const cardHeight = (cardWidth * CARD_H) / CARD_W;
  // Fanned cards need a little vertical slack for the rotation.
  const rowHeight = overlap ? cardHeight + cardWidth * 0.1 : cardHeight;

  return (
    <div
      className="seat-plate flex flex-col items-center"
      style={{ transform: `scale(${scale})`, transformOrigin: 'center bottom', opacity: dim ? 0.55 : 1 }}
    >
      {hasCards && (
        <div
          className="flex items-end justify-center"
          style={{ height: rowHeight, marginBottom: -6, zIndex: 0 }}
          aria-label={known ? player.cards!.join(' ') : labels.unknownCards}
        >
          {faces.map((c, i) => (
            <div
              key={`${c}-${i}`}
              className="flip-in"
              style={
                overlap
                  ? {
                      marginLeft: i === 0 ? 0 : -cardWidth * OVERLAP_RATIO,
                      transform: `rotate(${i === 0 ? -TILT_DEG : TILT_DEG}deg)`,
                      transformOrigin: 'bottom center',
                      zIndex: i,
                      filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))',
                    }
                  : { marginLeft: i === 0 ? 0 : 3, zIndex: i }
              }
            >
              <Card card={c} deck={skin.deck} width={cardWidth} />
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className="relative min-w-[124px] max-w-[168px] rounded-lg border-2 px-2.5 py-1 text-center shadow-lg"
        style={{
          // Above the cards, so a neighbouring pair can never cover the name.
          zIndex: 1,
          background: p.bg,
          borderColor: border,
          color: p.text,
          boxShadow: isActing
            ? actingGlow(p)
            : isWinner
              ? `0 0 16px ${p.winnerGlow}, 0 6px 16px rgba(0,0,0,0.4)`
              : '0 6px 16px rgba(0,0,0,0.4)',
          cursor: onClick ? 'pointer' : 'default',
        }}
        title={`${player.name} · ${exact(player.stack)}`}
      >
        <div className="flex items-center justify-center gap-1.5 truncate text-[13px] font-semibold leading-tight">
          {position && (
            <span
              className="rounded px-1 py-[1px] text-[10px] font-bold leading-none"
              style={{ background: `color-mix(in srgb, ${p.text} 14%, transparent)`, color: p.textMuted }}
            >
              {position}
            </span>
          )}
          <span className="truncate">{player.name}</span>
        </div>
        <Amount
          value={fmt(player.stack)}
          size={14}
          className="block tabular-nums leading-tight"
          style={{ color: player.stack === 0 ? p.allInLabel : p.textMuted }}
        />
        {(player.folded || player.allIn || player.sittingOut) && player.inHand && (
          <div
            className="absolute -top-2 right-1 rounded px-1 text-[9px] font-bold uppercase leading-[14px] tracking-wide text-white"
            style={{ background: player.folded ? p.foldLabel : player.allIn ? p.allInLabel : p.foldLabel }}
          >
            {player.folded ? labels.fold : player.allIn ? labels.allIn : labels.sittingOut}
          </div>
        )}
      </button>
    </div>
  );
});
