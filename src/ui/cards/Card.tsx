import { memo } from 'react';
import type { CardCode } from '@/model/cards';
import type { DeckSkin } from '@/skins/types';
import { CARD_H, CARD_W, cardPrimitives, patternShapes } from './primitives';

interface Props {
  card: CardCode | 'back';
  deck: DeckSkin;
  /** Rendered width in px; height follows the 100:140 ratio. */
  width?: number;
  className?: string;
  dimmed?: boolean;
  title?: string;
}

/** SVG playing card — used for hand-list mini-cards, board previews and the SVG table. */
export const Card = memo(function Card({ card, deck, width = 40, className, dimmed, title }: Props) {
  const prims = cardPrimitives(card, deck);
  const height = (width * CARD_H) / CARD_W;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      className={className}
      style={{ opacity: dimmed ? 0.45 : 1, display: 'block', flexShrink: 0 }}
      role="img"
      aria-label={title ?? (card === 'back' ? 'card back' : card)}
    >
      {title && <title>{title}</title>}
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
                  if (s.kind === 'circle') return <circle key={j} cx={s.x} cy={s.y} r={s.w} stroke="none" />;
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
        }
      })}
    </svg>
  );
});
