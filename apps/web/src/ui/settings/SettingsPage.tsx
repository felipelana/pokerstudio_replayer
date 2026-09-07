import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOOKUP_TEMPLATE, isValidLookupTemplate } from '@/model/lookup';
import i18n, { LANGUAGES } from '@/i18n';
import { getRepository } from '@/db/repository';
import { DEFAULT_TAGS, useAppStore, type RendererChoice } from '@/state/store';
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
        <Row label={t('settings.neon')}>
          <Toggle checked={settings.neon} onChange={(v) => update({ neon: v })} label={t('settings.neon')} />
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

      {/* L1: the user's own leak tags — create, rename, recolour, reorder. */}
      <section className="panel mb-4 px-4 pb-3 pt-3">
        <h2 className="mb-2 font-semibold">{t('settings.tags')}</h2>
        <div className="flex flex-col gap-1.5">
          {settings.leakTags.map((tag, i) => (
            <div key={tag.id} className="flex items-center gap-2">
              <input
                type="color"
                value={tag.color}
                onChange={(e) => update({ leakTags: settings.leakTags.map((x) => (x.id === tag.id ? { ...x, color: e.target.value } : x)) })}
                className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label={`${t('settings.tagColor')} ${tag.label}`}
              />
              <input
                className="input flex-1 !py-1 text-xs"
                value={tag.label}
                onChange={(e) => update({ leakTags: settings.leakTags.map((x) => (x.id === tag.id ? { ...x, label: e.target.value } : x)) })}
                aria-label={t('settings.tagLabel')}
              />
              <button
                type="button"
                className="btn-icon !px-1.5 !py-1"
                disabled={i === 0}
                title={t('settings.tagUp')}
                aria-label={t('settings.tagUp')}
                onClick={() => {
                  const next = [...settings.leakTags];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  update({ leakTags: next });
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-icon !px-1.5 !py-1"
                disabled={i === settings.leakTags.length - 1}
                title={t('settings.tagDown')}
                aria-label={t('settings.tagDown')}
                onClick={() => {
                  const next = [...settings.leakTags];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  update({ leakTags: next });
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-icon !px-1.5 !py-1"
                title={t('common.delete')}
                aria-label={`${t('common.delete')} ${tag.label}`}
                onClick={() => update({ leakTags: settings.leakTags.filter((x) => x.id !== tag.id) })}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="btn"
            onClick={() =>
              update({
                leakTags: [...settings.leakTags, { id: `tag-${Date.now().toString(36)}`, label: t('settings.newTag'), color: '#4fa3ff' }],
              })
            }
          >
            {t('settings.addTag')}
          </button>
          <button type="button" className="btn" onClick={() => update({ leakTags: DEFAULT_TAGS })}>
            {t('common.reset')}
          </button>
        </div>
      </section>

      <section className="panel mb-4 px-4 pb-1 pt-3">
        <h2 className="mb-1 font-semibold">{t('settings.lookup')}</h2>
        <Row label={t('settings.lookupTemplate')}>
          <div className="flex items-center gap-2">
            <input
              className="input !w-[420px] text-xs"
              value={settings.playerLookupUrl}
              onChange={(e) => update({ playerLookupUrl: e.target.value })}
              onBlur={(e) => {
                if (!isValidLookupTemplate(e.target.value)) update({ playerLookupUrl: DEFAULT_LOOKUP_TEMPLATE });
              }}
              aria-label={t('settings.lookupTemplate')}
            />
            <button type="button" className="btn" onClick={() => update({ playerLookupUrl: DEFAULT_LOOKUP_TEMPLATE })}>
              {t('common.reset')}
            </button>
          </div>
        </Row>
        <p className="pb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('settings.lookupHint')}
        </p>
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
