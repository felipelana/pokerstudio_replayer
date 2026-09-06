import type { Currency } from './types';

export type ChipDisplay = 'chips' | 'bb';

const CURRENCY_SYMBOLS: Partial<Record<Currency, string>> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  BRL: 'R$',
  RUB: '₽',
  CNY: '¥',
  PLAY: '',
};

export function currencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOLS[currency] ?? '';
}

/** 27200 -> "27.2K", 1_400_000 -> "1.4M", 950 -> "950". Cash values keep 2 decimals. */
export function compactNumber(value: number, isCash: boolean, locale = 'en'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (isCash) {
    if (abs >= 10_000) return sign + new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(abs / 1000) + 'K';
    return sign + new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs);
  }
  if (abs >= 1_000_000)
    return sign + new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(abs / 1_000_000) + 'M';
  if (abs >= 10_000)
    return sign + new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(abs / 1000) + 'K';
  return sign + new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(abs);
}

export function exactNumber(value: number, isCash: boolean, locale = 'en'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: isCash ? 2 : 0,
    maximumFractionDigits: isCash ? 2 : 0,
  }).format(value);
}

/**
 * Splits a formatted amount into number and unit ("52.5 BB" -> "52.5" + "BB")
 * so the UI can render the unit smaller and dimmer than the figure.
 */
export function splitAmount(formatted: string): { value: string; unit?: string } {
  const m = /^(.*\S)\s+([A-Za-z]+)$/.exec(formatted);
  return m ? { value: m[1], unit: m[2] } : { value: formatted };
}

export interface FormatOpts {
  display: ChipDisplay;
  bb: number;
  currency: Currency;
  locale?: string;
  compact?: boolean;
}

/** Format a chip amount according to the global Chips/BB toggle. */
export function formatAmount(value: number, opts: FormatOpts): string {
  const locale = opts.locale ?? 'en';
  if (opts.display === 'bb' && opts.bb > 0) {
    const bbs = value / opts.bb;
    const digits = Math.abs(bbs) >= 100 ? 0 : 1;
    return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(bbs) + ' BB';
  }
  const isCash = opts.currency !== 'chips';
  const sym = currencySymbol(opts.currency);
  const body = opts.compact === false ? exactNumber(value, isCash, locale) : compactNumber(value, isCash, locale);
  return sym + body;
}

/** Tooltip value: always exact. */
export function formatExact(value: number, opts: FormatOpts): string {
  return formatAmount(value, { ...opts, compact: false });
}

/** Parse "1,234.56" / "$1,234.56" / "1 234,56" -> 1234.56 */
export function parseMoney(text: string): number {
  let t = text.trim().replace(/[^\d.,-]/g, '');
  if (!t) return 0;
  // If both separators exist, the last one is the decimal separator.
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // Single comma: thousands separator if followed by exactly 3 digits and nothing else.
    const after = t.length - lastComma - 1;
    t = after === 3 ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}
