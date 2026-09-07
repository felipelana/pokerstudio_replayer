import type { BackPattern, ChipSkin, DeckSkin, PlateSkin, Skin, UiSkin } from './types';

/* ---------- reusable building blocks ---------- */

export const DECK_FOUR_COLOR_FILLED: DeckSkin = {
  style: 'filled',
  colorMode: 4,
  suitColors: { s: '#23272e', h: '#c62828', d: '#1e5bb8', c: '#1f7a3a' },
  cardBg: '#ffffff',
  inkOnFilled: '#ffffff',
  backColor: '#b3261e',
  backPattern: 'diamonds',
  backInk: 'rgba(255,255,255,0.35)',
  rankFont: 'Inter',
  cornerRadius: 0.1,
  holeLayout: 'spread',
  courtStyle: 'letter',
};

export const DECK_FOUR_COLOR_OUTLINED: DeckSkin = {
  ...DECK_FOUR_COLOR_FILLED,
  style: 'outlined',
  suitColors: { s: '#111418', h: '#d32f2f', d: '#1565c0', c: '#2e7d32' },
};

export const DECK_TWO_COLOR: DeckSkin = {
  ...DECK_FOUR_COLOR_OUTLINED,
  colorMode: 2,
  suitColors: { s: '#111418', h: '#d32f2f', d: '#d32f2f', c: '#111418' },
};

export const DECK_MONO: DeckSkin = {
  ...DECK_FOUR_COLOR_OUTLINED,
  colorMode: 2,
  suitColors: { s: '#000000', h: '#000000', d: '#000000', c: '#000000' },
  backColor: '#222222',
  backPattern: 'grid',
  backInk: 'rgba(255,255,255,0.5)',
};

export const DECK_TWO_COLOR_FILLED: DeckSkin = {
  ...DECK_FOUR_COLOR_FILLED,
  colorMode: 2,
  suitColors: { s: '#23272e', h: '#c62828', d: '#c62828', c: '#23272e' },
};

export const DECK_MONO_FILLED: DeckSkin = {
  ...DECK_FOUR_COLOR_FILLED,
  colorMode: 2,
  suitColors: { s: '#111111', h: '#111111', d: '#111111', c: '#111111' },
  backColor: '#333333',
  backPattern: 'grid',
};

const CHIPS_DEFAULT: ChipSkin = {
  colors: {
    '1': '#e9eef2',
    '5': '#d32f2f',
    '25': '#2e7d32',
    '100': '#1e1e1e',
    '500': '#6a1b9a',
    '1000': '#f9a825',
    '5000': '#ef6c00',
    '25000': '#00838f',
    '100000': '#ad1457',
    '500000': '#4e342e',
    '1000000': '#c0ca33',
  },
  edge: '#ffffff',
  dealerButton: '#f5f5f5',
  dealerButtonInk: '#1f2227',
};

const PLATES_DARK: PlateSkin = {
  bg: 'rgba(20, 22, 26, 0.92)',
  border: 'rgba(255,255,255,0.12)',
  activeBorder: '#f5c542',
  text: '#f2f4f7',
  textMuted: '#9aa3ad',
  foldLabel: '#6b7280',
  allInLabel: '#e53935',
  heroBorder: '#4fa3ff',
  winnerGlow: '#43a047',
};

const PLATES_LIGHT: PlateSkin = {
  bg: 'rgba(255,255,255,0.96)',
  border: 'rgba(0,0,0,0.12)',
  activeBorder: '#e0a800',
  text: '#1f2227',
  textMuted: '#5b6470',
  foldLabel: '#9aa3ad',
  allInLabel: '#d32f2f',
  heroBorder: '#1a73e8',
  winnerGlow: '#2e7d32',
};

const UI_DARK: UiSkin = {
  bg: '#2b2f36',
  bgEnd: '#1f2227',
  surface: '#23272e',
  surface2: '#2f343c',
  text: '#eef1f5',
  textMuted: '#9aa3ad',
  accent: '#4fa3ff',
  border: 'rgba(255,255,255,0.09)',
};

