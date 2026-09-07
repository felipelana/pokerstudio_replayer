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

export const IconExpand = (p: Props) => (
  <Svg {...p}>
    <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
  </Svg>
);

export const IconCompress = (p: Props) => (
  <Svg {...p}>
    <path d="M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5" />
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



/** Sign out: a door with an arrow leaving it. */
export const IconLogout = (p: Props) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
);

/** Administration: a shield with a check. */
export const IconShield = (p: Props) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

/** Security: a closed padlock. */
export const IconLock = (p: Props) => (
  <Svg {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
);

/** Skins: an artist's palette. */
export const IconPalette = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.6-3.2l-.2-.3a2 2 0 0 1 1.6-3.2H19a2 2 0 0 0 2-2 9 9 0 0 0-9-9z" />
    <circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

/** Invite a friend: the share glyph. */
export const IconShare = (p: Props) => (
  <Svg {...p}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
  </Svg>
);

/** Sessions: a laptop. */
export const IconDevice = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M2 20h20" />
  </Svg>
);

/** General settings: three sliders. */
export const IconSliders = (p: Props) => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
);

/** Leak tags: a label with its hole. */
export const IconTag = (p: Props) => (
  <Svg {...p}>
    <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </Svg>
);

/** Stored data: a database drum. */
export const IconDatabase = (p: Props) => (
  <Svg {...p}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Svg>
);

/** Library: a stack of books. */
export const IconLibrary = (p: Props) => (
  <Svg {...p}>
    <path d="M4 4h4v16H4zM10 4h4v16h-4z" />
    <path d="m16.5 5.2 3.4 15.1" />
  </Svg>
);

/** Save: a floppy disk. */
export const IconSave = (p: Props) => (
  <Svg {...p}>
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M8 3v6h7V3M8 21v-7h8v7" />
  </Svg>
);

/** Add: a plus. */
export const IconPlus = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

/** Delete: a waste bin. */
export const IconTrash = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

/** Export: an arrow into a tray. */
export const IconDownload = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3v12M7 11l5 5 5-5" />
    <path d="M4 20h16" />
  </Svg>
);

/** Rename: a pencil. */
export const IconPencil = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20h4L20 8l-4-4L4 16z" />
    <path d="m14 6 4 4" />
  </Svg>
);

/** Undo: an arrow curving back. */
export const IconUndo = (p: Props) => (
  <Svg {...p}>
    <path d="M4 9h11a5 5 0 0 1 0 10h-6" />
    <path d="m8 5-4 4 4 4" />
  </Svg>
);
