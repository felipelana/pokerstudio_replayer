import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hand } from '@/domain/model/types';
import { formatAmount, formatExact, type FormatOpts } from '@/domain/model/format';
import { localeFor } from '@/i18n';
import { useAppStore } from '@/lib/state/store';

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
  const dateFormat = useAppStore((s) => s.settings.dateFormat);
  return useMemo(
    () => ({
      dateTime: (d?: Date) => {
        if (!d || Number.isNaN(d.getTime())) return '-';
        // An explicit choice is written out by hand: Intl has no option for
        // "the order I want", only "the order this locale uses".
        if (dateFormat !== 'auto') {
          const pad = (n: number) => String(n).padStart(2, '0');
          const day = pad(d.getDate());
          const month = pad(d.getMonth() + 1);
          const date = dateFormat === 'dmy' ? `${day}/${month}` : `${month}/${day}`;
          return `${date}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          d,
        );
      },
      date: (d?: Date) => {
        if (!d || Number.isNaN(d.getTime())) return '-';
        if (dateFormat !== 'auto') {
          const pad = (n: number) => String(n).padStart(2, '0');
          const day = pad(d.getDate());
          const month = pad(d.getMonth() + 1);
          return dateFormat === 'dmy'
            ? `${day}/${month}/${d.getFullYear()}`
            : `${month}/${day}/${d.getFullYear()}`;
        }
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
      },
      percent: (v: number, digits = 1) =>
        new Intl.NumberFormat(locale, {
          style: 'percent',
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        }).format(v),
      number: (v: number, digits = 1) =>
        new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v),
    }),
    [locale, dateFormat],
  );
}
