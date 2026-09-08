import { useTranslation } from 'react-i18next';
import { Section } from '@/components/Section';
import { EvolutionChart } from '@/components/Illustrations';

const ITEMS = ['score', 'coverage', 'leaks', 'self', 'coaches', 'filter'] as const;

export function Reports() {
  const { t } = useTranslation();

  return (
    <Section id="reports" title={t('reports.title')} lead={t('reports.lead')} tone="raised">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-14">
        <dl className="grid gap-4 sm:grid-cols-2">
          {ITEMS.map((key) => (
            <div key={key} className="card">
              <dt className="text-base font-semibold">{t(`reports.items.${key}.title`)}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">
                {t(`reports.items.${key}.text`)}
              </dd>
            </div>
          ))}
        </dl>

        <figure className="m-0 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <EvolutionChart />
          <figcaption className="mt-4 text-xs text-faint">{t('reports.chart.caption')}</figcaption>
        </figure>
      </div>

      <p className="mt-10 max-w-3xl rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-muted">
        {t('reports.disclaimer')}
      </p>
    </Section>
  );
}
