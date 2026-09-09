import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { removeTagEverywhere, usesOfTag, type TagUse } from '@/db/tagUsage';
import { DEFAULT_LOOKUP_TEMPLATE, isValidLookupTemplate } from '@/model/lookup';
import i18n, { LANGUAGES } from '@/i18n';
import { getRepository } from '@/db/repository';
import { DEFAULT_TAGS, useAppStore, type RendererChoice } from '@/state/store';
import { FLAGS } from '@/ui/flags';
import { IconChevronDown, IconDatabase, IconPlay, IconSearch, IconSliders, IconTag, IconUser } from '@/ui/icons';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { RoomNicks } from './RoomNicks';

type PanelId = 'general' | 'replay' | 'nicks' | 'tags' | 'lookup' | 'data';

interface Group {
  id: string;
  label: string;
  items: { id: PanelId; label: string; icon: React.ReactNode }[];
}

const GROUPS: Group[] = [
  {
    id: 'preferences',
    label: 'settings.groupPreferences',
    items: [
      { id: 'general', label: 'settings.general', icon: <IconSliders size={14} /> },
      { id: 'replay', label: 'settings.replay', icon: <IconPlay size={14} /> },
    ],
  },
  {
    id: 'rooms',
    label: 'settings.groupRooms',
    items: [{ id: 'nicks', label: 'settings.roomNicks', icon: <IconUser size={14} /> }],
  },
  {
    id: 'study',
    label: 'settings.groupStudy',
    items: [
      { id: 'tags', label: 'settings.tags', icon: <IconTag size={14} /> },
      { id: 'lookup', label: 'settings.lookup', icon: <IconSearch size={14} /> },
    ],
  },
  {
    id: 'data',
    label: 'settings.groupData',
    items: [{ id: 'data', label: 'settings.data', icon: <IconDatabase size={14} /> }],
  },
];

const OPEN_KEY = 'pokerstudio.settings.group';
const PANEL_KEY = 'pokerstudio.settings.panel';

