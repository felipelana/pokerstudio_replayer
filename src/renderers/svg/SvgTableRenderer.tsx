import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableRendererProps } from '../TableRenderer';
import { chipBreakdown } from '../layout';
import { SeatPlate, seatLabels } from '../seats/SeatPlate';
import { useAssetImage } from '@/ui/hooks/useAssetImage';
import { AmountTspans } from '../Amount';
import { cardWidthFor } from '../cardSize';
import { CARD_H, CARD_W, cardPrimitives, patternShapes } from '@/ui/cards/primitives';
import type { DeckSkin } from '@/skins/types';

/* Scene geometry in SVG units. */
const VW = 1000;
const VH = 640;
const CX = VW / 2;
const CY = 300;
const RX = 360;

function CardShape({ card, deck, x, y, w }: { card: string | 'back'; deck: DeckSkin; x: number; y: number; w: number }) {
  const s = w / CARD_W;
  // Outer <g> carries the SVG transform; the inner one takes the CSS animation
  // (a CSS transform would otherwise override the attribute).
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="card-in" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      {cardPrimitives(card, deck).map((p, i) => {
        switch (p.kind) {
          case 'rect':
            return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
          case 'text':
            return (
              <text key={i} x={p.x} y={p.y} fontSize={p.size} fontWeight={p.weight} fontFamily={p.font} fill={p.fill} textAnchor={p.anchor}>
                {p.text}
              </text>
            );
          case 'path':
            return <path key={i} d={p.d} fill={p.fill} transform={`translate(${p.x} ${p.y}) scale(${p.scale})`} />;
          case 'pattern':
            return (
              <g key={i} fill={p.ink} stroke={p.ink} strokeWidth={0.8}>
                {patternShapes(p.pattern, p.inset).map((sh, j) =>
                  sh.kind === 'circle' ? (
                    <circle key={j} cx={sh.x} cy={sh.y} r={sh.w} stroke="none" />
                  ) : sh.kind === 'diamond' ? (
                    <path key={j} stroke="none" d={`M${sh.x} ${sh.y - sh.h / 2} L${sh.x + sh.w / 2} ${sh.y} L${sh.x} ${sh.y + sh.h / 2} L${sh.x - sh.w / 2} ${sh.y} Z`} />
                  ) : (
                    <line key={j} x1={sh.x} y1={sh.y} x2={sh.x + sh.w} y2={sh.y + sh.h} />
                  ),
                )}
              </g>
            );
        }
      })}
      </g>
    </g>
  );
}

function ChipStack({ chips, colors, edge, x, y }: { chips: number[]; colors: Record<string, string>; edge: string; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="chips-in" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      {chips.map((d, i) => (
        <g key={i} transform={`translate(0 ${-i * 3.2})`}>
          <ellipse cx={0} cy={0} rx={13} ry={5.5} fill={colors[String(d)] ?? '#888'} stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
          {i === chips.length - 1 && (
            <ellipse cx={0} cy={0} rx={8} ry={3.3} fill="none" stroke={edge} strokeWidth={1.2} strokeDasharray="3 3" />
          )}
        </g>
      ))}
      </g>
    </g>
  );
}

