import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/state/authStore';
import { IconCompass, IconInfo, IconLogout, IconMegaphone, IconShield, IconSparkle, IconUser } from './icons';
import { hasUnread } from '@/content/releaseNotes';
import { useAppStore } from '@/state/store';
import { AboutDialog } from './about/AboutDialog';

/**
 * The signed-in account: name, and under it the two things anyone looks for —
 * the account page and the way out. The administration entry only exists for
 * an administrator, on the server as much as here.
 */
export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setTourOpen = useAppStore((s) => s.setTourOpen);
  const setFeedbackOpen = useAppStore((s) => s.setFeedbackOpen);
  const [unread] = useState(hasUnread);
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
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

  if (!user) return null;

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn"
        data-tour="account"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('account.title')}
        onClick={() => setOpen((o) => !o)}
      >
        <IconUser size={14} />
        <span className="max-w-[120px] truncate">{user.name}</span>
        <span aria-hidden="true" className="text-xs opacity-60">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[200px] overflow-hidden rounded-md border shadow-lg"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <button type="button" role="menuitem" className="menu-item" onClick={() => go('/account')}>
            <IconUser size={15} />
            {t('account.title')}
          </button>
          {user.role === 'ADMIN' && (
            <button type="button" role="menuitem" className="menu-item" onClick={() => go('/admstudio')}>
              <IconShield size={15} />
              {t('nav.admstudio')}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              setFeedbackOpen(true);
            }}
          >
            <IconMegaphone size={15} />
            {t('feedback.title')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              setTourOpen(true, window.location.pathname.startsWith('/replay') ? 'replayer' : 'library');
            }}
          >
            <IconCompass size={15} />
            {t('tour.title')}
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={() => go('/novidades')}>
            <IconSparkle size={15} />
            <span className="flex-1">{t('releases.title')}</span>
            {unread && (
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              setAbout(true);
            }}
          >
            <IconInfo size={15} />
            {t('about.title')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            style={{ color: 'var(--result-lost)' }}
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <IconLogout size={15} />
            {t('account.signOut')}
          </button>
        </div>
      )}

      <AboutDialog open={about} onClose={() => setAbout(false)} />
    </div>
  );
}
