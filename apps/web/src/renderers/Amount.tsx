import { splitAmount } from '@/model/format';

/**
 * A money figure with its unit set smaller and dimmer, so the number reads
 * first ("52.5" big, "BB" quiet). Used for the pot and for every bet on the felt.
 */
export function Amount({
  value,
  size = 15,
  bold = true,
  className,
  style,
}: {
  value: string;
  size?: number;
  bold?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { value: n, unit } = splitAmount(value);
  return (
    <span className={className} style={{ fontSize: size, fontWeight: bold ? 600 : 500, ...style }}>
      {n}
      {unit && (
        <span style={{ fontSize: Math.max(9, Math.round(size * 0.66)), opacity: 0.6, marginLeft: 3, fontWeight: 500 }}>
          {unit}
        </span>
      )}
    </span>
  );
}

/** Same idea for SVG: two tspans inside one <text>. */
export function AmountTspans({ value, size }: { value: string; size: number }) {
  const { value: n, unit } = splitAmount(value);
  return (
    <>
      <tspan>{n}</tspan>
      {unit && (
        <tspan fontSize={Math.max(9, Math.round(size * 0.66))} fillOpacity={0.62} dx={3}>
          {unit}
        </tspan>
      )}
    </>
  );
}
