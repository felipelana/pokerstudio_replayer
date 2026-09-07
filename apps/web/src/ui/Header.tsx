import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/store';
import { IconHelp, IconMoon, IconNeon, IconSun } from './icons';
import brandMark from '@/assets/pokerstudio-mark.png';
import { LanguageSelector } from './LanguageSelector';
import { UserMenu } from './UserMenu';
import { useAuthStore } from '@/state/authStore';

/** Screens that render their own brand and must not show the app chrome. */
const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/r/'];

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
  const user = useAuthStore((s) => s.user);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const location = useLocation();
  const inReplayer = location.pathname.startsWith('/replay');
  const inAuth = AUTH_PATHS.some((path) => location.pathname.startsWith(path));

  // The sign-in screens carry the brand themselves — the app chrome would only
  // compete with it. Language and theme stay, since both matter before login.
  if (inAuth) {
    return (
      <header className="flex h-12 shrink-0 items-center justify-end gap-2 px-3">
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
      </header>
    );
  }

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b px-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <NavLink to="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
        <img src={brandMark} alt="" className="h-7 w-7 select-none" draggable={false} />
        <span className="hidden sm:inline">
          PokerStudio <span style={{ color: 'var(--accent)' }}>Replayer</span>
        </span>
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

      {inReplayer && (
        <>
          <button
            type="button"
            className="btn"
            title={t('header.toggle3d')}
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
        </>
      )}

      {user ? (
        <UserMenu />
      ) : (
        <NavLink to="/login" className="btn">
          {t('auth.signIn')}
        </NavLink>
      )}

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
        {settings.theme === 'dark' ? <IconMoon size={15} /> : <IconSun size={15} />}
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
          <IconHelp size={15} />
        </button>
      )}
    </header>
  );
}
