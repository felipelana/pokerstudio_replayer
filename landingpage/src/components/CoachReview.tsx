import { useTranslation } from 'react-i18next';
import { Section } from '@landing/components/Section';
import { SHOTS } from '@landing/assets/shots';
import { Shot } from '@landing/components/Shot';
import { ShareIllustration } from '@landing/components/Illustrations';

const ITEMS = [
  'link',
  'expiry',
  'async',
  'scores',
  'partial',
  'several',
  'compare',
  'pdf',
] as const;

export function CoachReview() {
  const { t } = useTranslation();

  return (
    <Section id="coach" title={t('coach.title')} lead={t('coach.lead')}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        <div className="grid gap-4 sm:grid-cols-2">
          {ITEMS.map((key) => (
            <div key={key} className="card">
              <h3 className="text-base font-semibold">{t(`coach.items.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {t(`coach.items.${key}.text`)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <figure className="m-0 rounded-2xl border border-line bg-bg-2 p-4">
            <ShareIllustration />
            <figcaption className="mt-2 text-xs text-faint">{t('illus.note')}</figcaption>
          </figure>
          <Shot shot={SHOTS.reviewPanel} alt={t('alt.reviewPanel')} />
        </div>
      </div>
    </Section>
  );
}
