import { useTranslation } from 'react-i18next';
import { Section } from '@/components/Section';

const ITEMS = ['free', 'files', 'formats', 'rooms', 'skins', 'coach', 'reports', 'expiry'] as const;

/**
 * Native <details>, so every answer is reachable by keyboard and readable with
 * JavaScript disabled. The first one starts open.
 */
export function Faq() {
  const { t } = useTranslation();

  return (
    <Section id="faq" title={t('faq.title')} lead={t('faq.lead')} tone="raised">
      <div className="mx-auto max-w-3xl divide-y divide-[color:var(--border)] overflow-hidden rounded-2xl border border-line bg-surface">
        {ITEMS.map((key, i) => (
          <details key={key} open={i === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-base font-semibold marker:content-none">
              {t(`faq.items.${key}.q`)}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-5 w-5 shrink-0 text-faint transition-transform group-open:rotate-45"
                fill="currentColor"
              >
                <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
              </svg>
            </summary>
            <p className="px-5 pb-5 leading-relaxed text-muted">{t(`faq.items.${key}.a`)}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
