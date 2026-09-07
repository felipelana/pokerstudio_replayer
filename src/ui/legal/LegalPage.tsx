import { useTranslation } from 'react-i18next';
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDoc } from './legalText';

/**
 * Renders one of the legal documents. The texts are kept in pt-BR only for now
 * — a translated legal text must be reviewed per jurisdiction, so we say so
 * rather than machine-translating it.
 */
export function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const { t, i18n } = useTranslation();
  const content: LegalDoc = doc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE;
  const showLocaleNote = !i18n.language.startsWith('pt');

  return (
    <div className="mx-auto max-w-[760px] px-6 py-8">
      <h1 className="text-2xl font-semibold">{content.title}</h1>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
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
    </div>
  );
}
