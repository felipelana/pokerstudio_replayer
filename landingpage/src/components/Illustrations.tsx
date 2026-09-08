import { useTranslation } from 'react-i18next';

/*
 * Diagrams for the three features that have no screenshot yet, plus the
 * evolution chart. They are drawn, not captured, and every one of them is
 * labelled as an illustration where it appears — nothing here should be
 * mistaken for the product.
 */

const INK = 'var(--text)';
const MUTED = 'var(--text-muted)';
const FAINT = 'var(--text-faint)';
const LINE = 'rgba(255,255,255,0.14)';
const PANEL = 'var(--surface)';
const ACCENT = '#e10600';

/** Session → link + password → coach, with the expiry underneath. */
export function ShareIllustration() {
  const { t } = useTranslation();
  return (
    <svg
      viewBox="0 0 420 236"
      role="img"
      aria-label={t('illus.share.alt')}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Session */}
      <rect x="8" y="52" width="104" height="76" rx="10" fill={PANEL} stroke={LINE} />
      <rect x="24" y="70" width="56" height="7" rx="3.5" fill={MUTED} opacity="0.7" />
      <rect x="24" y="85" width="72" height="7" rx="3.5" fill={FAINT} opacity="0.5" />
      <rect x="24" y="100" width="42" height="7" rx="3.5" fill={FAINT} opacity="0.5" />
      <text
        x="60"
        y="146"
        textAnchor="middle"
        fill={MUTED}
        fontSize="12"
        fontFamily="Inter, sans-serif"
      >
        {t('illus.share.session')}
      </text>

      <path d="M118 90 H146" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M140 84 L148 90 L140 96"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Link and password */}
      <rect
        x="154"
        y="52"
        width="112"
        height="76"
        rx="10"
        fill="rgba(225,6,0,0.10)"
        stroke="rgba(225,6,0,0.45)"
      />
      {/* A padlock: shackle over a body, the plainest way to say
          "this link needs a password". */}
      <g transform="translate(210 88)">
        <path
          d="M-9 -6 v-6 a9 9 0 0 1 18 0 v6"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <rect
          x="-14"
          y="-6"
          width="28"
          height="22"
          rx="4"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.6"
        />
        <circle cx="0" cy="4" r="2.6" fill={ACCENT} />
      </g>
      <text
        x="210"
        y="146"
        textAnchor="middle"
        fill={INK}
        fontSize="12"
        fontWeight="600"
        fontFamily="Inter, sans-serif"
      >
        {t('illus.share.link')}
      </text>

      <path d="M274 90 H302" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M296 84 L304 90 L296 96"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Coach */}
      <rect x="308" y="52" width="104" height="76" rx="10" fill={PANEL} stroke={LINE} />
      <g transform="translate(360 96)">
        <circle cx="0" cy="-14" r="11" fill="none" stroke={MUTED} strokeWidth="2.2" />
        <path
          d="M-19 18 a19 19 0 0 1 38 0"
          fill="none"
          stroke={MUTED}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
      <text
        x="360"
        y="146"
        textAnchor="middle"
        fill={MUTED}
        fontSize="12"
        fontFamily="Inter, sans-serif"
      >
        {t('illus.share.coach')}
      </text>

      <g transform="translate(210 186)">
        <rect
          x="-116"
          y="-16"
          width="232"
          height="32"
          rx="16"
          fill="rgba(255,255,255,0.04)"
          stroke={LINE}
        />
        <circle cx="-96" cy="0" r="7" fill="none" stroke={FAINT} strokeWidth="2" />
        <path
          d="M-96 -4 V0 l3 2"
          stroke={FAINT}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <text x="-82" y="4" fill={FAINT} fontSize="11.5" fontFamily="Inter, sans-serif">
          {t('illus.share.expires')}
        </text>
      </g>
    </svg>
  );
}