/** Where the reader was last time, when the browser remembers it. */
function remembered(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A browser that refuses storage still works, it just forgets.
  }
}

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
    await getRepository().clearAll();
    setNotice(t('settings.cleared'));
  };

  const [params, setParams] = useSearchParams();
  const asked = params.get('panel') as PanelId | null;
  const [tab, setTab] = useState<PanelId>(() => (asked ?? (remembered(PANEL_KEY, 'general') as PanelId)));
  const [openGroup, setOpenGroup] = useState(() =>
    asked ? (GROUPS.find((g) => g.items.some((i) => i.id === asked))?.id ?? 'preferences') : remembered(OPEN_KEY, 'preferences'),
  );
  const [confirmingClear, setConfirmingClear] = useState(false);
  /** A tag the reader asked to delete, and where it is already in use. */
  const [removingTag, setRemovingTag] = useState<{ id: string; label: string; uses: TagUse[] }>();

  // Arriving with ?panel= opens that panel, then the address goes back to being
  // plain: the choice is remembered from here on like any other.
  useEffect(() => {
    if (!asked) return;
    setTab(asked);
    setOpenGroup(GROUPS.find((g) => g.items.some((i) => i.id === asked))?.id ?? 'preferences');
    setParams({}, { replace: true });
  }, [asked, setParams]);

  /** Nothing is removed before the reader has been told what it is on. */
  const askToRemoveTag = async (tag: { id: string; label: string }) => {
    setRemovingTag({ ...tag, uses: await usesOfTag(tag.id) });
  };

  const dropTag = async (id: string, alsoFromHands: boolean) => {
    if (alsoFromHands) await removeTagEverywhere(id);
    update({ leakTags: settings.leakTags.filter((x) => x.id !== id) });
    setRemovingTag(undefined);
  };

  useEffect(() => remember(PANEL_KEY, tab), [tab]);
  useEffect(() => remember(OPEN_KEY, openGroup), [openGroup]);

  return (
    <div className="mx-auto h-full max-w-5xl overflow-auto p-6">
      <ConfirmDialog
        open={confirmingClear}
        title={t('settings.clearData')}
        body={t('settings.confirmClear')}
        confirmLabel={t('settings.clearData')}
        danger
        onCancel={() => setConfirmingClear(false)}
        onConfirm={() => {
          setConfirmingClear(false);
          void clearAll();
        }}
      />
      <h1 className="mb-4 text-2xl font-semibold">{t('settings.title')}</h1>

      {removingTag && (
        <TagRemoval
          tag={removingTag}
          onCancel={() => setRemovingTag(undefined)}
          onConfirm={(alsoFromHands) => void dropTag(removingTag.id, alsoFromHands)}
        />
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <nav className="w-full shrink-0 md:w-56" aria-label={t('settings.title')}>
        {GROUPS.map((group) => {
          const open = openGroup === group.id;
          return (
            <div key={group.id} className="mb-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
                aria-expanded={open}
                onClick={() => setOpenGroup(open ? '' : group.id)}
              >
                <span className={`transition-transform ${open ? '' : '-rotate-90'}`}>
                  <IconChevronDown size={12} />
                </span>
                {t(group.label)}
              </button>
              {open && (
                <ul className="flex flex-col gap-0.5 pb-1 pl-2">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={tab === item.id ? 'page' : undefined}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${
                          tab === item.id
                            ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] font-medium'
                            : 'hover:bg-[var(--surface-2)]'
                        }`}
                        onClick={() => setTab(item.id)}
                      >
                        {item.icon}
                        <span className="truncate">{t(item.label)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">

      {tab === 'general' && (
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
        <Row label={t('settings.dateFormat')}>
          <select
            className="input !w-auto"
            value={settings.dateFormat}
            onChange={(e) => update({ dateFormat: e.target.value as 'auto' | 'dmy' | 'mdy' })}
          >
            <option value="auto">{t('settings.dateAuto')}</option>
            <option value="dmy">dd/mm/aaaa</option>
            <option value="mdy">mm/dd/aaaa</option>
          </select>
        </Row>
        <Row label={t('settings.heroSeat')}>
          <select
            className="input !w-auto"
            // The plate's own "sit here" can pick any chair; this list shows the
            // quarter of the table nearest to it.
            value={String(Math.round(((settings.heroSeat ?? 0) % 1) * 4) % 4 / 4)}
            onChange={(e) => update({ heroSeat: Number(e.target.value) })}
          >
            <option value="0">{t('settings.seatBottom')}</option>
            <option value="0.25">{t('settings.seatLeft')}</option>
            <option value="0.5">{t('settings.seatTop')}</option>
            <option value="0.75">{t('settings.seatRight')}</option>
          </select>
        </Row>
        <Row label={t('settings.chipDisplay')}>
          <select className="input" value={settings.chipDisplay} onChange={(e) => update({ chipDisplay: e.target.value as 'chips' | 'bb' })}>
            <option value="chips">{t('settings.chips')}</option>
            <option value="bb">{t('settings.bb')}</option>
          </select>
        </Row>
      </section>
      )}

      {tab === 'replay' && (
      <section className="panel mb-4 px-4 pb-1 pt-3">
        <h2 className="mb-1 font-semibold">{t('settings.replay')}</h2>
        <Row label={t('settings.startAtHero')}>
          <Toggle checked={settings.startAtHero} onChange={(v) => update({ startAtHero: v })} label={t('settings.startAtHero')} />
        </Row>
        <Row label={t('settings.seatDistance')}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.05}
              value={settings.seatDistance}
              onChange={(e) => update({ seatDistance: Number(e.target.value) })}
              className="w-40"
              style={{ accentColor: 'var(--accent)' }}
              aria-label={t('settings.seatDistance')}
            />
            <span className="w-10 text-right text-xs tabular-nums">{Math.round(settings.seatDistance * 100)}%</span>
          </div>
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
      )}

      {/* L1: the user's own leak tags — create, rename, recolour, reorder. */}
      {tab === 'nicks' && (
      <section className="panel mb-4 px-4 pb-4 pt-3">
        <h2 className="mb-2 font-semibold">{t('settings.roomNicks')}</h2>
        <RoomNicks />
      </section>
      )}

      {tab === 'tags' && (
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
                onClick={() => void askToRemoveTag(tag)}
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
      )}

      {tab === 'lookup' && (
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
      )}

      {tab === 'data' && (
      <section className="panel mb-4 px-4 pb-3 pt-3">
        <h2 className="mb-1 font-semibold">{t('settings.data')}</h2>
        <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('settings.dataHint')}
        </p>
        <button type="button" className="btn" onClick={() => setConfirmingClear(true)}>
          {t('settings.clearData')}
        </button>
        {notice && <span className="ml-3 text-xs">{notice}</span>}
      </section>
      )}
      </div>
      </div>
    </div>
  );
}

/**
 * What happens when a tag is already on hands.
 *
 * A tag with no hands behind it goes quietly. One that has been used names the
 * reviews it is on and offers the only two honest ways out: leave it alone, or
 * take it off those hands as well, said in as many words before it happens.
 */
function TagRemoval({
  tag,
  onCancel,
  onConfirm,
}: {
  tag: { id: string; label: string; uses: TagUse[] };
  onCancel(): void;
  onConfirm(alsoFromHands: boolean): void;
}) {
  const { t } = useTranslation();
  const hands = tag.uses.reduce((total, use) => total + use.hands.length, 0);

  if (tag.uses.length === 0) {
    return (
      <ConfirmDialog
        open
        title={t('settings.tagRemove', { tag: tag.label })}
        body={t('settings.tagRemoveFree')}
        confirmLabel={t('common.delete')}
        danger
        onCancel={onCancel}
        onConfirm={() => onConfirm(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.tagRemove', { tag: tag.label })}
        className="panel flex max-h-[80vh] w-full max-w-[540px] flex-col gap-3 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t('settings.tagRemove', { tag: tag.label })}</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('settings.tagInUse', { hands, reviews: tag.uses.length })}
        </p>

        <ul className="min-h-0 flex-1 overflow-auto rounded-lg border p-2 text-sm" style={{ borderColor: 'var(--border)' }}>
          {tag.uses.map((use) => (
            <li key={use.sessionId} className="py-1">
              <span className="font-semibold">{use.sessionName}</span>
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {use.hands.map((hand) => `#${hand.position}`).join(', ')}
              </span>
            </li>
          ))}
        </ul>

        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('settings.tagCascadeNote')}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: 'var(--result-lost)', borderColor: 'transparent', color: '#fff' }}
            onClick={() => onConfirm(true)}
          >
            {t('settings.tagRemoveCascade')}
          </button>
        </div>
      </div>
    </div>
  );
}
