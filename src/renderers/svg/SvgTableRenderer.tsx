import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableRendererProps } from '../TableRenderer';
import { chipBreakdown } from '../layout';
import { SeatPlate, seatLabels } from '../seats/SeatPlate';
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
}: TableRendererProps) {
  const { t } = useTranslation();
  const labels = useMemo(() => seatLabels(t), [t]);
  const RY = RX * skin.table.aspect;
  const rail = skin.table.railWidth * RX * 2;
  const isCash = hand.currency !== 'chips';
  const feltId = useMemo(() => `felt-${Math.random().toString(36).slice(2, 8)}`, []);

  const bySeat = new Map(frame.players.map((p) => [p.seat, p]));
  const winners = new Set(frame.kind === 'end' ? frame.players.filter((p) => p.collected > 0).map((p) => p.name) : []);
  const boardW = 80;
  const boardGap = 10;
  const boardX0 = CX - (5 * boardW + 4 * boardGap) / 2;
  const boardY = CY - (boardW * CARD_H) / CARD_W / 2 + 10;

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
        <ellipse cx={CX} cy={CY} rx={RX - 18} ry={RY - 14} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={2} />
        {skin.felt.logoText && (
          <text x={CX} y={CY + RY * 0.55} textAnchor="middle" fontSize={40} fontWeight={700} fill="#fff" opacity={skin.felt.logoOpacity} style={{ letterSpacing: 4 }}>
            {skin.felt.logoText}
          </text>
        )}

        {/* Pot */}
        <g transform={`translate(${CX} ${CY - 66})`}>
          <rect
            x={-80}
            y={-16}
            width={160}
            height={30}
            rx={15}
            fill="rgba(0,0,0,0.6)"
            stroke={skin.plates.activeBorder}
            strokeWidth={1.5}
          />
          <text x={0} y={5} textAnchor="middle" fontSize={17} fontWeight={600} fill="#fff">
            {t('table.pot')}: {fmt(frame.totalPot)}
          </text>
        </g>
        {frame.pots.length > 1 && (
          <text x={CX} y={CY - 34} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.8)">
            {frame.pots.map((p) => `${p.kind === 'main' ? t('table.mainPot') : t('table.sidePot', { index: p.index })} ${fmt(p.amount)}`).join(' · ')}
          </text>
        )}
        {frame.pot > 0 && (
          <ChipStack chips={chipBreakdown(frame.pot, isCash, 10)} colors={skin.chips.colors} edge={skin.chips.edge} x={CX - 150} y={CY + 6} />
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
                  {/* Below the stack (chips grow upwards) so the amount never sits on the chips. */}
                  <text
                    x={bx}
                    y={by + 32}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={600}
                    fill="#fff"
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                  >
                    {fmt(p.streetBet)}
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
        const px = ((CX + slot.x * (RX + rail + 12)) / VW) * 100;
        const py = ((CY + slot.y * (RY + rail + 34)) / VH) * 100;
        if (!p) {
          return (
            <div
              key={slot.seat}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide"
              style={{ left: `${px}%`, top: `${py}%`, borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.35)' }}
            >
              {t('game.seat', { seat: slot.seat })}
            </div>
          );
        }
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
              cardWidth={p.name === heroName ? 64 : 50}
              scale={slots.length > 8 ? 0.9 : 1}
            />
          </div>
        );
      })}
    </div>
  );
}
