import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/state/authStore';

/**
 * Login is required to use the replayer (product decision). When the API is
 * unreachable the app does not lock the user out of their local data: it says
 * so and lets them carry on offline.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const phase = useAuthStore((s) => s.phase);
  const refresh = useAuthStore((s) => s.refresh);
  const location = useLocation();

  useEffect(() => {
    if (phase === 'loading') void refresh();
  }, [phase, refresh]);

  if (phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  if (phase === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (phase === 'offline') {
    return (
      <>
        <div
          className="px-3 py-1 text-center text-xs"
          style={{ background: 'color-mix(in srgb, var(--result-break-even) 22%, transparent)' }}
          role="status"
        >
          {t('auth.offlineBanner')}
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}
