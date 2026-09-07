import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IconClose } from './icons';

/**
 * The one dialog the app uses to confirm something it cannot undo. Focus moves
 * into it, Escape closes it, and the backdrop click cancels — the same
 * expectations any native dialog sets.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel w-full max-w-[440px] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start gap-3">
          <h2 className="flex-1 text-lg font-semibold">{title}</h2>
          <button type="button" className="btn-icon" onClick={onCancel} aria-label={t('common.cancel')}>
            <IconClose size={15} />
          </button>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {body}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-primary"
            style={danger ? { background: 'var(--result-lost)', borderColor: 'transparent' } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
