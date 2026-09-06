import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/store';
import { LanguageSelector } from './LanguageSelector';

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
  }`;
}

export function Header() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const skins = useAppStore((s) => s.skins);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const location = useLocation();
  const inReplayer = location.pathname.startsWith('/replay');

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b px-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <NavLink to="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          ♠
        </span>
        <span className="hidden sm:inline">{t('app.title')}</span>
      </NavLink>
      <nav className="flex items-center gap-1" aria-label="main">
        <NavLink to="/" end className={navClass}>
          {t('nav.library')}
        </NavLink>
        <NavLink to="/settings" className={navClass}>
          {t('nav.settings')}
        </NavLink>
        <NavLink to="/admin" className={navClass}>
          {t('nav.admin')}
        </NavLink>
      </nav>
      <div className="flex-1" />

      <label className="hidden items-center gap-1.5 text-xs lg:flex" title={t('header.cycleSkin')}>
        <span style={{ color: 'var(--text-muted)' }}>{t('header.skin')}</span>
        <select
          className="input !w-auto !py-1"
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

      <button
        type="button"
        className="btn"
        title={t('header.toggleChips')}
        aria-pressed={settings.chipDisplay === 'bb'}
        onClick={() => updateSettings({ chipDisplay: settings.chipDisplay === 'bb' ? 'chips' : 'bb' })}
      >
        <span className={settings.chipDisplay === 'chips' ? 'font-bold' : 'opacity-50'}>{t('header.chips')}</span>
        <span className="opacity-40">/</span>
        <span className={settings.chipDisplay === 'bb' ? 'font-bold' : 'opacity-50'}>{t('header.bb')}</span>
      </button>

      <button
        type="button"
        className="btn-icon"
        title={t('header.toggleTheme')}
        aria-label={t('header.toggleTheme')}
        onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
      >
        {settings.theme === 'dark' ? '☾' : '☀'}
      </button>

      <LanguageSelector />

      {inReplayer && (
        <button
          type="button"
          className="btn-icon"
          title={t('header.help')}
          aria-label={t('header.help')}
          onClick={() => setHelpOpen(true)}
        >
          ?
        </button>
      )}
    </header>
  );
}
