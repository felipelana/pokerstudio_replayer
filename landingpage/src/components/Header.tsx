import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SECTIONS, type SectionId } from '@/config';
import { MARK } from '@/assets/shots';
import { scrollToSection } from '@/lib/scroll';
import { CtaButton } from '@/components/CtaButton';
import { SECTION_ICONS } from '@/components/Icons';
import { LanguageSelector } from '@/components/LanguageSelector';

export function Header({ active }: { active: SectionId | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // The mobile panel closes on Escape and whenever the layout grows wide enough
  // to show the full navigation again.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const wide = window.matchMedia('(min-width: 1280px)');
    const onWide = () => wide.matches && setOpen(false);
    document.addEventListener('keydown', onKeyDown);
    wide.addEventListener('change', onWide);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      wide.removeEventListener('change', onWide);
    };
  }, [open]);

  function go(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    setOpen(false); // A choice on mobile always closes the menu.
    scrollToSection(id);
  }

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-line bg-[color:rgba(9,9,11,0.97)]">
        {/* Wider than the page container: the row has to hold a logo, seven
            entries, the language selector and the call to action. */}
        <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center gap-4 px-5 sm:px-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
              history.replaceState(null, '', ' ');
            }}
            className="flex shrink-0 items-center gap-2.5"
            aria-label={t('nav.top')}
          >
            <img
              src={MARK.small.src}
              width={32}
              height={32}
              alt=""
              className="h-8 w-8 rounded-md"
            />
            <span className="hidden text-[15px] font-bold tracking-tight sm:inline">
              PokerStudio <span className="text-[color:var(--accent-soft)]">Replayer</span>
            </span>
          </a>

          <nav aria-label={t('nav.label')} className="hidden flex-1 justify-center xl:flex">
            <ul className="flex items-center gap-1">
              {SECTIONS.map((id) => {
                const Icon = SECTION_ICONS[id];
                return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      onClick={(e) => go(e, id)}
                      aria-current={active === id ? 'true' : undefined}
                      className={[
                        'group relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2',
                        'text-[13px] transition-colors hover:bg-accent-deep hover:text-white',
                        active === id ? 'text-content' : 'text-muted',
                      ].join(' ')}
                    >
                      <Icon
                        className={[
                          'h-[15px] w-[15px] shrink-0 transition-colors group-hover:text-white',
                          active === id ? 'text-[color:var(--accent-soft)]' : 'text-faint',
                        ].join(' ')}
                      />
                      {t(`nav.${id}`)}
                      <span
                        aria-hidden="true"
                        className={[
                          'absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-accent transition-opacity',
                          active === id ? 'opacity-100' : 'opacity-0',
                        ].join(' ')}
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2 xl:ml-0">
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>
            <div className="hidden sm:block">
              <CtaButton size="sm" />
            </div>
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? t('nav.close') : t('nav.open')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-content xl:hidden"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                {open ? (
                  <>
                    <path d="M6 6l12 12" />
                    <path d="M18 6L6 18" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="header-rule h-px" />

      {open ? (
        <div
          id="mobile-menu"
          className="max-h-[calc(100vh-69px)] overflow-y-auto border-b border-line bg-bg-2 xl:hidden"
        >
          <nav aria-label={t('nav.label')} className="container-page py-4">
            <ul className="flex flex-col">
              {SECTIONS.map((id) => {
                const Icon = SECTION_ICONS[id];
                return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      onClick={(e) => go(e, id)}
                      aria-current={active === id ? 'true' : undefined}
                      className={[
                        'group -mx-3 flex items-center gap-3 rounded-lg border-b border-line px-3 py-3.5',
                        'text-base transition-colors hover:bg-accent-deep hover:text-white',
                        active === id ? 'text-content' : 'text-muted',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden="true"
                        className={[
                          'h-5 w-0.5 shrink-0 rounded-full',
                          active === id ? 'bg-accent' : 'bg-transparent',
                        ].join(' ')}
                      />
                      <Icon
                        className={[
                          'h-[18px] w-[18px] shrink-0 transition-colors group-hover:text-white',
                          active === id ? 'text-[color:var(--accent-soft)]' : 'text-faint',
                        ].join(' ')}
                      />
                      {t(`nav.${id}`)}
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-col gap-3 sm:hidden">
              <LanguageSelector compact />
              <CtaButton className="w-full" />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
