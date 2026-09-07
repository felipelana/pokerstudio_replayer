import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconClose } from './icons';

/**
 * Asks for one line of text, in the product's own dressing. The browser's
 * prompt() looks like the operating system, not like this app, and cannot be
 * styled at all.
 */
export function PromptDialog({
  open,
  title,
  label,
  initialValue = '',
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel: string;
  onConfirm(value: string): void;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    const focus = window.setTimeout(() => inputRef.current?.select(), 30);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focus);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, initialValue, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel w-full max-w-[440px] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onConfirm(value.trim());
        }}
      >
        <div className="mb-3 flex items-start gap-3">
          <h2 className="flex-1 text-lg font-semibold">{title}</h2>
          <button type="button" className="btn-icon" onClick={onCancel} aria-label={t('common.cancel')}>
            <IconClose size={15} />
          </button>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          {label}
          <input ref={inputRef} className="input" value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
