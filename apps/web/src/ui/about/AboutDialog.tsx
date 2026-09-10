import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import brandMark from '@/assets/pokerstudio-mark.png';
import { IconClose } from '../icons';
import { assetUrl } from '@/assets/assetUrl';

/**
 * Who made this, and what it is for. Opened from the account menu; the text and
 * nothing else, like the legal documents.
 */
export function AboutDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('about.title')}
        className="panel flex max-h-[85vh] w-full max-w-[640px] flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pb-2 pt-4">
          <img src={assetUrl(brandMark)} alt="" aria-hidden="true" className="h-9 w-9 select-none" draggable={false} />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{t('about.title')}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('about.tagline')}
            </p>
          </div>
          <button ref={closeRef} type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <IconClose size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-sm leading-relaxed">
          <p className="mt-3">{t('about.author')}</p>
          <p className="mt-3">{t('about.origin')}</p>
          <p className="mt-3">{t('about.method')}</p>

          <h3 className="mt-5 font-semibold">{t('about.visionTitle')}</h3>
          <p className="mt-1">{t('about.vision')}</p>
        </div>
      </div>
    </div>
  );
}