export function SvgTableRenderer({
  hand,
  frame,
  skin,
  slots,
  heroName,
  positions,
  showKnownHands,
  equity,
  fmt,
  exact,
  onSeatClick,
  interactive = true,
  neon = true,
}: TableRendererProps) {
  const { t } = useTranslation();
  const labels = useMemo(() => seatLabels(t), [t]);
  const RY = RX * skin.table.aspect;
  const rail = skin.table.railWidth * RX * 2;
  const isCash = hand.currency !== 'chips';
  const feltId = useMemo(() => `felt-${Math.random().toString(36).slice(2, 8)}`, []);
  const feltLogo = useAssetImage(skin.felt.logoAssetId);
  const neonStrength = neon ? (skin.table.neonIntensity ?? 0) : 0;
  const neonColor = skin.table.neonColor ?? skin.plates.activeBorder;

  const bySeat = new Map(frame.players.map((p) => [p.seat, p]));
  const winners = new Set(frame.kind === 'end' ? frame.players.filter((p) => p.collected > 0).map((p) => p.name) : []);
  const boardW = 64;
  const boardGap = 9;
  // Centre on the cards actually dealt (flop = 3, turn = 4, river = 5).
  const boardCount = Math.max(1, frame.board.length);
  const boardX0 = CX - (boardCount * boardW + (boardCount - 1) * boardGap) / 2;
  // Board dead centre; the pot block sits below it.
  const boardY = CY - (boardW * CARD_H) / CARD_W / 2;

  return (
    <div className="relative h-full w-full select-none" style={{ aspectRatio: `${VW} / ${VH}` }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" role="img" aria-label={t('game.table')}>
        <defs>
          <radialGradient id={feltId} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor={skin.felt.color} />
            <stop offset="100%" stopColor={skin.felt.vignetteColor} stopOpacity={skin.felt.vignetteStrength} />
          </radialGradient>
          <linearGradient id={`${feltId}-rail`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skin.table.railHighlight} stopOpacity={0.5 + skin.table.railShine * 0.5} />
            <stop offset="55%" stopColor={skin.table.railColor} />
            <stop offset="100%" stopColor={skin.table.railHighlight} stopOpacity={skin.table.railShine * 0.5} />
          </linearGradient>
          <filter id={`${feltId}-noise`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope={skin.felt.textureIntensity * 0.25} />
            </feComponentTransfer>
          </filter>
          <clipPath id={`${feltId}-clip`}>
            <ellipse cx={CX} cy={CY} rx={RX} ry={RY} />
          </clipPath>
          <filter id={`${feltId}-neon`} x="-25%" y="-35%" width="150%" height="170%">
            <feGaussianBlur stdDeviation={9} />
          </filter>
        </defs>
        {/* Shadow + rail */}
        <ellipse cx={CX} cy={CY + 10} rx={RX + rail} ry={RY + rail} fill="rgba(0,0,0,0.35)" />
        <ellipse cx={CX} cy={CY} rx={RX + rail} ry={RY + rail} fill={`url(#${feltId}-rail)`} />
        <ellipse cx={CX} cy={CY} rx={RX + rail} ry={RY + rail} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
        {/* Felt */}
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill={skin.felt.color} />
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill={`url(#${feltId})`} />
        <g clipPath={`url(#${feltId}-clip)`}>
          <rect x={CX - RX} y={CY - RY} width={RX * 2} height={RY * 2} filter={`url(#${feltId}-noise)`} />
        </g>
        {/* Neon inside the felt: a blurred halo washing inwards, clipped to the
            cloth so it never touches the rail, under a crisp inner line. */}
        {neonStrength > 0 && (
          <g clipPath={`url(#${feltId}-clip)`}>
            <ellipse
              cx={CX}
              cy={CY}
              rx={RX * 0.9}
              ry={RY * 0.9}
              fill="none"
              stroke={neonColor}
              strokeWidth={16}
              opacity={0.5 * neonStrength}
              filter={`url(#${feltId}-neon)`}
            />
            <ellipse
              cx={CX}
              cy={CY}
              rx={RX * 0.9}
              ry={RY * 0.9}
              fill="none"
              stroke={neonColor}
              strokeWidth={2}
              opacity={0.5 + 0.5 * neonStrength}
            />
          </g>
        )}
        {neonStrength === 0 && (
          <ellipse cx={CX} cy={CY} rx={RX - 22} ry={RY - 18} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
        )}
        {/* Uploaded watermark, centred on the cloth and clipped to it. */}
        {feltLogo && (
          <image
            href={feltLogo.src}
            x={CX - RX * 0.44}
            y={CY - RY * 0.34}
            width={RX * 0.88}
            height={RY * 0.68}
            preserveAspectRatio="xMidYMid meet"
            opacity={skin.felt.logoOpacity}
            clipPath={`url(#${feltId}-clip)`}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {skin.felt.logoText && (
          <text x={CX} y={CY + RY * 0.55} textAnchor="middle" fontSize={40} fontWeight={700} fill="#fff" opacity={skin.felt.logoOpacity} style={{ letterSpacing: 4 }}>
            {skin.felt.logoText}
          </text>
        )}

        {/* Pot */}
        <g transform={`translate(${CX} ${CY + 84})`}>
          <rect
            x={-82}
            y={-24}
            width={164}
            height={48}
            rx={14}
            fill="rgba(0,0,0,0.45)"
            stroke={skin.plates.activeBorder}
            strokeOpacity={0.26}
            strokeWidth={1.5}
          />
          <text
            x={0}
            y={-9}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight={600}
            letterSpacing={2}
            fill="rgba(255,255,255,0.55)"
          >
            {t('table.pot').toUpperCase()}
          </text>
          <text x={0} y={17} textAnchor="middle" fontSize={22} fontWeight={600} fill="#fff">
            <AmountTspans value={fmt(frame.totalPot)} size={22} />
          </text>
        </g>
        {frame.pots.length > 1 && (
          <text x={CX} y={CY + 126} textAnchor="middle" fontSize={11.5} fill="rgba(255,255,255,0.75)">
            {frame.pots.map((p) => fmt(p.amount)).join('   ')}
          </text>
        )}
        {frame.pot > 0 && (
          <ChipStack chips={chipBreakdown(frame.pot, isCash, 10)} colors={skin.chips.colors} edge={skin.chips.edge} x={CX - 190} y={CY + 82} />
        )}

        {/* Board */}
        {frame.board.map((c, i) => (
          <CardShape key={c} card={c} deck={skin.deck} x={boardX0 + i * (boardW + boardGap)} y={boardY} w={boardW} />
        ))}

        {/* Bets and dealer button */}
        {slots.map((slot) => {
          const p = bySeat.get(slot.seat);
          if (!p) return null;
          const bx = CX + slot.betX * RX;
          const by = CY + slot.betY * RY;
          return (
            <g key={slot.seat}>
              {p.streetBet > 0 && (
                <g>
                  <ChipStack chips={chipBreakdown(p.streetBet, isCash)} colors={skin.chips.colors} edge={skin.chips.edge} x={bx} y={by} />
                  {/* Away from the centre: below the stack for near seats, above it for
                      far ones — never on the chips, never on the pot label. */}
                  {/* Clamped to the cloth so the amount never lands on the rail. */}
                  <text
                    x={bx}
                    y={Math.min(by + 32, CY + RY * 0.88)}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={600}
                    fill="#fff"
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                  >
                    <AmountTspans value={fmt(p.streetBet)} size={14} />
                  </text>
                </g>
              )}
              {hand.buttonSeat === slot.seat && (
                <g transform={`translate(${CX + slot.buttonX * RX} ${CY + slot.buttonY * RY})`}>
                  <circle r={12} fill={skin.chips.dealerButton} stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />
                  <text y={5} textAnchor="middle" fontSize={13} fontWeight={800} fill={skin.chips.dealerButtonInk}>
                    {t('table.dealer')}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* HTML seat plates */}
      {slots.map((slot) => {
        const p = bySeat.get(slot.seat);
        const px = ((CX + slot.x * (RX + rail + 16)) / VW) * 100;
        const py = ((CY + slot.y * (RY + rail + 52)) / VH) * 100;
        // Empty seats are simply left blank — no placeholder chrome.
        if (!p) return null;
        return (
          <div key={slot.seat} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${px}%`, top: `${py}%` }}>
            <SeatPlate
              player={p}
              skin={skin}
              labels={labels}
              isHero={p.name === heroName}
              isActing={frame.actingPlayer === p.name}
              isWinner={winners.has(p.name)}
              position={positions[p.name]}
              showCards={showKnownHands}
              equity={equity?.values[p.name]}
              equityPending={equity?.pending}
              fmt={fmt}
              exact={exact}
              onClick={interactive && onSeatClick ? () => onSeatClick(p.name) : undefined}
              cardWidth={cardWidthFor(slots.length, p.name === heroName)}
              scale={slots.length > 8 ? 0.88 : 1}
            />
          </div>
        );
      })}
    </div>
  );
}
