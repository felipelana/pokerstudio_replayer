import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CURRENT_RELEASE, hasUnread } from '@/content/releaseNotes';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/store';
import { IconBack, IconHelp, IconLibrary, IconMoon, IconNeon, IconPalette, IconSliders, IconSun } from './icons';
import brandMark from '@/assets/pokerstudio-mark.png';
import { LanguageSelector } from './LanguageSelector';
import { UserMenu } from './UserMenu';
import { HeaderMenu } from './HeaderMenu';
import { useAuthStore } from '@/state/authStore';

/** Screens that render their own brand and must not show the app chrome. */
const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/r/'];

function navClass({ isActive }: { isActive: boolean }) {
  return `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
  }`;
}

export function Header() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const skins = useAppStore((s) => s.skins);
  const user = useAuthStore((s) => s.user);
  const setHelpCenterOpen = useAppStore((s) => s.setHelpCenterOpen);
  // Read once per mount: the page itself clears it, and re-reading on every
  // render would make the dot flicker as the reader navigates.
  const [unread] = useState(hasUnread);
  const location = useLocation();
  const navigate = useNavigate();
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
      {/* Anywhere but the library, a way back to where you came from. */}
      {location.pathname !== '/' && (
        <button
          type="button"
          className="btn-icon"
          title={t('nav.back')}
          aria-label={t('nav.back')}
          onClick={() => navigate(-1)}
        >
          <IconBack size={16} />
        </button>
      )}
      <nav className="flex items-center gap-1" aria-label="main">
        <NavLink to="/" end className={navClass} title={t('nav.library')}>
          <IconLibrary size={15} />
          <span className="hidden md:inline">{t('nav.library')}</span>
        </NavLink>
        <NavLink to="/settings" className={navClass} title={t('nav.settings')} data-tour="settings">
          <IconSliders size={15} />
          <span className="hidden md:inline">{t('nav.settings')}</span>
        </NavLink>
        <NavLink to="/admin" className={navClass} title={t('nav.admin')} data-tour="skins">
          <IconPalette size={15} />
          <span className="hidden md:inline">{t('nav.admin')}</span>
        </NavLink>

      </nav>
      <div className="flex-1" />

      <div className="hidden items-center gap-2 lg:flex">
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

      </div>

      {/* Amounts in chips or big blinds only matter over a table. */}
      {inReplayer && (
      <button
        type="button"
        className="hidden btn lg:inline-flex"
        title={t('header.toggleChips')}
        aria-pressed={settings.chipDisplay === 'bb'}
        onClick={() => updateSettings({ chipDisplay: settings.chipDisplay === 'bb' ? 'chips' : 'bb' })}
      >
        <span className={settings.chipDisplay === 'chips' ? 'font-bold' : 'opacity-50'}>{t('header.chips')}</span>
        <span className="opacity-40">/</span>
        <span className={settings.chipDisplay === 'bb' ? 'font-bold' : 'opacity-50'}>{t('header.bb')}</span>
      </button>
      )}

      <button
        type="button"
        className="hidden btn-icon lg:inline-flex"
        title={t('header.toggleTheme')}
        aria-label={t('header.toggleTheme')}
        onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
      >
        {settings.theme === 'dark' ? <IconMoon size={15} /> : <IconSun size={15} />}
      </button>

      <span className="hidden lg:inline-flex">
        <LanguageSelector />
      </span>

      {/* Everything above, in one place, when the bar runs out of room. */}
      <HeaderMenu inReplayer={inReplayer} />

      {/* The version, and the way to what changed in it. */}
      <NavLink
        to="/novidades"
        className="relative hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors sm:inline-flex"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        title={t('releases.title')}
      >
        v{CURRENT_RELEASE.version}
        {unread && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
        )}
      </NavLink>

      {/* Questions about the tool, from any screen. */}
      <button
        type="button"
        className="btn-icon"
        data-tour="help"
        title={t('help.title')}
        aria-label={t('help.title')}
        onClick={() => setHelpCenterOpen(true)}
      >
        <IconHelp size={15} />
      </button>
      {/* The account sits at the end of the bar, past the view controls. */}
      {user ? (
        <UserMenu />
      ) : (
        <NavLink to="/login" className="btn">
          {t('auth.signIn')}
        </NavLink>
      )}
    </header>
  );
}
