import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableRendererProps } from '../TableRenderer';
import { avoidZones, chipBreakdown, type FeltBox } from '../layout';
import { readableInk, textHalo } from '@/ui/contrast';
import { SeatPlate, seatLabels } from '../seats/SeatPlate';
import { useAssetImage } from '@/ui/hooks/useAssetImage';
import { AmountTspans } from '../Amount';
import { cardWidthFor } from '../cardSize';
import { shapeSvgPath } from '../tableShape';
import { CARD_H, CARD_W, cardPrimitives, patternShapes } from '@/ui/cards/primitives';
import type { DeckSkin } from '@/skins/types';

/* Scene geometry in SVG units. */
const VW = 1000;
const VH = 640;
const CX = VW / 2;
const CY = 300;
const RX = 360;

function CardShape({
  card,
  deck,
  x,
  y,
  w,
  art,
}: {
  card: string | 'back';
  deck: DeckSkin;
  x: number;
  y: number;
  w: number;
  art?: HTMLImageElement;
}) {
  const s = w / CARD_W;
  // The back keeps its printed pattern; only faces take artwork.
  const face = card === 'back' ? undefined : art;
  // Outer <g> carries the SVG transform; the inner one takes the CSS animation
  // (a CSS transform would otherwise override the attribute).
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="card-in" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      {face && (
        <image href={face.src} x={8} y={8} width={CARD_W - 16} height={CARD_H - 16} preserveAspectRatio="xMidYMid meet" />
      )}
      {cardPrimitives(card, deck, !!face).map((p, i) => {
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

/** Short label printed on a chip: 25, 1K, 5K, 1M … (R22). */
function chipLabel(d: number): string {
  if (d >= 1_000_000) return `${d / 1_000_000}M`;
  if (d >= 1000) return `${d / 1000}K`;
  return String(d);
}

function ChipStack({
  chips,
  colors,
  edge,
  x,
  y,
  zoom = 1,
  denominations = true,
}: {
  chips: number[];
  colors: Record<string, string>;
  edge: string;
  x: number;
  y: number;
  zoom?: number;
  denominations?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${zoom})`}>
      <g className="chips-in" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      {chips.map((d, i) => (
        <g key={i} transform={`translate(0 ${-i * 3.2})`}>
          <ellipse cx={0} cy={0} rx={13} ry={5.5} fill={colors[String(d)] ?? '#888'} stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
          {i === chips.length - 1 && !denominations && (
            <ellipse cx={0} cy={0} rx={8} ry={3.3} fill="none" stroke={edge} strokeWidth={1.2} strokeDasharray="3 3" />
          )}
          {i === chips.length - 1 && denominations && (
            <text x={0} y={2.4} textAnchor="middle" fontSize={6} fontWeight={700} fill="#fff" stroke="rgba(0,0,0,0.5)" strokeWidth={1.2} paintOrder="stroke">
              {chipLabel(d)}
            </text>
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
  hideHeroCards,
  lookupUrlFor,
  holeLayout,
  zoomCards = 1,
  boardGapRatio,
  deckArt,
  zoomChips = 1,
  chipDenominations = true,
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
  const feltLogo = useAssetImage(skin.felt.logoAssetId, skin.felt.logoBlend === 'screen');
  const shape = skin.table.shape ?? 'ellipse';
  const feltPath = shapeSvgPath(shape, CX, CY, RX, RY);
  const railPath = shapeSvgPath(shape, CX, CY, RX + rail, RY + rail);
  const bevel = skin.table.bevel;
  const neonStrength = neon ? (skin.table.neonIntensity ?? 0) : 0;
  const neonColor = skin.table.neonColor ?? skin.plates.activeBorder;

  const bySeat = new Map(frame.players.map((p) => [p.seat, p]));
  const winners = new Set(frame.kind === 'end' ? frame.players.filter((p) => p.collected > 0).map((p) => p.name) : []);
  const boardW = 64;
  // The skin sets the spacing; the quick controls can override it for the
  // session in front of you.
  const boardGap = boardW * (boardGapRatio ?? skin.deck.boardGap ?? 0.36);
  // Centre on the cards actually dealt (flop = 3, turn = 4, river = 5).
  const boardCount = Math.max(1, frame.board.length);
  const boardX0 = CX - (boardCount * boardW + (boardCount - 1) * boardGap) / 2;
  // Board dead centre; the pot block sits below it.
  const boardY = CY - (boardW * CARD_H) / CARD_W / 2;

  // Ink and halo follow the felt colour so on-table text always passes AA (R16).
  const ink = readableInk(skin.felt.color);
  const halo = textHalo(skin.felt.color, 0.62);

  // Areas reserved for cards and for the pot: nothing else may sit here (R4).
  const boardZone: FeltBox = {
    x: 0,
    y: 0,
    hw: (boardCount * boardW + (boardCount - 1) * boardGap) / 2 / RX + 0.02,
    hh: (boardW * CARD_H) / CARD_W / 2 / RY + 0.02,
  };
  const potZone: FeltBox = { x: 0, y: 84 / RY, hw: 95 / RX, hh: 40 / RY };
  // The pot's own chip stack is a band too, so a bet label never lands on the
  // chips. It sits left of the pot text, at (CX - 190, CY + 82).
  const potChipsZone: FeltBox = { x: -190 / RX, y: 82 / RY, hw: 70 / RX, hh: 42 / RY };
  const zones = frame.pot > 0 ? [boardZone, potZone, potChipsZone] : [boardZone, potZone];

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
            <path d={feltPath} />
          </clipPath>
          <filter id={`${feltId}-neon`} x="-25%" y="-35%" width="150%" height="170%">
            <feGaussianBlur stdDeviation={9} />
          </filter>
        </defs>
        {/* Shadow + rail */}
        <path d={railPath} transform="translate(0 10)" fill="rgba(0,0,0,0.35)" />
        <path d={railPath} fill={`url(#${feltId}-rail)`} />
        <path d={railPath} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
        {/* Felt */}
        <path d={feltPath} fill={skin.felt.color} />
        <path d={feltPath} fill={`url(#${feltId})`} />
        <g clipPath={`url(#${feltId}-clip)`}>
          <rect x={CX - RX} y={CY - RY} width={RX * 2} height={RY * 2} filter={`url(#${feltId}-noise)`} />
        </g>
        {/* Neon inside the felt: a blurred halo washing inwards, clipped to the
            cloth so it never touches the rail, under a crisp inner line. */}
        {neonStrength > 0 && (
          <g clipPath={`url(#${feltId}-clip)`}>
            <path d={shapeSvgPath(shape, CX, CY, RX * 0.9, RY * 0.9)} fill="none" stroke={neonColor} strokeWidth={16} opacity={0.5 * neonStrength} filter={`url(#${feltId}-neon)`} />
            <path d={shapeSvgPath(shape, CX, CY, RX * 0.9, RY * 0.9)} fill="none" stroke={neonColor} strokeWidth={2} opacity={0.5 + 0.5 * neonStrength} />
          </g>
        )}
        {bevel ? (
          <g>
            <path
              d={shapeSvgPath(shape, CX, CY, RX - RY * bevel.inset, RY - RY * bevel.inset)}
              fill="none"
              stroke={bevel.color}
              strokeWidth={Math.max(1, RY * bevel.width)}
              opacity={bevel.opacity}
            />
            <path
              d={shapeSvgPath(shape, CX, CY, RX - RY * bevel.inset - 1.5, RY - RY * bevel.inset - 1.5)}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={1}
              opacity={bevel.opacity}
            />
          </g>
        ) : (
          neonStrength === 0 && <path d={shapeSvgPath(shape, CX, CY, RX - 22, RY - 18)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
        )}
        {/* Uploaded watermark, centred on the cloth and clipped to it. */}
        {feltLogo && (
          <image
            href={feltLogo.src}
            x={CX - RX * 0.28}
            y={CY - RY * 0.44}
            width={RX * 0.56}
            height={RY * 0.88}
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
          {/* No box, no border: type straight on the felt, outlined for contrast. */}
          <text
            x={0}
            y={-9}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight={600}
            letterSpacing={2}
            fill={ink}
            fillOpacity={0.75}
            stroke={halo}
            strokeWidth={2}
            paintOrder="stroke"
          >
            {t('table.pot').toUpperCase()}
          </text>
          <text
            x={0}
            y={19}
            textAnchor="middle"
            fontSize={24}
            fontWeight={600}
            fill={ink}
            stroke={halo}
            strokeWidth={3}
            paintOrder="stroke"
          >
            <AmountTspans value={fmt(frame.totalPot)} size={24} />
          </text>
        </g>
        {frame.pots.length > 1 && (
          <text
            x={CX}
            y={CY + 126}
            textAnchor="middle"
            fontSize={11.5}
            fill={ink}
            fillOpacity={0.82}
            stroke={halo}
            strokeWidth={2.5}
            paintOrder="stroke"
          >
            {frame.pots.map((p) => fmt(p.amount)).join('   ')}
          </text>
        )}
        {frame.pot > 0 && (
          <ChipStack chips={chipBreakdown(frame.pot, isCash, 10)} colors={skin.chips.colors} edge={skin.chips.edge} x={CX - 190} y={CY + 82} zoom={zoomChips} denominations={chipDenominations} />
        )}

        {/* Board */}
        {frame.board.map((c, i) => (
          <CardShape key={c} card={c} deck={skin.deck} x={boardX0 + i * (boardW + boardGap)} y={boardY} w={boardW * zoomCards} art={deckArt?.[c[0]]} />
        ))}

        {/* Bets and dealer button — every group is kept inside the felt (R2) and
            out of the board / pot bands (R4). */}
        {slots.map((slot) => {
          const p = bySeat.get(slot.seat);
          if (!p) return null;
          const chips = p.streetBet > 0 ? chipBreakdown(p.streetBet, isCash) : [];
          const stackTop = -(chips.length * 3.2 + 8);
          const labelBottom = 40;
          const offsetY = (stackTop + labelBottom) / 2;
          const bet = avoidZones(
            {
              x: slot.betX,
              y: slot.betY + offsetY / RY,
              hw: Math.max(30, fmt(p.streetBet).length * 8 + 10) / 2 / RX,
              hh: (labelBottom - stackTop) / 2 / RY,
            },
            zones,
          );
          const bx = CX + bet.x * RX;
          const by = CY + (bet.y - offsetY / RY) * RY;
          const button = avoidZones({ x: slot.buttonX, y: slot.buttonY, hw: 13 / RX, hh: 13 / RY }, [boardZone]);
          return (
            <g key={slot.seat}>
              {p.streetBet > 0 && (
                <g>
                  <ChipStack chips={chips} colors={skin.chips.colors} edge={skin.chips.edge} x={bx} y={by} zoom={zoomChips} denominations={chipDenominations} />
                  <text
                    x={bx}
                    y={by + 32}
                    textAnchor="middle"
                    fontSize={14 * zoomChips}
                    fontWeight={600}
                    fill={ink}
                    stroke={halo}
                    strokeWidth={2.5}
                    paintOrder="stroke"
                  >
                    <AmountTspans value={fmt(p.streetBet)} size={14} />
                  </text>
                </g>
              )}
              {hand.buttonSeat === slot.seat && (
                <g transform={`translate(${CX + button.x * RX} ${CY + button.y * RY})`}>
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
              deckArt={deckArt}
              player={p}
              skin={skin}
              labels={labels}
              isHero={p.name === heroName}
              isActing={frame.actingPlayer === p.name}
              isWinner={winners.has(p.name)}
              position={positions[p.name]}
              showCards={showKnownHands}
              fmt={fmt}
              exact={exact}
              onClick={interactive && onSeatClick ? () => onSeatClick(p.name) : undefined}
              lookupUrl={lookupUrlFor?.(p.name)}
              forceFaceDown={hideHeroCards && p.name === heroName}
              layout={holeLayout}
              cardWidth={cardWidthFor(slots.length, p.name === heroName)}
              scale={slots.length > 8 ? 0.88 : 1}
            />
          </div>
        );
      })}
    </div>
  );
}
