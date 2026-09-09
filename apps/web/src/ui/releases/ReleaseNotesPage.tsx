import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CURRENT_RELEASE,
  RELEASE_SECTIONS,
  RELEASES,
  highlightKey,
  itemKey,
  markRead,
  type ReleaseSection,
} from '@/content/releaseNotes';
import { useDateFormatter } from '@/ui/hooks/useFormat';

/** The sections a release lists first are the ones about what shipped. */
const SHIPPED = RELEASE_SECTIONS.filter((s) => s !== 'next');

/**
 * What each version brought, newest first. Opening this page is what marks the
 * newest version as read, so the badge in the menu clears itself.
 */
export function ReleaseNotesPage() {
  const { t } = useTranslation();
  const df = useDateFormatter();

  useEffect(() => {
    markRead();
  }, []);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[760px] px-6 py-8">
        <h1 className="text-2xl font-semibold">{t('releases.title')}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('releases.lead')}
        </p>

        {RELEASES.map((release) => (
          <article key={release.version} className="panel mt-6 p-5">
            <header className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">v{release.version}</h2>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {t(`releases.channel.${release.channel}`)}
              </span>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {df.date(new Date(release.date))}
              </span>
            </header>

            <p className="mt-3 text-sm leading-relaxed">{t(highlightKey(release.version))}</p>

            {SHIPPED.map((section) => {
              const count = release.sections[section as ReleaseSection] ?? 0;
              if (count === 0) return null;
              return (
                <section key={section} className="mt-5">
                  <h3 className="text-sm font-semibold">{t(`releases.sections.${section}`)}</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {Array.from({ length: count }, (_, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed">
                        <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
                          ·
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>{t(itemKey(release.version, section, i))}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {(release.sections.next ?? 0) > 0 && (
              <section className="mt-6 rounded-lg border border-dashed p-4" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold">{t('releases.sections.next')}</h3>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('releases.nextNote')}
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {Array.from({ length: release.sections.next ?? 0 }, (_, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                        ·
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{t(itemKey(release.version, 'next', i))}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        ))}

        <p className="mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('releases.footer', { version: CURRENT_RELEASE.version })}
        </p>
      </div>
    </div>
  );
}
