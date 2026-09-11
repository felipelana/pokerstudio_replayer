import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDoc } from './legalText';
import { IconClose } from '@/components/ui/icons';

export type LegalDocName = 'privacy' | 'terms';

/**
 * One legal document, body only. Shared by the standalone page and the dialog,
 * so the two can never drift apart.
 */
export function LegalBody({ doc }: { doc: LegalDocName }) {
  const { t, i18n } = useTranslation();
  const content: LegalDoc = doc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE;
  const showLocaleNote = !i18n.language.startsWith('pt');

  return (
    <>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('legal.updatedAt', { date: content.updatedAt })}
      </p>

      {showLocaleNote && (
        <p
          className="mt-4 rounded-md px-3 py-2 text-xs"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
        >
          {t('legal.ptOnly')}
        </p>
      )}

      <p className="mt-5 leading-relaxed">{content.intro}</p>

      {content.sections.map((s) => (
        <section key={s.heading} className="mt-6">
          <h2 className="mb-2 font-semibold">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="mb-2 leading-relaxed" style={{ color: 'var(--text)' }}>
              {p}
            </p>
          ))}
        </section>
      ))}

      <p className="mt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('legal.draftNote')}
      </p>
    </>
  );
}

export function legalTitle(doc: LegalDocName): string {
  return (doc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE).title;
}

/**
 * The document in a dialog: the text and nothing else — no app header, no
 * navigation to lose your place in whatever you were signing up for.
 */
export function LegalDialog({ doc, onClose }: { doc: LegalDocName | null; onClose(): void }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!doc) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doc, onClose]);

  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={legalTitle(doc)}
        className="panel flex max-h-[85vh] w-full max-w-[760px] flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pb-2 pt-4">
          <h2 className="flex-1 text-lg font-semibold">{legalTitle(doc)}</h2>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <IconClose size={15} />
          </button>
        </div>
        {/* The text scrolls; the frame around it does not. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-sm">
          <LegalBody doc={doc} />
        </div>
      </div>
    </div>
  );
}

/**
 * A link that opens the document in the dialog instead of navigating away. It
 * is a button, not an anchor, so a click inside a <label> cannot toggle the
 * checkbox it sits in.
 */
export function LegalLink({
  doc,
  className,
  style,
  children,
}: {
  doc: LegalDocName;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>
      <LegalDialog doc={open ? doc : null} onClose={() => setOpen(false)} />
    </>
  );
}
