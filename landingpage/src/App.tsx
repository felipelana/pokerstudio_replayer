import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { languageInfo } from '@landing/i18n';
import { useScrollSpy } from '@landing/hooks/useScrollSpy';
import { Header } from '@landing/components/Header';
import { Hero } from '@landing/components/Hero';
import { Section } from '@landing/components/Section';
import { FeatureCarousel } from '@landing/components/FeatureCarousel';
import { ShotStrip } from '@landing/components/ShotStrip';
import { HowItWorks } from '@landing/components/HowItWorks';
import { CoachReview } from '@landing/components/CoachReview';
import { Reports } from '@landing/components/Reports';
import { Rooms } from '@landing/components/Rooms';
import { Roadmap } from '@landing/components/Roadmap';
import { Faq } from '@landing/components/Faq';
import { FinalCta } from '@landing/components/FinalCta';
import { Footer } from '@landing/components/Footer';

export default function App() {
  const { t, i18n } = useTranslation();
  const active = useScrollSpy();

  // Title, description and <html lang> follow the chosen language, so the tab,
  // a shared link and assistive technology all agree with the page.
  useEffect(() => {
    const info = languageInfo(i18n.language);
    document.documentElement.lang = info.htmlLang;
    document.title = t('meta.title');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('meta.description'));
  }, [i18n.language, t]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t('nav.skip')}
      </a>

      <Header active={active} />

      <main id="main">
        <Hero />

        <Section id="features" title={t('features.title')} lead={t('features.lead')}>
          <FeatureCarousel />
          <ShotStrip />
        </Section>

        <HowItWorks />
        <CoachReview />
        <Reports />
        <Rooms />
        <Roadmap />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </>
  );
}
