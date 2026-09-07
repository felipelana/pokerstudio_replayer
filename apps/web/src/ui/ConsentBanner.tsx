import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegalLink } from './legal/LegalDialog';

const KEY = 'ps.consent.v1';

export type ConsentChoice = 'essential' | 'all';

export function readConsent(): ConsentChoice | undefined {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'essential' || v === 'all' ? v : undefined;
  } catch {
    return undefined;
  }
}

/** True when the user allowed non-essential storage (usage measurement). */
export function analyticsAllowed(): boolean {
  return readConsent() === 'all';
}

/**
 * LGPD cookie notice: asks before anything beyond the essentials is stored,
 * and keeps the choice so it is only asked once.
 */
export function ConsentBanner() {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<ConsentChoice | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChoice(readConsent());
    setReady(true);
  }, []);

  const decide = (value: ConsentChoice) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* storage blocked — the choice simply is not remembered */
    }
    setChoice(value);
  };

  if (!ready || choice) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('consent.title')}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[720px] flex-col gap-3 rounded-xl border p-4 shadow-2xl sm:flex-row sm:items-center"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        <strong className="block text-sm">{t('consent.title')}</strong>
        <span style={{ color: 'var(--text-muted)' }}>{t('consent.body')} </span>
        <LegalLink doc="privacy" className="underline" style={{ color: 'var(--accent)' }}>
          {t('consent.readPolicy')}
        </LegalLink>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" className="btn" onClick={() => decide('essential')}>
          {t('consent.essentialOnly')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => decide('all')}>
          {t('consent.acceptAll')}
        </button>
      </div>
    </div>
  );
}
