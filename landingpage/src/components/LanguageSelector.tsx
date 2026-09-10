import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, languageInfo } from '@landing/i18n';
import { FLAGS } from '@landing/components/Flags';

/**
 * The eight languages, written out in full. A listbox rather than a <select>,
 * so the names render the same on every platform; it closes on Escape, on a
 * click outside and after a choice, and arrow keys move through the options.
 */
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = languageInfo(i18n.language);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrapper.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, [open]);

  function choose(code: string) {
    void i18n.changeLanguage(code);
    setOpen(false);
  }

  function onOptionKeyDown(e: React.KeyboardEvent<HTMLLIElement>, index: number) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('li') ?? []);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? index + 1 : index - 1;
      items[(next + items.length) % items.length]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(LANGUAGES[index].code);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t('nav.language')}: ${current.nativeName}`}
        className={[
          'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface',
          'text-content transition-colors hover:border-[color:var(--border-strong)] hover:bg-surface-2',
          compact ? 'w-full justify-between px-4 py-3 text-base' : 'px-3 py-2 text-sm',
        ].join(' ')}
      >
        {(() => {
          const Flag = FLAGS[current.flag];
          return <Flag size={compact ? 22 : 20} />;
        })()}
        {/* The header row is full; the button shows a short label there and the
            list below always spells every language out. */}
        <span>{compact ? current.nativeName : current.short}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={['h-4 w-4 text-faint transition-transform', open ? 'rotate-180' : ''].join(
            ' ',
          )}
          fill="currentColor"
        >
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.58l3.3-3.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.42Z" />
        </svg>
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t('nav.chooseLanguage')}
          className={[
            'absolute right-0 z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border',
            'border-line bg-surface py-1 shadow-2xl shadow-black/60',
            compact ? 'left-0 right-auto w-full' : '',
          ].join(' ')}
        >
          {LANGUAGES.map((lang, index) => {
            const selected = lang.code === current.code;
            return (
              <li
                key={lang.code}
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                lang={lang.htmlLang}
                onClick={() => choose(lang.code)}
                onKeyDown={(e) => onOptionKeyDown(e, index)}
                className={[
                  'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm',
                  selected ? 'text-content' : 'text-muted',
                  'hover:bg-surface-2 hover:text-content',
                ].join(' ')}
              >
                <span className="flex items-center gap-3">
                  {(() => {
                    const Flag = FLAGS[lang.flag];
                    return <Flag size={22} />;
                  })()}
                  {lang.nativeName}
                </span>
                {selected ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4 text-accent"
                    fill="currentColor"
                  >
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.8a1 1 0 0 1 1.4 0Z" />
                  </svg>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
