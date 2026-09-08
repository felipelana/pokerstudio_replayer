import type { SectionId } from '@/config';

/*
 * One icon per navigation entry, all drawn on the same 24-unit grid with the
 * same stroke weight so the menu reads as a set. Decorative: every one sits
 * next to its own label.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
      {children}
    </svg>
  );
}

/** Features: the replayer's own play control. */
function FeaturesIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M10 9.5 15 12l-5 2.5V9.5Z" />
    </Icon>
  );
}

/** How it works: numbered steps. */
function HowIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <path d="M4 7h1.5M4 12h1.5M4 17h1.5" />
      <path d="M9 7h11M9 12h11M9 17h7" />
    </Icon>
  );
}

/** Coach review: a person with a comment. */
function CoachIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M14 4h7v6h-3l-2.5 2.2V10H14V4Z" />
    </Icon>
  );
}

/** Reports: the score curve. */
function ReportsIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <path d="M3.5 4v16h17" />
      <path d="M7 15.5l4-4.5 3 2.5 5-6.5" />
    </Icon>
  );
}

/** Rooms: a spade, for the poker rooms. */
function RoomsIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <path d="M12 3.5S5 9.4 5 13.2a3.6 3.6 0 0 0 6 2.6l-1.2 4.7h4.4L13 15.8a3.6 3.6 0 0 0 6-2.6C19 9.4 12 3.5 12 3.5Z" />
    </Icon>
  );
}

/** Coming soon: a clock. */
function RoadmapIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

/** FAQ: a question mark in a bubble. */
function FaqIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <path d="M4 5.5h16v11H13l-4 3.5v-3.5H4v-11Z" />
      <path d="M9.8 9.2a2.2 2.2 0 1 1 2.7 2.4v1.1" />
      <path d="M12.4 14.6h.01" />
    </Icon>
  );
}

export const SECTION_ICONS: Record<SectionId, (p: { className?: string }) => JSX.Element> = {
  features: FeaturesIcon,
  how: HowIcon,
  coach: CoachIcon,
  reports: ReportsIcon,
  rooms: RoomsIcon,
  roadmap: RoadmapIcon,
  faq: FaqIcon,
};
