import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hand } from '@/model/types';
import { formatAmount, formatExact, type FormatOpts } from '@/model/format';
import { localeFor } from '@/i18n';
import { useAppStore } from '@/state/store';

export interface AmountFormatter {
  fmt: (value: number) => string;
  exact: (value: number) => string;
  locale: string;
  isCash: boolean;
}

/** Amount formatter honouring the Chips/BB toggle, the hand's currency and the UI locale. */
export function useAmountFormatter(hand?: Hand): AmountFormatter {
  const { i18n } = useTranslation();
  const chipDisplay = useAppStore((s) => s.settings.chipDisplay);
  const locale = localeFor(i18n.language);
  const opts = useMemo<FormatOpts>(
    () => ({
      display: chipDisplay,
      bb: hand?.blinds.bb ?? 0,
      currency: hand?.currency ?? 'chips',
      locale,
    }),
    [chipDisplay, hand?.blinds.bb, hand?.currency, locale],
  );
  const fmt = useCallback((v: number) => formatAmount(v, opts), [opts]);
  const exact = useCallback((v: number) => formatExact(v, opts), [opts]);
  return { fmt, exact, locale, isCash: (hand?.currency ?? 'chips') !== 'chips' };
}

export function useDateFormatter() {
  const { i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  return useMemo(
    () => ({
      dateTime: (d?: Date) =>
        d && !Number.isNaN(d.getTime())
          ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
          : '—',
      date: (d?: Date) =>
        d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d) : '—',
      percent: (v: number, digits = 1) =>
        new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v),
      number: (v: number, digits = 1) =>
        new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v),
    }),
    [locale],
  );
}
