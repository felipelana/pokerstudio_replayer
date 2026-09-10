import { useTranslation } from 'react-i18next';
import { replayerUrl } from '@landing/config';

interface CtaButtonProps {
  /** `sm` is the one in the header. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The single call to action. `replayerUrl()` is read at render time rather than
 * at module load, so it always reflects the page that is actually being served.
 */
export function CtaButton({ size = 'md', className = '' }: CtaButtonProps) {
  const { t } = useTranslation();
  const href = replayerUrl();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      title={t('cta.opensReplayer')}
      className={[
        'btn-primary whitespace-nowrap',
        size === 'sm' ? 'px-4 py-2 text-sm' : '',
        className,
      ].join(' ')}
    >
      {t('cta.primary')}
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
        <path d="M11 3a1 1 0 1 0 0 2h2.586l-6.293 6.293a1 1 0 1 0 1.414 1.414L15 6.414V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
        <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
      </svg>
    </a>
  );
}

/** The "free for a limited time" line, used in the hero and before the footer. */
export function FreeBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p
      className={[
        'inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10',
        'px-4 py-1.5 text-sm font-semibold text-[color:var(--accent-soft)]',
        className,
      ].join(' ')}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
      {t('cta.free')}
    </p>
  );
}
