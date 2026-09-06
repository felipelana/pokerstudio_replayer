import type { SVGProps } from 'react';

/**
 * Inline stroke icons (24x24 grid, 1.8 stroke) so every control aligns on the
 * same optical size and inherits currentColor. No icon font, no external file.
 */
type Props = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconPlay = (p: Props) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPause = (p: Props) => (
  <Svg {...p}>
    <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPrev = (p: Props) => (
  <Svg {...p}>
    <path d="M15 5.5v13L6.5 12z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconNext = (p: Props) => (
  <Svg {...p}>
    <path d="M9 5.5v13L17.5 12z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconFirst = (p: Props) => (
  <Svg {...p}>
    <path d="M17 5.5v13L8.5 12z" fill="currentColor" stroke="none" />
    <rect x="5" y="5.5" width="2.4" height="13" rx="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconLast = (p: Props) => (
  <Svg {...p}>
    <path d="M7 5.5v13L15.5 12z" fill="currentColor" stroke="none" />
    <rect x="16.6" y="5.5" width="2.4" height="13" rx="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconUpload = (p: Props) => (
  <Svg {...p}>
    <path d="M12 16V4" />
    <path d="M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
  </Svg>
);

export const IconDice = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <circle cx="8.6" cy="8.6" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="15.4" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCopy = (p: Props) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
  </Svg>
);

export const IconCheck = (p: Props) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const IconSearch = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Svg>
);

export const IconUser = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </Svg>
);

export const IconMoon = (p: Props) => (
  <Svg {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z" />
  </Svg>
);

export const IconSun = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </Svg>
);

export const IconHelp = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4" />
    <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconNote = (p: Props) => (
  <Svg {...p}>
    <path d="M4.5 19.5 4 20l.5-3.4 10-10a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8l-10 10z" />
    <path d="M13.5 6.5 17 10" />
  </Svg>
);

export const IconClose = (p: Props) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const IconChevronDown = (p: Props) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);

export const IconEye = (p: Props) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

export const IconNeon = (p: Props) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="9" ry="6" />
    <ellipse cx="12" cy="12" rx="5.4" ry="3.2" opacity="0.5" />
    <path d="M12 2.6v1.6M21.4 12h-1.6M12 21.4v-1.6M2.6 12h1.6" />
  </Svg>
);

export const IconSpade = (p: Props) => (
  <Svg {...p}>
    <path
      d="M12 3.2C12 3.2 4.5 10 4.5 14.2c0 2.5 2.4 4 4.7 2.6-.2 2-.9 3-2.3 3.6h10.2c-1.4-.6-2.1-1.6-2.3-3.6 2.3 1.4 4.7-.1 4.7-2.6C19.5 10 12 3.2 12 3.2z"
      fill="currentColor"
      stroke="none"
    />
  </Svg>
);
