import { useTranslation } from 'react-i18next';
import { Section } from '@/components/Section';
import { ROADMAP_ICONS } from '@/components/Icons';

const ITEMS = ['shared', 'audio', 'video', 'profile', 'dashboard', 'ai'] as const;

/**
 * Nothing here is available. Every card carries the badge and there is no
 * button on any of them, so none of it can be read as something to try today.
 */
export function Roadmap() {
  const { t } = useTranslation();

  return (
    <Section id="roadmap" title={t('roadmap.title')} lead={t('roadmap.lead')}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((key) => {
          const Mark = ROADMAP_ICONS[key];
          return (
          <li key={key} className="card border-dashed">
            <div className="flex items-center justify-between gap-3">
              <span aria-hidden="true" className="text-faint">
                <Mark className="h-6 w-6" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-faint)]"
                />
                {t('roadmap.badge')}
              </span>
            </div>
            <h3 className="mt-4 text-base font-semibold text-muted">
              {t(`roadmap.items.${key}.title`)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-faint">
              {t(`roadmap.items.${key}.text`)}
            </p>
          </li>
          );
        })}
      </ul>
    </Section>
  );
}