/** A hand list where the first rows are done and one is the resume point. */
export function ResumeIllustration() {
  const { t } = useTranslation();
  const rows = [0, 1, 2, 3, 4, 5, 6];
  const currentRow = 3;
  return (
    <svg
      viewBox="0 0 420 236"
      role="img"
      aria-label={t('illus.resume.alt')}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {rows.map((i) => {
        const y = 20 + i * 29;
        const done = i < currentRow;
        const isCurrent = i === currentRow;
        return (
          <g key={i}>
            <rect
              x="18"
              y={y}
              width="384"
              height="23"
              rx="6"
              fill={isCurrent ? 'rgba(225,6,0,0.12)' : PANEL}
              stroke={isCurrent ? 'rgba(225,6,0,0.55)' : LINE}
            />
            <rect
              x="30"
              y={y + 8}
              width="14"
              height="7"
              rx="2"
              fill={done ? MUTED : FAINT}
              opacity={done ? 0.8 : 0.45}
            />
            <rect
              x="52"
              y={y + 8}
              width="70"
              height="7"
              rx="3.5"
              fill={done ? MUTED : FAINT}
              opacity={done ? 0.6 : 0.35}
            />
            {done ? (
              <path
                d={`M378 ${y + 12} l4 4 l8 -9`}
                fill="none"
                stroke={MUTED}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {isCurrent ? (
              <>
                <path d={`M372 ${y + 6} l8 5.5 l-8 5.5 z`} fill={ACCENT} />
                <text
                  x="140"
                  y={y + 16}
                  fill={INK}
                  fontSize="11.5"
                  fontWeight="600"
                  fontFamily="Inter, sans-serif"
                >
                  {t('illus.resume.here')}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
      <text
        x="18"
        y="14"
        fill={FAINT}
        fontSize="10.5"
        letterSpacing="1.4"
        fontFamily="Inter, sans-serif"
      >
        {t('illus.resume.done').toUpperCase()}
      </text>
      <text
        x="402"
        y="14"
        textAnchor="end"
        fill={FAINT}
        fontSize="10.5"
        letterSpacing="1.4"
        fontFamily="Inter, sans-serif"
      >
        {t('illus.resume.todo').toUpperCase()}
      </text>
    </svg>
  );
}

/** Reviews kept in the account, reachable from every device. */
export function SaveIllustration() {
  const { t } = useTranslation();
  return (
    <svg
      viewBox="0 0 420 236"
      role="img"
      aria-label={t('illus.save.alt')}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(210 74)">
        <ellipse
          cx="0"
          cy="-26"
          rx="58"
          ry="16"
          fill="rgba(225,6,0,0.16)"
          stroke="rgba(225,6,0,0.5)"
        />
        <path
          d="M-58 -26 V14 a58 16 0 0 0 116 0 V-26"
          fill="rgba(225,6,0,0.08)"
          stroke="rgba(225,6,0,0.5)"
        />
        <ellipse cx="0" cy="-6" rx="58" ry="16" fill="none" stroke="rgba(225,6,0,0.35)" />
        <text
          x="0"
          y="46"
          textAnchor="middle"
          fill={INK}
          fontSize="12.5"
          fontWeight="600"
          fontFamily="Inter, sans-serif"
        >
          {t('illus.save.account')}
        </text>
      </g>

      {[
        { x: 56, w: 74, h: 54, label: 0 },
        { x: 173, w: 74, h: 54, label: 1 },
        { x: 290, w: 74, h: 54, label: 2 },
      ].map((d, i) => (
        <g key={i}>
          <path
            d={`M210 138 C 210 160, ${d.x + d.w / 2} 150, ${d.x + d.w / 2} 172`}
            fill="none"
            stroke={LINE}
            strokeWidth="1.6"
            strokeDasharray="4 4"
          />
          <rect x={d.x} y={172} width={d.w} height={d.h} rx="8" fill={PANEL} stroke={LINE} />
          <rect
            x={d.x + 12}
            y={188}
            width={d.w - 34}
            height="6"
            rx="3"
            fill={MUTED}
            opacity="0.55"
          />
          <rect
            x={d.x + 12}
            y={202}
            width={d.w - 22}
            height="6"
            rx="3"
            fill={FAINT}
            opacity="0.4"
          />
          <rect
            x={d.x + 12}
            y={216}
            width={d.w - 42}
            height="6"
            rx="3"
            fill={FAINT}
            opacity="0.4"
          />
        </g>
      ))}
      <text
        x="210"
        y="166"
        textAnchor="middle"
        fill={FAINT}
        fontSize="11.5"
        fontFamily="Inter, sans-serif"
      >
        {t('illus.save.sessions')}
      </text>
    </svg>
  );
}

/**
 * What a report puts together: the 0-100 scale, how much of the session was
 * reviewed, and the leaks ranked by how often their tag was used. Deliberately
 * without numbers or tag names — the shape of the report, not made-up results.
 */
export function ReportIllustration() {
  const { t } = useTranslation();
  return (
    <svg
      viewBox="0 0 420 236"
      role="img"
      aria-label={t('reports.chart.alt')}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <text
        x="14"
        y="20"
        fill={FAINT}
        fontSize="10.5"
        letterSpacing="1.3"
        fontFamily="Inter, sans-serif"
      >
        {t('reports.items.score.title').toUpperCase()}
      </text>
      <rect x="14" y="30" width="392" height="12" rx="6" fill={PANEL} stroke={LINE} />
      <rect x="14" y="30" width="272" height="12" rx="6" fill={ACCENT} opacity="0.75" />
      <text x="14" y="60" fill={FAINT} fontSize="11" fontFamily="Inter, sans-serif">
        0
      </text>
      <text
        x="406"
        y="60"
        textAnchor="end"
        fill={FAINT}
        fontSize="11"
        fontFamily="Inter, sans-serif"
      >
        100
      </text>

      <g transform="translate(66 148)">
        <circle cx="0" cy="0" r="38" fill="none" stroke={LINE} strokeWidth="10" />
        <circle
          cx="0"
          cy="0"
          r="38"
          fill="none"
          stroke={ACCENT}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="170 239"
          transform="rotate(-90)"
        />
        <text
          x="0"
          y="66"
          textAnchor="middle"
          fill={MUTED}
          fontSize="11.5"
          fontFamily="Inter, sans-serif"
        >
          {t('reports.items.coverage.title')}
        </text>
      </g>

      <g transform="translate(148 108)">
        <text
          x="0"
          y="0"
          fill={FAINT}
          fontSize="10.5"
          letterSpacing="1.3"
          fontFamily="Inter, sans-serif"
        >
          {t('reports.items.leaks.title').toUpperCase()}
        </text>
        {[
          { w: 236, o: 0.85 },
          { w: 188, o: 0.6 },
          { w: 140, o: 0.45 },
          { w: 96, o: 0.32 },
        ].map((bar, i) => (
          <g key={i} transform={`translate(0 ${16 + i * 26})`}>
            <rect x="0" y="0" width="34" height="12" rx="6" fill={PANEL} stroke={LINE} />
            <rect x="42" y="0" width={bar.w} height="12" rx="6" fill={ACCENT} opacity={bar.o} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * The evolution chart: two series of scores from 0 to 100 and a trend line.
 * The numbers are made up to show the shape of the chart, and the caption under
 * it says so.
 */
export function EvolutionChart() {
  const { t } = useTranslation();

  const self = [52, 58, 55, 64, 61, 70, 68, 75, 79];
  const coaches = [44, 49, 52, 56, 58, 61, 66, 69, 73];

  const W = 640;
  const H = 300;
  const pad = { top: 20, right: 20, bottom: 34, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const x = (i: number) => pad.left + (i / (self.length - 1)) * innerW;
  const y = (v: number) => pad.top + (1 - v / 100) * innerH;
  const line = (values: number[]) =>
    values.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t('reports.chart.alt')}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={y(v)}
            y2={y(v)}
            stroke={LINE}
            strokeWidth="1"
          />
          <text
            x={pad.left - 10}
            y={y(v) + 4}
            textAnchor="end"
            fill={FAINT}
            fontSize="11"
            fontFamily="Inter, sans-serif"
          >
            {v}
          </text>
        </g>
      ))}

      {/* Trend: a straight line through the self-assessment series. */}
      <path
        d={`M${x(0)} ${y(51)} L${x(self.length - 1)} ${y(80)}`}
        stroke={FAINT}
        strokeWidth="1.6"
        strokeDasharray="6 5"
        fill="none"
      />

      <path
        d={line(coaches)}
        fill="none"
        stroke={MUTED}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={line(self)}
        fill="none"
        stroke={ACCENT}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {self.map((v, i) => (
        <circle key={`s${i}`} cx={x(i)} cy={y(v)} r="3.4" fill={ACCENT} />
      ))}
      {coaches.map((v, i) => (
        <circle key={`c${i}`} cx={x(i)} cy={y(v)} r="3" fill={MUTED} />
      ))}

      <g
        transform={`translate(${pad.left}, ${H - 10})`}
        fontSize="11.5"
        fontFamily="Inter, sans-serif"
      >
        <line
          x1="0"
          x2="16"
          y1="-4"
          y2="-4"
          stroke={ACCENT}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <text x="22" y="0" fill={MUTED}>
          {t('reports.chart.self')}
        </text>
        <line
          x1="150"
          x2="166"
          y1="-4"
          y2="-4"
          stroke={MUTED}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <text x="172" y="0" fill={MUTED}>
          {t('reports.chart.coaches')}
        </text>
        <line
          x1="320"
          x2="336"
          y1="-4"
          y2="-4"
          stroke={FAINT}
          strokeWidth="1.6"
          strokeDasharray="6 5"
        />
        <text x="342" y="0" fill={MUTED}>
          {t('reports.chart.trend')}
        </text>
      </g>
    </svg>
  );
}