const UI_LIGHT: UiSkin = {
  bg: '#f4f5f7',
  bgEnd: '#e9ebef',
  surface: '#ffffff',
  surface2: '#f0f2f5',
  text: '#1f2227',
  textMuted: '#5b6470',
  accent: '#1a73e8',
  border: 'rgba(0,0,0,0.1)',
};

/* ---------- presets ---------- */

export const SKIN_DEFAULT_DARK: Skin = {
  id: 'default-dark',
  name: 'Default Dark',
  theme: 'dark',
  isBuiltIn: true,
  deck: DECK_FOUR_COLOR_FILLED,
  felt: {
    color: '#1d6b3f',
    textureIntensity: 0.35,
    vignetteColor: '#0b2e1b',
    vignetteStrength: 0.55,
    // PokerStudio watermark, screened so the logo's black background drops out.
    logoAssetId: 'builtin:pokerstudio',
    logoBlend: 'screen',
    logoOpacity: 0.34,
  },
  table: {
    railColor: '#3b2a1e',
    railHighlight: '#6b4d36',
    railWidth: 0.05,
    railShine: 0.4,
    aspect: 0.56,
    shape: 'ellipse',
    bevel: { width: 0.012, color: 'rgba(255,255,255,0.14)', opacity: 0.9, inset: 0.1 },
  },
  ui: UI_DARK,
  chips: CHIPS_DEFAULT,
  plates: PLATES_DARK,
};

export const SKIN_DEFAULT_LIGHT: Skin = {
  ...SKIN_DEFAULT_DARK,
  id: 'default-light',
  name: 'Default Light',
  theme: 'light',
  deck: DECK_FOUR_COLOR_OUTLINED,
  felt: {
    color: '#3a9a63',
    textureIntensity: 0.25,
    vignetteColor: '#1d6b3f',
    vignetteStrength: 0.35,
    logoOpacity: 0.1,
  },
  table: { ...SKIN_DEFAULT_DARK.table, railColor: '#5b4634', railHighlight: '#8a6a4f' },
  ui: UI_LIGHT,
  plates: PLATES_LIGHT,
};

export const SKIN_CLASSIC: Skin = {
  ...SKIN_DEFAULT_DARK,
  id: 'classic-2-color',
  name: 'Classic 2-color',
  deck: DECK_TWO_COLOR,
  felt: { ...SKIN_DEFAULT_DARK.felt, color: '#1f5f3a' },
};

export const SKIN_FOUR_COLOR: Skin = {
  ...SKIN_DEFAULT_DARK,
  id: 'four-color-outlined',
  name: '4-color',
  deck: DECK_FOUR_COLOR_OUTLINED,
};

export const SKIN_MONO: Skin = {
  ...SKIN_DEFAULT_DARK,
  id: 'mono',
  name: 'Mono',
  deck: DECK_MONO,
  felt: {
    color: '#3a3f47',
    textureIntensity: 0.3,
    vignetteColor: '#14171c',
    vignetteStrength: 0.6,
    logoOpacity: 0.1,
  },
  table: { ...SKIN_DEFAULT_DARK.table, railColor: '#1a1d22', railHighlight: '#3a3f47' },
};

export const SKIN_BLUE_NIGHT: Skin = {
  ...SKIN_DEFAULT_DARK,
  id: 'blue-night',
  name: 'Blue Night',
  deck: DECK_FOUR_COLOR_FILLED,
  felt: {
    color: '#1e3f6d',
    textureIntensity: 0.35,
    vignetteColor: '#0b1c33',
    vignetteStrength: 0.6,
    logoAssetId: 'builtin:pokerstudio',
    logoBlend: 'screen',
    logoOpacity: 0.34,
  },
  table: {
    ...SKIN_DEFAULT_DARK.table,
    railColor: '#1c1f26',
    railHighlight: '#3d434f',
    shape: 'rounded-rect',
    neonColor: '#4fc3f7',
    neonIntensity: 0.9,
  },
};

