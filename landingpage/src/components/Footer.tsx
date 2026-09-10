import { useTranslation } from 'react-i18next';
import { SECTIONS, SITE_LABEL, SITE_URL } from '@landing/config';
import { MARK } from '@landing/assets/shots';
import { scrollToSection } from '@landing/lib/scroll';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-bg-2 py-14">
      <div className="container-page">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <img
                src={MARK.small.src}
                width={40}
                height={40}
                alt=""
                className="h-10 w-10 rounded-lg"
              />
              <span className="text-base font-bold tracking-tight">
                PokerStudio <span className="text-[color:var(--accent-soft)]">Replayer</span>
              </span>
            </div>
            <p className="mt-4 text-sm text-muted">{t('footer.tagline')}</p>
            <a
              href={SITE_URL}
              className="mt-4 inline-block text-sm font-medium text-[color:var(--accent-soft)] underline underline-offset-4"
            >
              {SITE_LABEL}
            </a>
            <p className="sr-only">{t('footer.site')}</p>
          </div>

          <nav aria-label={t('footer.sections')}>
            <p className="label-caps">{t('footer.sections')}</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-1">
              {SECTIONS.map((id) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(id);
                    }}
                    className="text-sm text-muted transition-colors hover:text-content"
                  >
                    {t(`nav.${id}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-12 max-w-3xl text-xs leading-relaxed text-faint">{t('footer.shots')}</p>
        <p className="mt-4 text-xs text-faint">
          © {year} {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
