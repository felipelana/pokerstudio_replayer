import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountApi } from '@/infrastructure/http/accountApi';

export type ProviderName = 'google' | 'facebook' | 'apple';

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
    </svg>
  );
}

/** Facebook's "f", on the brand's blue. */
function FacebookMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path
        fill="#ffffff"
        d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.29-.04-1.27-.12-2.41-.12-2.39 0-4.03 1.46-4.03 4.14V9.9H7.5V13h2.76v8h3.24z"
      />
    </svg>
  );
}

/** Apple's mark, drawn in white for the black button Apple's guidelines ask for. */
function AppleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path
        fill="#ffffff"
        d="M16.36 12.72c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.05 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.54zM14.2 6.2c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.58-1.21z"
      />
    </svg>
  );
}

const LOOKS: Record<ProviderName, { background: string; color: string; borderColor: string; Mark: typeof GoogleMark }> = {
  // Each provider's own button colours; restyling them breaks their guidelines.
  google: { background: '#ffffff', color: '#3c4043', borderColor: '#dadce0', Mark: GoogleMark },
  facebook: { background: '#1877F2', color: '#ffffff', borderColor: 'transparent', Mark: FacebookMark },
  apple: { background: '#000000', color: '#ffffff', borderColor: '#3a3a3c', Mark: AppleMark },
};

/** Which providers this deployment can actually honour. */
export function useProviders(): Record<ProviderName, boolean> {
  const [available, setAvailable] = useState<Record<ProviderName, boolean>>({
    google: false,
    facebook: false,
    apple: false,
  });

  useEffect(() => {
    void accountApi
      .providers()
      .then(setAvailable)
      .catch(() => undefined);
  }, []);

  return available;
}

/**
 * One provider button. A plain link, not a fetch: the round trip is a top-level
 * navigation that the server drives from end to end.
 */
export function ProviderButton({
  provider,
  redirect = '/',
  label,
  disabled = false,
}: {
  provider: ProviderName;
  redirect?: string;
  label?: string;
  /** Shown, but not usable: this deployment has no credentials for it. */
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { background, color, borderColor, Mark } = LOOKS[provider];

  const referral = (() => {
    try {
      return localStorage.getItem('ps.referral') ?? undefined;
    } catch {
      return undefined;
    }
  })();

  const params = new URLSearchParams({ redirect });
  if (referral) params.set('ref', referral);

  const face = (
    <>
      <Mark />
      {label ?? t(`auth.continueWith`, { provider: PROVIDER_LABEL[provider] })}
    </>
  );
  const look = { background, color, borderColor, fontFamily: 'Inter, system-ui, sans-serif' };

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={t('auth.providerNotConfigured', { provider: PROVIDER_LABEL[provider] })}
        className="flex h-10 w-full cursor-not-allowed items-center justify-center gap-3 rounded-md border text-sm font-medium opacity-45"
        style={look}
      >
        {face}
      </button>
    );
  }

  return (
    <a
      href={`/api/v1/auth/${provider}?${params.toString()}`}
      className="flex h-10 w-full items-center justify-center gap-3 rounded-md border text-sm font-medium transition-opacity hover:opacity-90"
      style={look}
    >
      {face}
    </a>
  );
}

const PROVIDER_LABEL: Record<ProviderName, string> = { google: 'Google', facebook: 'Facebook', apple: 'Apple' };

/** Every configured provider, stacked, with the divider that follows them. */
export function ProviderButtons({ redirect = '/', signUp = false }: { redirect?: string; signUp?: boolean }) {
  const { t } = useTranslation();
  const available = useProviders();
  const all = Object.keys(LOOKS) as ProviderName[];
  // Outside production every provider is on screen — the ones without
  // credentials disabled and saying so — because a button that quietly is not
  // there reads as a bug. In production, only what actually works is offered.
  const shown = import.meta.env.DEV ? all : all.filter((p) => available[p]);

  if (shown.length === 0) return null;
  const missing = shown.some((p) => !available[p]);

  return (
    <div className="mb-4 flex flex-col gap-2">
      {shown.map((provider) => (
        <ProviderButton
          key={provider}
          provider={provider}
          redirect={redirect}
          disabled={!available[provider]}
          label={
            signUp
              ? t('auth.signUpWith', { provider: PROVIDER_LABEL[provider] })
              : t('auth.continueWith', { provider: PROVIDER_LABEL[provider] })
          }
        />
      ))}
      {missing && (
        <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
          {t('auth.providerSetupHint')}
        </p>
      )}
      <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
        {t('auth.or')}
        <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
      </div>
    </div>
  );
}