/**
 * "GG Style" — dark warm felt on a wooden rail, white 4-colour cards, gold
 * accents and cyan stack figures, in the spirit of modern client layouts.
 * Colours only: no third-party logo, watermark or wordmark is reproduced.
 */
export const SKIN_GG: Skin = {
  id: 'gg-style',
  name: 'GG Style',
  theme: 'dark',
  isBuiltIn: true,
  deck: {
    style: 'outlined',
    colorMode: 4,
    suitColors: { s: '#16181c', h: '#d5323a', d: '#1f6fd0', c: '#1f9d4d' },
    cardBg: '#ffffff',
    inkOnFilled: '#ffffff',
    backColor: '#d9d4cc',
    backPattern: 'diamonds',
    backInk: 'rgba(52, 47, 42, 0.55)',
    rankFont: 'Inter',
    cornerRadius: 0.09,
    holeLayout: 'overlap',
    courtStyle: 'letter',
  },
  felt: {
    color: '#403a34',
    textureIntensity: 0.4,
    vignetteColor: '#17130f',
    vignetteStrength: 0.72,
    logoOpacity: 0.1,
  },
  table: {
    railColor: '#6a4629',
    railHighlight: '#a9784a',
    railWidth: 0.055,
    railShine: 0.45,
    aspect: 0.55,
    shape: 'oval',
    bevel: { width: 0.01, color: 'rgba(255,255,255,0.12)', opacity: 0.85, inset: 0.09 },
    neonColor: '#f0b429',
    neonIntensity: 0.75,
  },
  ui: {
    bg: '#2b2622',
    bgEnd: '#141110',
    surface: '#211d1a',
    surface2: '#2c2723',
    text: '#f3ede4',
    textMuted: '#a99f92',
    accent: '#f0b429',
    border: 'rgba(255,255,255,0.10)',
  },
  chips: {
    colors: {
      '1': '#f2efe9',
      '5': '#d5323a',
      '25': '#1f9d4d',
      '100': '#1b1b1b',
      '500': '#7b3fb5',
      '1000': '#f0b429',
      '5000': '#e2711d',
      '25000': '#12a3a3',
      '100000': '#c2185b',
      '500000': '#5d4037',
      '1000000': '#aacc00',
    },
    edge: '#ffffff',
    dealerButton: '#f0b429',
    dealerButtonInk: '#2a2418',
  },
  plates: {
    bg: 'rgba(22, 20, 18, 0.94)',
    border: 'rgba(255,255,255,0.14)',
    activeBorder: '#f0b429',
    text: '#ffffff',
    // GG-like: the stack figure reads in cyan under the player name.
    textMuted: '#63c7f5',
    foldLabel: '#6b6560',
    allInLabel: '#e0453d',
    heroBorder: '#63c7f5',
    winnerGlow: '#1f9d4d',
  },
};

/**
 * "Flat" — near-black study table: no wood, no gloss, a single warm amber accent
 * and a strong halo on the player to act. Built for long review sessions.
 */
