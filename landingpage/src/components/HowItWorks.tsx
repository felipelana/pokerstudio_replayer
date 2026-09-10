import { useTranslation } from 'react-i18next';
import { Section } from '@landing/components/Section';
import { SHOTS } from '@landing/assets/shots';
import { Shot } from '@landing/components/Shot';

const STEPS = ['import', 'review', 'assess', 'read', 'follow'] as const;

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <Section id="how" title={t('how.title')} lead={t('how.lead')} tone="raised">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
        <ol className="relative flex flex-col gap-0">
          {STEPS.map((step, i) => (
            <li key={step} className="relative flex gap-5 pb-8 last:pb-0">
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[19px] top-11 h-[calc(100%-2.75rem)] w-px bg-line"
                />
              ) : null}
              <span
                aria-hidden="true"
                className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-bold text-[color:var(--accent-soft)]"
              >
                {i + 1}
              </span>
              <div className="pt-1.5">
                <h3 className="text-lg font-semibold">{t(`how.steps.${step}.title`)}</h3>
                <p className="mt-1.5 leading-relaxed text-muted">{t(`how.steps.${step}.text`)}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-4">
          <Shot
            shot={SHOTS.handList}
            alt={t('alt.handList')}
            imgClassName="max-h-[420px] object-cover object-top"
          />
          <Shot shot={SHOTS.timeline} alt={t('alt.timeline')} />
        </div>
      </div>
    </Section>
  );
}
