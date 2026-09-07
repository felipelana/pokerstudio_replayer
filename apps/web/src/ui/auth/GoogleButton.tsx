import { useTranslation } from 'react-i18next';

/**
 * Google's official "G" mark. Reproduced with the brand's own four colours and
 * proportions — it must never be restyled with the product's palette.
 */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

/**
 * "Continue with Google". A plain link, not a fetch: the OAuth dance is a
 * top-level navigation that the server drives end to end.
 */
export function GoogleButton({ redirect = '/', label }: { redirect?: string; label?: string }) {
  const { t } = useTranslation();
  const referral = (() => {
    try {
      return localStorage.getItem('ps.referral') ?? undefined;
    } catch {
      return undefined;
    }
  })();

  const params = new URLSearchParams({ redirect });
  if (referral) params.set('ref', referral);

  return (
    <a
      href={`/api/v1/auth/google?${params.toString()}`}
      className="flex h-10 w-full items-center justify-center gap-3 rounded-md border text-sm font-medium transition-opacity hover:opacity-90"
      // Google's light button: white surface, #3c4043 text, #dadce0 border.
      style={{ background: '#ffffff', color: '#3c4043', borderColor: '#dadce0', fontFamily: 'Roboto, Inter, system-ui, sans-serif' }}
    >
      <GoogleMark />
      {label ?? t('auth.continueWithGoogle')}
    </a>
  );
}

/** "or" rule between the provider button and the e-mail form. */
export function OrDivider() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
      {t('auth.or')}
      <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
    </div>
  );
}
