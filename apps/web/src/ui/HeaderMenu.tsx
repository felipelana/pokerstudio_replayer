import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/store';
import { IconHelp, IconMenu, IconMoon, IconNeon, IconSun } from './icons';
import { LanguageSelector } from './LanguageSelector';

/**
 * The header's controls, gathered behind one button for screens that cannot
 * hold them in a row — a phone held sideways, mostly. Above `lg` the header
 * shows them inline and this button is not rendered at all.
 */
export function HeaderMenu({ inReplayer }: { inReplayer: boolean }) {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const skins = useAppStore((s) => s.skins);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative lg:hidden" ref={ref}>
      <button
        type="button"
        className="btn-icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.menu')}
        title={t('header.menu')}
        onClick={() => setOpen((o) => !o)}
      >
        <IconMenu size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 flex w-[260px] flex-col gap-3 rounded-md border p-3 shadow-lg"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <label className="flex flex-col gap-1 text-xs">
            <span style={{ color: 'var(--text-muted)' }}>{t('header.skin')}</span>
            <select
              className="input !py-1"
              value={settings.skinId}
              onChange={(e) => {
                const skin = skins.find((s) => s.id === e.target.value);
                updateSettings({ skinId: e.target.value, theme: skin?.theme ?? settings.theme });
              }}
            >
              {skins.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {inReplayer && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn flex-1 justify-center"
                aria-pressed={settings.renderer !== 'svg'}
                onClick={() => updateSettings({ renderer: settings.renderer === 'svg' ? 'three' : 'svg' })}
              >
                <span className={settings.renderer !== 'svg' ? 'font-bold' : 'opacity-50'}>3D</span>
                <span className="opacity-40">/</span>
                <span className={settings.renderer === 'svg' ? 'font-bold' : 'opacity-50'}>2D</span>
              </button>
              <button
                type="button"
                className="btn-icon"
                title={t('header.toggleNeon')}
                aria-label={t('header.toggleNeon')}
                aria-pressed={settings.neon}
                style={settings.neon ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
                onClick={() => updateSettings({ neon: !settings.neon })}
              >
                <IconNeon size={15} />
              </button>
            </div>
          )}

          {inReplayer && (
          <button
            type="button"
            className="btn justify-center"
            aria-pressed={settings.chipDisplay === 'bb'}
            onClick={() => updateSettings({ chipDisplay: settings.chipDisplay === 'bb' ? 'chips' : 'bb' })}
          >
            <span className={settings.chipDisplay === 'chips' ? 'font-bold' : 'opacity-50'}>{t('header.chips')}</span>
            <span className="opacity-40">/</span>
            <span className={settings.chipDisplay === 'bb' ? 'font-bold' : 'opacity-50'}>{t('header.bb')}</span>
          </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-icon"
              title={t('header.toggleTheme')}
              aria-label={t('header.toggleTheme')}
              onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            >
              {settings.theme === 'dark' ? <IconMoon size={15} /> : <IconSun size={15} />}
            </button>
            <LanguageSelector />
            {inReplayer && (
              <button
                type="button"
                className="btn-icon"
                title={t('header.help')}
                aria-label={t('header.help')}
                onClick={() => {
                  setHelpOpen(true);
                  setOpen(false);
                }}
              >
                <IconHelp size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
