import type { ChipSkin, DeckSkin, PlateSkin, Skin, UiSkin } from './types';

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
    logoOpacity: 0.12,
  },
  table: {
    railColor: '#3b2a1e',
    railHighlight: '#6b4d36',
    railWidth: 0.05,
    railShine: 0.4,
    aspect: 0.56,
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
    logoOpacity: 0.12,
  },
  table: { ...SKIN_DEFAULT_DARK.table, railColor: '#1c1f26', railHighlight: '#3d434f' },
};

export const BUILT_IN_SKINS: Skin[] = [
  SKIN_DEFAULT_DARK,
  SKIN_DEFAULT_LIGHT,
  SKIN_CLASSIC,
  SKIN_FOUR_COLOR,
  SKIN_MONO,
  SKIN_BLUE_NIGHT,
];

/** Deck shortcuts for the admin "2 / 4 colours" button and the `C` cycle. */
export const DECK_PRESETS: { id: string; name: string; deck: DeckSkin }[] = [
  { id: 'four-color-filled', name: '4-color filled', deck: DECK_FOUR_COLOR_FILLED },
  { id: 'four-color-outlined', name: '4-color outlined', deck: DECK_FOUR_COLOR_OUTLINED },
  { id: 'two-color', name: '2-color classic', deck: DECK_TWO_COLOR },
  { id: 'two-color-filled', name: '2-color filled', deck: DECK_TWO_COLOR_FILLED },
  { id: 'mono', name: 'Mono', deck: DECK_MONO },
  { id: 'mono-filled', name: 'Mono filled', deck: DECK_MONO_FILLED },
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
