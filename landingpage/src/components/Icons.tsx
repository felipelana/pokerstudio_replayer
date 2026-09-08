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

/* ------------------------------------------------------------------ */
/* Roadmap cards — same grid, same stroke, so the section reads as a set */
/* ------------------------------------------------------------------ */

/** A shared review: a link handed from one hand to another. */
function SharedIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
    </Icon>
  );
}

/** Audio feedback: a microphone. */
function AudioIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </Icon>
  );
}

/** Video feedback: a camera. */
function VideoIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <rect x="3" y="6" width="12" height="12" rx="2.5" />
      <path d="M15 10.5 21 7v10l-6-3.5v-3Z" />
    </Icon>
  );
}

/** Coach profile: a person with a badge. */
function ProfileIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M17.5 3.5 19 5l3-2" />
    </Icon>
  );
}

/** Dashboard: panels side by side. */
function DashboardIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <rect x="3" y="3.5" width="7.5" height="7" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7.5" height="17" rx="1.5" />
    </Icon>
  );
}

/** Real-time analysis: a spark over a chart. */
function AiIcon(p: { className?: string }) {
  return (
    <Icon {...p}>
      <path d="M3.5 20V8.5" />
      <path d="M8.5 20v-6" />
      <path d="M13.5 20v-9" />
      <path d="M18.5 3 20 6.5 23 8l-3 1.5L18.5 13 17 9.5 14 8l3-1.5L18.5 3Z" />
    </Icon>
  );
}

export const ROADMAP_ICONS: Record<string, (p: { className?: string }) => JSX.Element> = {
  shared: SharedIcon,
  audio: AudioIcon,
  video: VideoIcon,
  profile: ProfileIcon,
  dashboard: DashboardIcon,
  ai: AiIcon,
};

export const SECTION_ICONS: Record<SectionId, (p: { className?: string }) => JSX.Element> = {
  features: FeaturesIcon,
  how: HowIcon,
  coach: CoachIcon,
  reports: ReportsIcon,
  rooms: RoomsIcon,
  roadmap: RoadmapIcon,
  faq: FaqIcon,
};
