import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGES } from '@/i18n';
import { getRepository } from '@/db/repository';
import { useAppStore, type RendererChoice } from '@/state/store';
import { FLAGS } from '@/ui/flags';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t py-2.5 text-sm" style={{ borderColor: 'var(--border)' }}>
      <div className="flex-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
    </label>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const update = useAppStore((s) => s.updateSettings);
  const skins = useAppStore((s) => s.skins);
  const [notice, setNotice] = useState('');

  const clearAll = async () => {
    if (!window.confirm(t('settings.confirmClear'))) return;
    await getRepository().clearAll();
    setNotice(t('settings.cleared'));
  };

  return (
    <div className="mx-auto max-w-3xl overflow-auto p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t('settings.title')}</h1>

      <section className="panel mb-4 px-4 pb-1 pt-3">
        <h2 className="mb-1 font-semibold">{t('settings.general')}</h2>
        <Row label={t('settings.language')}>
          <div className="flex flex-wrap gap-1">
            {LANGUAGES.map((l) => {
              const F = FLAGS[l.flag];
              const on = l.code === settings.language;
              return (
                <button
                  key={l.code}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  aria-label={l.nativeName}
                  lang={l.code}
                  style={{ borderColor: on ? 'var(--accent)' : undefined }}
                  onClick={() => {
                    void i18n.changeLanguage(l.code);
                    update({ language: l.code });
                  }}
                >
                  <F size={18} /> {l.nativeName}
                </button>
              );
            })}
          </div>
        </Row>
        <Row label={t('settings.theme')}>
          <select className="input" value={settings.theme} onChange={(e) => update({ theme: e.target.value as 'dark' | 'light' })}>
            <option value="dark">{t('header.themeDark')}</option>
            <option value="light">{t('header.themeLight')}</option>
          </select>
        </Row>
        <Row label={t('header.skin')}>
          <select className="input" value={settings.skinId} onChange={(e) => update({ skinId: e.target.value, theme: skins.find((s) => s.id === e.target.value)?.theme ?? settings.theme })}>
            {skins.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('settings.chipDisplay')}>
          <select className="input" value={settings.chipDisplay} onChange={(e) => update({ chipDisplay: e.target.value as 'chips' | 'bb' })}>
            <option value="chips">{t('settings.chips')}</option>
            <option value="bb">{t('settings.bb')}</option>
          </select>
        </Row>
      </section>

      <section className="panel mb-4 px-4 pb-1 pt-3">
        <h2 className="mb-1 font-semibold">{t('settings.replay')}</h2>
        <Row label={t('settings.startAtHero')}>
          <Toggle checked={settings.startAtHero} onChange={(v) => update({ startAtHero: v })} label={t('settings.startAtHero')} />
        </Row>
        <Row label={t('settings.rotateToHero')}>
          <Toggle checked={settings.rotateToHero} onChange={(v) => update({ rotateToHero: v })} label={t('settings.rotateToHero')} />
        </Row>
        <Row label={t('settings.animations')}>
          <Toggle checked={settings.animations} onChange={(v) => update({ animations: v })} label={t('settings.animations')} />
        </Row>
        <Row label={t('settings.speed')}>
          <select className="input" value={settings.speed} onChange={(e) => update({ speed: Number(e.target.value) })}>
            {[0.5, 1, 1.5, 2, 3].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('settings.renderer')}>
          <select className="input" value={settings.renderer} onChange={(e) => update({ renderer: e.target.value as RendererChoice })}>
            <option value="auto">{t('settings.rendererAuto')}</option>
            <option value="three">{t('settings.rendererThree')}</option>
            <option value="svg">{t('settings.rendererSvg')}</option>
          </select>
        </Row>
      </section>

      <section className="panel mb-4 px-4 pb-1 pt-3">
        <h2 className="mb-1 font-semibold">{t('settings.equity')}</h2>
        <Row label={t('settings.showEquity')}>
          <Toggle checked={settings.showEquity} onChange={(v) => update({ showEquity: v })} label={t('settings.showEquity')} />
        </Row>
        <Row label={t('settings.equityIterations')}>
          <select className="input" value={settings.equityIterations} onChange={(e) => update({ equityIterations: Number(e.target.value) })}>
            {[5000, 10000, 20000, 50000, 100000].map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </Row>
      </section>

      <section className="panel mb-4 px-4 pb-3 pt-3">
        <h2 className="mb-1 font-semibold">{t('settings.data')}</h2>
        <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('settings.dataHint')}
        </p>
        <button type="button" className="btn" onClick={() => void clearAll()}>
          {t('settings.clearData')}
        </button>
        {notice && <span className="ml-3 text-xs">{notice}</span>}
      </section>
    </div>
  );
}
