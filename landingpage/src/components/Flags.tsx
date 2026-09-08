import type { SVGProps } from 'react';

/**
 * Flags drawn as inline SVG (4:3, rounded corners) so they render identically
 * on every OS — no emoji, no external images. Simplified official designs.
 */
type FlagProps = SVGProps<SVGSVGElement> & { size?: number };

function Frame({ size = 20, children, ...rest }: FlagProps) {
  const id = `clip-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg
      width={size}
      height={(size * 3) / 4}
      viewBox="0 0 40 30"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
      {...rest}
    >
      <defs>
        <clipPath id={id}>
          <rect width="40" height="30" rx="3" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{children}</g>
    </svg>
  );
}

export function FlagBR(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="40" height="30" fill="#009c3b" />
      <path d="M20 4 L36 15 L20 26 L4 15 Z" fill="#ffdf00" />
      <circle cx="20" cy="15" r="6.5" fill="#002776" />
      <path d="M14 13.5 Q20 11 26 14" stroke="#fff" strokeWidth="1.1" fill="none" />
    </Frame>
  );
}

export function FlagUS(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="40" height="30" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 30) / 13} width="40" height={30 / 13} fill="#b22234" />
      ))}
      <rect width="16" height={(7 * 30) / 13} fill="#3c3b6e" />
      {Array.from({ length: 15 }, (_, i) => (
        <circle
          key={i}
          cx={2 + (i % 5) * 3}
          cy={2.2 + Math.floor(i / 5) * 4.5}
          r="0.75"
          fill="#fff"
        />
      ))}
    </Frame>
  );
}

export function FlagES(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="40" height="30" fill="#aa151b" />
      <rect y="7.5" width="40" height="15" fill="#f1bf00" />
      <rect x="9" y="12" width="5" height="6" rx="1" fill="#aa151b" />
    </Frame>
  );
}

export function FlagDE(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="40" height="10" fill="#000" />
      <rect y="10" width="40" height="10" fill="#dd0000" />
      <rect y="20" width="40" height="10" fill="#ffce00" />
    </Frame>
  );
}

export function FlagRU(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="40" height="10" fill="#fff" />
      <rect y="10" width="40" height="10" fill="#0039a6" />
      <rect y="20" width="40" height="10" fill="#d52b1e" />
    </Frame>
  );
}

export function FlagCN(p: FlagProps) {
  const star = (cx: number, cy: number, r: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.4;
      pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`);
    }
    return pts.join(' ');
  };
  return (
    <Frame {...p}>
      <rect width="40" height="30" fill="#de2910" />
      <polygon points={star(7, 8, 4)} fill="#ffde00" />
      <polygon points={star(14, 3.5, 1.4)} fill="#ffde00" />
      <polygon points={star(16.5, 7, 1.4)} fill="#ffde00" />
      <polygon points={star(16.5, 11, 1.4)} fill="#ffde00" />
      <polygon points={star(14, 14, 1.4)} fill="#ffde00" />
    </Frame>
  );
}

export function FlagJP(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="40" height="30" fill="#fff" />
      <circle cx="20" cy="15" r="8" fill="#bc002d" />
    </Frame>
  );
}

export function FlagKR(p: FlagProps) {
  return (
    <Frame {...p}>
      <rect width="40" height="30" fill="#fff" />
      <circle cx="20" cy="15" r="7" fill="#cd2e3a" />
      <path d="M13 15 a7 7 0 0 0 14 0 a3.5 3.5 0 0 0 -7 0 a3.5 3.5 0 0 1 -7 0 Z" fill="#0047a0" />
      <g stroke="#000" strokeWidth="1.2">
        <path d="M6 6 l4 -3 M7.5 7.5 l4 -3 M9 9 l4 -3" />
        <path d="M30 24 l4 -3 M31.5 25.5 l4 -3 M33 27 l4 -3" />
        <path d="M6 24 l4 3 M7.5 22.5 l4 3 M9 21 l4 3" />
        <path d="M30 6 l4 3 M31.5 4.5 l4 3 M33 3 l4 3" />
      </g>
    </Frame>
  );
}

export const FLAGS = {
  br: FlagBR,
  us: FlagUS,
  es: FlagES,
  de: FlagDE,
  ru: FlagRU,
  cn: FlagCN,
  jp: FlagJP,
  kr: FlagKR,
} as const;

export type FlagId = keyof typeof FLAGS;