export const SKIN_FLAT: Skin = {
  id: 'flat',
  name: 'Flat',
  theme: 'dark',
  isBuiltIn: true,
  deck: {
    style: 'outlined',
    colorMode: 4,
    suitColors: { s: '#2b2b30', h: '#d9534f', d: '#4a90d9', c: '#4aa96c' },
    cardBg: '#f5f4f1',
    inkOnFilled: '#ffffff',
    backColor: '#e8a04a',
    backPattern: 'plain',
    backInk: 'rgba(28, 20, 10, 0.28)',
    rankFont: 'Inter',
    cornerRadius: 0.16,
    holeLayout: 'overlap',
    courtStyle: 'letter',
  },
  felt: {
    color: '#1a1a1d',
    textureIntensity: 0.12,
    vignetteColor: '#0a0a0c',
    vignetteStrength: 0.82,
    logoOpacity: 0.06,
  },
  table: {
    railColor: '#1f1f23',
    railHighlight: '#33333a',
    railWidth: 0.03,
    railShine: 0.05,
    aspect: 0.6,
    shape: 'racetrack',
    bevel: { width: 0.008, color: 'rgba(255,255,255,0.16)', opacity: 0.8, inset: 0.08 },
    neonColor: '#ef8f4c',
    neonIntensity: 0.22,
  },
  ui: {
    bg: '#141416',
    bgEnd: '#0c0c0e',
    surface: '#161619',
    surface2: '#1e1e22',
    text: '#e9e9ec',
    textMuted: '#86868f',
    accent: '#ef8f4c',
    border: 'rgba(255,255,255,0.07)',
  },
  chips: {
    colors: {
      '1': '#f0ece4',
      '5': '#d9534f',
      '25': '#4aa96c',
      '100': '#2b2b30',
      '500': '#8e6bc7',
      '1000': '#e8a04a',
      '5000': '#ef8f4c',
      '25000': '#3fa8a8',
      '100000': '#d16b9a',
      '500000': '#7a5c46',
      '1000000': '#9fc23f',
    },
    edge: 'rgba(255,255,255,0.55)',
    dealerButton: '#d94b3e',
    dealerButtonInk: '#ffffff',
  },
  plates: {
    bg: '#202024',
    border: 'rgba(255,255,255,0.08)',
    activeBorder: '#ef8f4c',
    text: '#e9e9ec',
    textMuted: '#b9b9c0',
    foldLabel: '#4a4a52',
    allInLabel: '#d9534f',
    heroBorder: '#e8a04a',
    winnerGlow: '#4aa96c',
    // The seat to act gets a wide amber halo — the point of this skin.
    activeGlow: '#ef8f4c',
    activeGlowStrength: 0.9,
  },
};

/**
 * "PokerStudio" — the brand's own black and red, and what a first-time visitor
 * sees before choosing anything else. Black felt and rail, red neon inside the
 * table, red halo on the seat to act.
 */
export const SKIN_POKERSTUDIO: Skin = {
  ...SKIN_FLAT,
  id: 'pokerstudio',
  name: 'PokerStudio',
  theme: 'dark',
  isBuiltIn: true,
  deck: {
    ...SKIN_FLAT.deck,
    suitColors: { s: '#1b1b1f', h: '#e10600', d: '#e10600', c: '#1b1b1f' },
    cardBg: '#f7f6f4',
    backColor: '#e10600',
    backPattern: 'plain',
    backInk: 'rgba(0, 0, 0, 0.35)',
    colorMode: 2,
  },
  felt: {
    color: '#141416',
    textureIntensity: 0.1,
    vignetteColor: '#000000',
    vignetteStrength: 0.88,
    logoOpacity: 0.07,
  },
  table: {
    ...SKIN_FLAT.table,
    railColor: '#0e0e10',
    railHighlight: '#2a2a2e',
    railShine: 0.06,
    bevel: { width: 0.008, color: 'rgba(225, 6, 0, 0.35)', opacity: 0.85, inset: 0.08 },
    neonColor: '#e10600',
    neonIntensity: 0.3,
  },
  ui: {
    bg: '#101013',
    bgEnd: '#000000',
    surface: '#161619',
    surface2: '#1d1d21',
    text: '#f2f2f4',
    textMuted: '#8b8b93',
    accent: '#e10600',
    border: 'rgba(255,255,255,0.08)',
  },
  chips: {
    ...SKIN_FLAT.chips,
    dealerButton: '#e10600',
    dealerButtonInk: '#ffffff',
  },
  plates: {
    ...SKIN_FLAT.plates,
    bg: '#1a1a1e',
    activeBorder: '#e10600',
    heroBorder: '#e10600',
    allInLabel: '#ff4d45',
    activeGlow: '#e10600',
    activeGlowStrength: 0.9,
  },
};

