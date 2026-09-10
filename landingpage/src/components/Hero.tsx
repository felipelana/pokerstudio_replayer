import { useTranslation } from 'react-i18next';
import { SHOTS } from '@landing/assets/shots';
import { Shot } from '@landing/components/Shot';
import { CtaButton, FreeBadge } from '@landing/components/CtaButton';
import { scrollToSection } from '@landing/lib/scroll';

export function Hero() {
  const { t } = useTranslation();

  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden">
      {/* A soft red glow behind the capture, nothing more. The softness comes
          from the gradient itself rather than a blur filter: a filter that
          large forces the whole section onto its own compositing layer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-140px] h-[620px] w-[150vw] max-w-[1200px] -translate-x-1/2 sm:h-[760px]"
        style={{
          background:
            'radial-gradient(closest-side, rgba(225,6,0,0.22) 0%, rgba(225,6,0,0.08) 44%, rgba(225,6,0,0) 74%)',
        }}
      />

      <div className="container-page relative pb-16 pt-10 sm:pb-20 sm:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label-caps">{t('hero.eyebrow')}</p>
          <h1
            id="hero-title"
            className="mt-4 text-[2rem] font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]"
          >
            {t('hero.headline')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            {t('hero.sub')}
          </p>

          <div className="mt-7 flex justify-center">
            <FreeBadge />
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton />
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('features');
              }}
              className="btn-ghost"
            >
              {t('cta.secondary')}
            </a>
          </div>

          <p className="mt-6 text-sm text-faint">{t('hero.audience')}</p>
        </div>

        <div className="mt-12 sm:mt-16">
          <div className="relative mx-auto max-w-[1100px]">
            <Shot
              shot={SHOTS.replayerFull}
              alt={t('alt.replayerFull')}
              priority
              className="shadow-2xl shadow-black/70 ring-1 ring-white/[0.06]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
