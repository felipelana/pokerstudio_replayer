import { useTranslation } from 'react-i18next';
import { CtaButton, FreeBadge } from '@/components/CtaButton';
import { useReveal } from '@/hooks/useReveal';

export function FinalCta() {
  const { t } = useTranslation();
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      aria-labelledby="final-title"
      className="relative overflow-hidden border-t border-line py-20 sm:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[1000px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(closest-side, rgba(225,6,0,0.26) 0%, rgba(225,6,0,0.10) 45%, rgba(225,6,0,0) 74%)',
        }}
      />
      <div ref={ref} className="reveal container-page relative text-center">
        <FreeBadge />
        <h2
          id="final-title"
          className="mx-auto mt-6 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {t('final.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{t('final.sub')}</p>
        <div className="mt-8 flex justify-center">
          <CtaButton />
        </div>
      </div>
    </section>
  );
}