export const BUILT_IN_SKINS: Skin[] = [
  SKIN_POKERSTUDIO,
  SKIN_DEFAULT_DARK,
  SKIN_DEFAULT_LIGHT,
  SKIN_CLASSIC,
  SKIN_FOUR_COLOR,
  SKIN_MONO,
  SKIN_BLUE_NIGHT,
  SKIN_GG,
  SKIN_FLAT,
];

/** Deck shortcuts for the admin "2 / 4 colours" button and the `C` cycle. */
/** Heavier ink, larger contrast against the card background (R23). */
export const DECK_HIGH_CONTRAST: DeckSkin = {
  ...DECK_FOUR_COLOR_OUTLINED,
  suitColors: { s: '#000000', h: '#c40000', d: '#0033a0', c: '#006b2d' },
  cardBg: '#ffffff',
  cornerRadius: 0.08,
  rankFont: 'Inter',
};

export const DECK_PRESETS: { id: string; name: string; deck: DeckSkin }[] = [
  { id: 'four-color-filled', name: '4-color filled', deck: DECK_FOUR_COLOR_FILLED },
  { id: 'four-color-outlined', name: '4-color outlined', deck: DECK_FOUR_COLOR_OUTLINED },
  { id: 'two-color', name: '2-color classic', deck: DECK_TWO_COLOR },
  { id: 'two-color-filled', name: '2-color filled', deck: DECK_TWO_COLOR_FILLED },
  { id: 'mono', name: 'Mono', deck: DECK_MONO },
  { id: 'mono-filled', name: 'Mono filled', deck: DECK_MONO_FILLED },
  { id: 'high-contrast', name: 'High contrast', deck: DECK_HIGH_CONTRAST },
];

/** Back patterns offered in the editor (R23). */
export const BACK_PRESETS: { id: BackPattern; color: string }[] = [
  { id: 'diamonds', color: '#b3261e' },
  { id: 'grid', color: '#1e3f6d' },
  { id: 'dots', color: '#2e7d32' },
  { id: 'plain', color: '#3a3f47' },
];

/** Apply a skin's UI tokens to the document as CSS variables. */
export function applySkinCssVariables(skin: Skin, root: HTMLElement = document.documentElement) {
  const s = root.style;
  s.setProperty('--bg', skin.ui.bg);
  s.setProperty('--bg-end', skin.ui.bgEnd);
  s.setProperty('--surface', skin.ui.surface);
  s.setProperty('--surface-2', skin.ui.surface2);
  s.setProperty('--text', skin.ui.text);
  s.setProperty('--text-muted', skin.ui.textMuted);
  s.setProperty('--accent', skin.ui.accent);
  s.setProperty('--border', skin.ui.border);
  s.setProperty('--felt', skin.felt.color);
  s.setProperty('--felt-edge', skin.felt.vignetteColor);
  s.setProperty('--card-bg', skin.deck.cardBg);
  s.setProperty('--suit-s', skin.deck.suitColors.s);
  s.setProperty('--suit-h', skin.deck.suitColors.h);
  s.setProperty('--suit-d', skin.deck.suitColors.d);
  s.setProperty('--suit-c', skin.deck.suitColors.c);
  s.setProperty('--plate-bg', skin.plates.bg);
  s.setProperty('--plate-border', skin.plates.border);
  s.setProperty('--plate-active', skin.plates.activeBorder);
  s.setProperty('--plate-text', skin.plates.text);
  s.setProperty('--plate-muted', skin.plates.textMuted);
  s.setProperty('--plate-fold', skin.plates.foldLabel);
  s.setProperty('--plate-allin', skin.plates.allInLabel);
  s.setProperty('--plate-hero', skin.plates.heroBorder);
  s.setProperty('--plate-winner', skin.plates.winnerGlow);
  root.dataset.theme = skin.theme;
  root.style.colorScheme = skin.theme;
}
