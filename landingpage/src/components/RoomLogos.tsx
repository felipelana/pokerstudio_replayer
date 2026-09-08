/*
 * Room marks, drawn as monochrome SVG.
 *
 * Each one is redrawn from the logo Felipe supplied, in a single weight and a
 * single colour, so the ten sit together as one row instead of ten different
 * colour schemes fighting each other on a black card. They inherit
 * `currentColor`, carry no background, and scale without blurring.
 *
 * WPN is the exception: its mark comes from the vector file Felipe provided
 * (`winning-logo.svg`), with the gradient plate and the small lettering
 * dropped — only the geometric mark is kept.
 */

interface MarkProps {
  className?: string;
}

const base = 'h-full w-full';

function Frame({
  children,
  viewBox,
  className,
}: MarkProps & { children: React.ReactNode; viewBox: string }) {
  return (
    <svg
      viewBox={viewBox}
      className={[base, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Spade with the star cut out of it. */
function PokerStarsMark(props: MarkProps) {
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M24 5C24 5 7 20 7 30a9 9 0 0 0 15 6.6L19 43h10l-3-7.4A9 9 0 0 0 41 30C41 20 24 5 24 5Z
           M24 17l1.94 5.33 5.67-.2-4.47 3.49 2.56 5.45L24 28.3l-5.7 2.77 2.56-5.45-4.47-3.49 5.67.2L24 17Z"
      />
    </Frame>
  );
}

/** The three eights, outlined. */
function EightEightEightMark(props: MarkProps) {
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="2.4">
        {[11, 24, 37].map((x) => (
          <g key={x}>
            <circle cx={x} cy="17.5" r="4.6" />
            <circle cx={x} cy="30" r="6" />
          </g>
        ))}
      </g>
    </Frame>
  );
}

/** The double G monogram. */
function GGPokerMark(props: MarkProps) {
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="square">
        <path d="M22.2 17.1A9.5 9.5 0 1 0 23 30.4V24h-5.4" />
        <path d="M42.2 17.1A9.5 9.5 0 1 0 43 30.4V24h-5.4" transform="translate(-6 0)" />
      </g>
    </Frame>
  );
}

/** The lowercase i inside its tilted ellipse. */
function IPokerMark(props: MarkProps) {
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <ellipse
        cx="24"
        cy="24"
        rx="16"
        ry="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        transform="rotate(-20 24 24)"
      />
      <circle cx="24" cy="15.5" r="2.9" fill="currentColor" />
      <rect x="21.8" y="20.5" width="4.4" height="12.5" rx="2.2" fill="currentColor" />
    </Frame>
  );
}

/**
 * The Winning Poker Network mark, from the vector file supplied with the
 * request. Only the geometric mark is kept — the plate and the small
 * "WINNING POKER NETWORK" lettering are dropped, because they are illegible at
 * the size this grid uses.
 */
function WpnMark(props: MarkProps) {
  return (
    <Frame viewBox="27 60 146 58" {...props}>
      <path
        fill="currentColor"
        d="M29.3335 63.7312V114.729H47.4541L56.4364 96.0125V114.729H72.1357L85.5309 76.1562V114.729H98.3013V78.476C98.3013 78.476 99.8634 80.9139 103.417 80.7959C103.417 80.7959 101.23 77.2571 104.628 75.0553C108.026 72.8534 111.189 74.1902 114.118 77.0212C117.047 79.8522 118.726 81.543 118.726 81.543L114.235 86.0647C114.235 86.0647 107.557 93.1815 103.183 86.4186V99.512C103.183 99.512 113.884 99.7479 117.906 98.1751C121.928 96.6023 125.326 93.5354 126.771 90.2326V114.729H139.541V96.1305L152.077 114.729H170.667V63.6919H157.974V99.394L138.253 63.7312H126.693V72.6568C126.693 72.6568 123.061 63.6133 110.994 63.6133C98.9262 63.6133 75.9629 63.6133 75.9629 63.6133L66.2387 87.5982V63.6133H56.163L42.4163 97.546V63.7706H29.3335V63.7312Z"
      />
    </Frame>
  );
}

/** Three leaning cards, each with a spade. */
function ChicoMark(props: MarkProps) {
  const spade =
    'M0 -4.2C0 -4.2 -3.7 -0.9 -3.7 1.2a1.95 1.95 0 0 0 3.2 1.45L-1.05 4.6h2.1L0.5 2.65A1.95 1.95 0 0 0 3.7 1.2C3.7 -0.9 0 -4.2 0 -4.2Z';
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <g transform="skewX(-13) translate(6 0)">
        {[2, 15, 28].map((x) => (
          <g key={x}>
            <rect
              x={x}
              y="14"
              width="11"
              height="20"
              rx="2.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            />
            <path d={spade} fill="currentColor" transform={`translate(${x + 5.5} 24)`} />
          </g>
        ))}
      </g>
    </Frame>
  );
}

/** The heavy W. */
function WinamaxMark(props: MarkProps) {
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <path
        d="M7 12 15.5 36 24 19.5 32.5 36 41 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.4"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
    </Frame>
  );
}

/** The looped knot inside its round badge. */
function CoinPokerMark(props: MarkProps) {
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="M24 24c-3-4.4-8.5-4.4-8.5 0S21 28.4 24 24c3-4.4 8.5-4.4 8.5 0S27 28.4 24 24Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </Frame>
  );
}

/** Flame over a die. */
function IgnitionMark(props: MarkProps) {
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <path
        d="M24 5c3.6 4.6 6 7.2 6 10.4a6 6 0 0 1-12 0C18 12.2 20.4 9.6 24 5Z"
        fill="currentColor"
      />
      <rect
        x="13"
        y="22"
        width="22"
        height="21"
        rx="4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        transform="rotate(-8 24 32.5)"
      />
      <g fill="currentColor" transform="rotate(-8 24 32.5)">
        <circle cx="19" cy="28" r="1.9" />
        <circle cx="29" cy="28" r="1.9" />
        <circle cx="24" cy="32.5" r="1.9" />
        <circle cx="19" cy="37" r="1.9" />
        <circle cx="29" cy="37" r="1.9" />
      </g>
    </Frame>
  );
}

/** The concave diamond that sits inside the "o". */
function PartyPokerMark(props: MarkProps) {
  return (
    <Frame viewBox="0 0 48 48" {...props}>
      <path
        d="M24 4c1.6 11 6.2 16.6 14.5 20-8.3 3.4-12.9 9-14.5 20-1.6-11-6.2-16.6-14.5-20C17.8 20.6 22.4 15 24 4Z"
        fill="currentColor"
      />
    </Frame>
  );
}

export const ROOM_MARKS: Record<string, (props: MarkProps) => JSX.Element> = {
  pokerstars: PokerStarsMark,
  '888poker': EightEightEightMark,
  ggpoker: GGPokerMark,
  ipoker: IPokerMark,
  wpn: WpnMark,
  chico: ChicoMark,
  winamax: WinamaxMark,
  coinpoker: CoinPokerMark,
  ignition: IgnitionMark,
  partypoker: PartyPokerMark,
};
