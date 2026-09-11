import { memo, useId } from 'react';
import type { CardCode } from '@/domain/model/cards';
import type { DeckSkin } from '@/lib/skins/types';
import { CARD_H, CARD_W, cardPrimitives, glossStops, patternShapes } from './primitives';

/** Margin left around uploaded artwork, in card units. */
const ART_INSET = 8;

interface Props {
  card: CardCode | 'back';
  deck: DeckSkin;
  /** Rendered width in px; height follows the 100:140 ratio. */
  width?: number;
  className?: string;
  dimmed?: boolean;
  title?: string;
  /** Artwork for this card's rank, when the skin sets one. */
  art?: HTMLImageElement;
}

/** SVG playing card — used for hand-list mini-cards, board previews and the SVG table. */
export const Card = memo(function Card({
  card,
  deck,
  width = 40,
  className,
  dimmed,
  title,
  art,
}: Props) {
  // The back is never replaced by artwork — a marked deck would be worse than
  // a plain one.
  const showArt = card !== 'back' ? art : undefined;
  const prims = cardPrimitives(card, deck, !!showArt);
  const height = (width * CARD_H) / CARD_W;
  const glossId = useId();
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      className={className}
      style={{
        opacity: dimmed ? 0.45 : 1,
        display: 'block',
        flexShrink: 0,
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))',
      }}
      role="img"
      aria-label={title ?? (card === 'back' ? 'card back' : card)}
    >
      {title && <title>{title}</title>}
      {showArt && (
        <image
          href={showArt.src}
          x={ART_INSET}
          y={ART_INSET}
          width={CARD_W - ART_INSET * 2}
          height={CARD_H - ART_INSET * 2}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      {prims.map((p, i) => {
        switch (p.kind) {
          case 'rect':
            return (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx={p.rx}
                fill={p.fill}
                stroke={p.stroke}
                strokeWidth={p.strokeWidth}
              />
            );
          case 'text':
            return (
              <text
                key={i}
                x={p.x}
                y={p.y}
                fontSize={p.size}
                fontWeight={p.weight}
                fontFamily={p.font}
                fill={p.fill}
                textAnchor={p.anchor}
                style={{ userSelect: 'none' }}
              >
                {p.text}
              </text>
            );
          case 'path':
            return (
              <path
                key={i}
                d={p.d}
                fill={p.fill}
                transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}
              />
            );
          case 'pattern':
            return (
              <g key={i} fill={p.ink} stroke={p.ink} strokeWidth={0.8}>
                {patternShapes(p.pattern, p.inset).map((s, j) => {
                  if (s.kind === 'circle')
                    return <circle key={j} cx={s.x} cy={s.y} r={s.w} stroke="none" />;
                  if (s.kind === 'diamond')
                    return (
                      <path
                        key={j}
                        stroke="none"
                        d={`M${s.x} ${s.y - s.h / 2} L${s.x + s.w / 2} ${s.y} L${s.x} ${s.y + s.h / 2} L${s.x - s.w / 2} ${s.y} Z`}
                      />
                    );
                  return <line key={j} x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} />;
                })}
              </g>
            );
          case 'gloss':
            return (
              <g key={i}>
                <defs>
                  <linearGradient id={`${glossId}-g`} x1="0" y1="0" x2="1" y2="1">
                    {glossStops(p.strength).map((s, j) => (
                      <stop key={j} offset={s.offset} stopColor="#ffffff" stopOpacity={s.alpha} />
                    ))}
                  </linearGradient>
                </defs>
                <rect
                  x={0}
                  y={0}
                  width={CARD_W}
                  height={CARD_H}
                  rx={p.rx}
                  fill={`url(#${glossId}-g)`}
                  pointerEvents="none"
                />
              </g>
            );
        }
      })}
    </svg>
  );
});
