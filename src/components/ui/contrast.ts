/**
 * Contrast helpers (R16). Text drawn on the felt or over a custom background
 * must stay readable, so the ink is chosen from the background's luminance
 * instead of being hard-coded white.
 */

const LIGHT_INK = '#ffffff';
const DARK_INK = '#10131a';

function parseColor(color: string): [number, number, number] | undefined {
  const hex = color.trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(hex);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return undefined;
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function relativeLuminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 … 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white ink, whichever reads better on this background. */
export function readableInk(background: string): string {
  return contrastRatio(LIGHT_INK, background) >= contrastRatio(DARK_INK, background)
    ? LIGHT_INK
    : DARK_INK;
}

/**
 * Halo drawn behind on-table text: the opposite of the ink, so the type stays
 * legible even over a noisy watermark or a busy custom background.
 */
export function textHalo(background: string, strength = 0.75): string {
  const ink = readableInk(background);
  return ink === LIGHT_INK ? `rgba(0,0,0,${strength})` : `rgba(255,255,255,${strength})`;
}

/** CSS `text-shadow` that keeps a label readable on any felt. */
export function haloShadow(background: string): string {
  const halo = textHalo(background, 0.85);
  return `0 1px 2px ${halo}, 0 0 10px ${halo}`;
}
