import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGES } from '@/i18n';
import { useAppStore } from '@/state/store';
import { FLAGS } from './flags';

export function LanguageSelector() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[1];
  const Flag = FLAGS[current.flag];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (code: string) => {
    void i18n.changeLanguage(code);
    updateSettings({ language: code });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('header.language')}
        title={t('header.language')}
        onClick={() => setOpen((o) => !o)}
      >
        <Flag size={22} />
        <span className="hidden text-sm md:inline">{current.nativeName}</span>
        <span aria-hidden="true" className="text-xs opacity-60">
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('header.language')}
          className="panel absolute right-0 z-50 mt-1 min-w-[220px] overflow-hidden py-1 shadow-xl"
        >
          {LANGUAGES.map((l) => {
            const F = FLAGS[l.flag];
            const selected = l.code === current.code;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={l.nativeName}
                  lang={l.code}
                  onClick={() => choose(l.code)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] ${
                    selected ? 'font-semibold' : ''
                  }`}
                >
                  <F size={22} />
                  <span className="flex-1">{l.nativeName}</span>
                  {selected && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
