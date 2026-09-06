import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hand } from '@/model/types';
import { buildReplay } from '@/engine/replay';
import { computePositions } from '@/model/positions';
import { pokerStarsParser } from '@/parsers/pokerstars';
import { getRepository } from '@/db/repository';
import { anchorSeatFor, computeSeatSlots } from '@/renderers/layout';
import { SvgTableRenderer } from '@/renderers/svg/SvgTableRenderer';
import { formatAmount } from '@/model/format';
import { BUILT_IN_SKINS, DECK_PRESETS, SKIN_DEFAULT_DARK } from '@/skins/presets';
import { CHIP_DENOMINATIONS, type BackPattern, type DeckStyle, type RankFont, type Skin } from '@/skins/types';
import { useAppStore } from '@/state/store';
import { Card } from '@/ui/cards/Card';

/* ------------------------------------------------------------------ */
/* Demo hand for the live preview                                      */
/* ------------------------------------------------------------------ */

const DEMO_TEXT = `PokerStars Hand #260784573802: Tournament #3999835239, $0.49+$0.49+$0.12 USD Hold'em No Limit - Level XX (5000/10000) - 2026/05/12 20:41:10 WET [2026/05/12 15:41:10 ET]
Table '3999835239 12' 9-max Seat #4 is the button
Seat 1: -Iuury (80010 in chips)
Seat 2: Saludfresh (279903 in chips)
Seat 4: Player Four (113500 in chips)
Seat 6: Hero (150000 in chips)
Seat 7: shogi2 (203783 in chips)
Seat 9: LastSeat (99000 in chips)
-Iuury: posts the ante 1500
Saludfresh: posts the ante 1500
Player Four: posts the ante 1500
Hero: posts the ante 1500
shogi2: posts the ante 1500
LastSeat: posts the ante 1500
Hero: posts small blind 5000
shogi2: posts big blind 10000
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
LastSeat: folds
-Iuury: raises 15000 to 25000
Saludfresh: calls 25000
Player Four: raises 88500 to 113500 and is all-in
Hero: calls 108500
shogi2: folds
-Iuury: calls 53510 and is all-in
Saludfresh: calls 88500
*** FLOP *** [Kd 4d 4c]
Saludfresh: bets 33500
Hero: calls 33500
*** TURN *** [Kd 4d 4c] [8s]
Saludfresh: checks
Hero: checks
*** RIVER *** [Kd 4d 4c 8s] [Jc]
Saludfresh: bets 50000
Hero: folds
Uncalled bet (50000) returned to Saludfresh
*** SHOW DOWN ***
Saludfresh: shows [Ks Kc] (a full house, Kings full of Fours)
Player Four: shows [Qs Qd] (two pair, Queens and Fours)
-Iuury: shows [Jh Js] (two pair, Jacks and Fours)
Saludfresh collected 67000 from side pot
Saludfresh collected 355040 from main pot
*** SUMMARY ***
Total pot 422040 Main pot 355040. Side pot 67000. | Rake 0
Board [Kd 4d 4c 8s Jc]
Seat 1: -Iuury showed [Jh Js] and lost with two pair, Jacks and Fours
Seat 2: Saludfresh showed [Ks Kc] and won (422040) with a full house, Kings full of Fours
Seat 4: Player Four (button) showed [Qs Qd] and lost with two pair, Queens and Fours
Seat 6: Hero (small blind) folded on the River
Seat 7: shogi2 (big blind) folded before Flop
Seat 9: LastSeat folded before Flop (didn't bet)`;

function useDemo() {
  return useMemo(() => {
    const hand: Hand = { id: 'demo', ...pokerStarsParser.parse(DEMO_TEXT) };
    const replay = buildReplay(hand, 'Hero');
    const frame = replay.frames.find((f) => f.street === 'flop' && f.action?.type === 'call') ?? replay.frames[replay.frames.length - 2];
    return { hand, replay, frame };
  }, []);
}

/* ------------------------------------------------------------------ */
/* Form helpers                                                        */
/* ------------------------------------------------------------------ */

function ColorField({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <label className="flex items-center gap-2 py-1 text-xs">
      <span className="flex-1">{label}</span>
      <input type="color" value={isHex ? value : '#888888'} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={label} />
      <input className="input !w-[130px] !py-0.5 font-mono text-[11px]" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange(v: number): void }) {
  return (
    <label className="flex items-center gap-2 py-1 text-xs">
      <span className="flex-1">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-[110px]" aria-label={label} style={{ accentColor: 'var(--accent)' }} />
      <span className="w-10 text-right tabular-nums">{value}</span>
    </label>
  );
}

function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange(v: T): void }) {
  return (
    <label className="flex items-center gap-2 py-1 text-xs">
      <span className="flex-1">{label}</span>
      <select className="input !w-[170px] !py-0.5" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="panel px-3 py-2" open={defaultOpen}>
      <summary className="cursor-pointer select-none text-sm font-semibold">{title}</summary>
      <div className="mt-2 flex flex-col">{children}</div>
    </details>
  );
}

function newId(): string {
  return `skin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AdminPage() {
  const { t } = useTranslation();
  const skins = useAppStore((s) => s.skins);
  const loadSkins = useAppStore((s) => s.loadSkins);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [draft, setDraft] = useState<Skin>(() => skins.find((s) => s.id === settings.skinId) ?? SKIN_DEFAULT_DARK);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const importInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const { hand, frame } = useDemo();

  useEffect(() => {
    void loadSkins();
  }, [loadSkins]);

  const patch = <K extends keyof Skin>(key: K, value: Partial<Skin[K]>) => {
    setDraft((d) => ({ ...d, [key]: typeof d[key] === 'object' ? { ...(d[key] as object), ...(value as object) } : value }));
    setDirty(true);
  };

  const select = (id: string) => {
    const s = skins.find((x) => x.id === id);
    if (s) {
      setDraft(s);
      setDirty(false);
    }
  };

  const save = async () => {
    const skin: Skin = { ...draft, isBuiltIn: false, updatedAt: Date.now(), createdAt: draft.createdAt ?? Date.now() };
    if (BUILT_IN_SKINS.some((b) => b.id === skin.id)) {
      // Never overwrite a built-in: save as a copy.
      skin.id = newId();
      skin.name = `${draft.name} (copy)`;
    }
    await getRepository().saveSkin(skin);
    await loadSkins();
    setDraft(skin);
    setDirty(false);
    setNotice(t('admin.saved'));
    window.setTimeout(() => setNotice(''), 1500);
  };

  const duplicate = () => {
    setDraft({ ...draft, id: newId(), name: `${draft.name} (copy)`, isBuiltIn: false });
    setDirty(true);
  };

  const create = () => {
    setDraft({ ...SKIN_DEFAULT_DARK, id: newId(), name: t('admin.new'), isBuiltIn: false });
    setDirty(true);
  };

  const remove = async () => {
    if (draft.isBuiltIn) return;
    if (!window.confirm(t('admin.confirmDelete', { name: draft.name }))) return;
    await getRepository().deleteSkin(draft.id);
    await loadSkins();
    if (settings.skinId === draft.id) updateSettings({ skinId: SKIN_DEFAULT_DARK.id });
    setDraft(SKIN_DEFAULT_DARK);
    setDirty(false);
  };

  const applyToReplayer = async () => {
    if (dirty || !skins.some((s) => s.id === draft.id)) await save();
    updateSettings({ skinId: draft.id, theme: draft.theme });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Skin;
      if (!parsed.deck || !parsed.felt || !parsed.table || !parsed.ui || !parsed.chips || !parsed.plates) throw new Error('shape');
      setDraft({ ...SKIN_DEFAULT_DARK, ...parsed, id: newId(), isBuiltIn: false });
      setDirty(true);
    } catch {
      setNotice(t('admin.invalidJson'));
    }
  };

  const uploadLogo = async (file: File) => {
    const id = `logo-${Date.now().toString(36)}`;
    await getRepository().saveAsset(id, file);
    patch('felt', { logoAssetId: id });
  };

  const slots = useMemo(
    () => computeSeatSlots({ maxSeats: hand.maxSeats, anchorSeat: anchorSeatFor(hand, 'Hero'), buttonSeat: hand.buttonSeat }),
    [hand],
  );
  const positions = useMemo(() => computePositions(hand), [hand]);
  const fmt = (v: number) => formatAmount(v, { display: 'chips', bb: hand.blinds.bb, currency: 'chips' });
  const exact = (v: number) => formatAmount(v, { display: 'chips', bb: hand.blinds.bb, currency: 'chips', compact: false });

  const isInUse = settings.skinId === draft.id;

  return (
    <div className="flex h-full min-h-0">
      {/* ---------- form ---------- */}
      <div className="flex w-[400px] shrink-0 flex-col gap-2 overflow-auto border-r p-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{t('admin.title')}</h1>
          <div className="flex-1" />
          {dirty && (
            <span className="text-[11px]" style={{ color: 'var(--result-break-even)' }}>
              {t('admin.unsavedChanges')}
            </span>
          )}
          {notice && <span className="text-[11px]">{notice}</span>}
        </div>

        <label className="label">{t('admin.presets')}</label>
        <select className="input" value={skins.some((s) => s.id === draft.id) ? draft.id : ''} onChange={(e) => select(e.target.value)}>
          {!skins.some((s) => s.id === draft.id) && <option value="">{draft.name}</option>}
          {skins.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isBuiltIn ? ` · ${t('admin.builtIn')}` : ''}
              {s.id === settings.skinId ? ` · ${t('admin.inUse')}` : ''}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="btn" onClick={create}>
            {t('admin.new')}
          </button>
          <button type="button" className="btn" onClick={duplicate}>
            {t('admin.duplicate')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirty && skins.some((s) => s.id === draft.id)}>
            {t('common.save')}
          </button>
          <button type="button" className="btn" onClick={() => void applyToReplayer()} disabled={isInUse && !dirty}>
            {isInUse && !dirty ? t('admin.inUse') : t('admin.setDefault')}
          </button>
          <button type="button" className="btn" onClick={() => void remove()} disabled={!!draft.isBuiltIn || !skins.some((s) => s.id === draft.id)}>
            {t('common.delete')}
          </button>
          <button type="button" className="btn" onClick={exportJson}>
            {t('admin.exportJson')}
          </button>
          <button type="button" className="btn" onClick={() => importInput.current?.click()}>
            {t('admin.importJson')}
          </button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
        </div>

        <label className="mt-1 flex flex-col gap-1 text-xs">
          <span className="label !mb-0">{t('admin.skinName')}</span>
          <input className="input" value={draft.name} onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setDirty(true); }} />
        </label>
        <SelectField label={t('admin.theme')} value={draft.theme} options={[{ value: 'dark', label: t('header.themeDark') }, { value: 'light', label: t('header.themeLight') }]} onChange={(v) => { setDraft({ ...draft, theme: v }); setDirty(true); }} />

        <Section title={t('admin.deck.title')} defaultOpen>
          <div className="mb-2 flex flex-wrap gap-1">
            {DECK_PRESETS.map((p) => (
              <button key={p.id} type="button" className="btn !px-2 !py-0.5 text-[11px]" onClick={() => patch('deck', p.deck)}>
                {p.name}
              </button>
            ))}
          </div>
          <SelectField<DeckStyle> label={t('admin.deck.style')} value={draft.deck.style} options={[{ value: 'filled', label: t('admin.deck.filled') }, { value: 'outlined', label: t('admin.deck.outlined') }]} onChange={(v) => patch('deck', { style: v })} />
          <SelectField label={t('admin.deck.colorMode')} value={String(draft.deck.colorMode)} options={[{ value: '2', label: t('admin.deck.twoColor') }, { value: '4', label: t('admin.deck.fourColor') }]} onChange={(v) => {
            const mode = Number(v) as 2 | 4;
            const sc = { ...draft.deck.suitColors };
            if (mode === 2) {
              sc.c = sc.s;
              sc.d = sc.h;
            } else {
              sc.d = draft.deck.style === 'filled' ? '#1e5bb8' : '#1565c0';
              sc.c = draft.deck.style === 'filled' ? '#1f7a3a' : '#2e7d32';
            }
            patch('deck', { colorMode: mode, suitColors: sc });
          }} />
          <ColorField label={t('admin.deck.spades')} value={draft.deck.suitColors.s} onChange={(v) => patch('deck', { suitColors: { ...draft.deck.suitColors, s: v } })} />
          <ColorField label={t('admin.deck.hearts')} value={draft.deck.suitColors.h} onChange={(v) => patch('deck', { suitColors: { ...draft.deck.suitColors, h: v } })} />
          <ColorField label={t('admin.deck.diamonds')} value={draft.deck.suitColors.d} onChange={(v) => patch('deck', { suitColors: { ...draft.deck.suitColors, d: v } })} />
          <ColorField label={t('admin.deck.clubs')} value={draft.deck.suitColors.c} onChange={(v) => patch('deck', { suitColors: { ...draft.deck.suitColors, c: v } })} />
          <ColorField label={t('admin.deck.cardBg')} value={draft.deck.cardBg} onChange={(v) => patch('deck', { cardBg: v })} />
          <ColorField label={t('admin.deck.inkOnFilled')} value={draft.deck.inkOnFilled} onChange={(v) => patch('deck', { inkOnFilled: v })} />
          <ColorField label={t('admin.deck.backColor')} value={draft.deck.backColor} onChange={(v) => patch('deck', { backColor: v })} />
          <ColorField label={t('admin.deck.backInk')} value={draft.deck.backInk} onChange={(v) => patch('deck', { backInk: v })} />
          <SelectField<BackPattern> label={t('admin.deck.backPattern')} value={draft.deck.backPattern} options={(['diamonds', 'grid', 'dots', 'plain'] as BackPattern[]).map((p) => ({ value: p, label: t(`admin.deck.pattern.${p}`) }))} onChange={(v) => patch('deck', { backPattern: v })} />
          <SelectField<RankFont> label={t('admin.deck.rankFont')} value={draft.deck.rankFont} options={[{ value: 'Inter', label: 'Inter' }, { value: 'Roboto Mono', label: 'Roboto Mono' }, { value: 'serif', label: 'Serif' }]} onChange={(v) => patch('deck', { rankFont: v })} />
          <RangeField label={t('admin.deck.cornerRadius')} value={draft.deck.cornerRadius} min={0} max={0.3} step={0.01} onChange={(v) => patch('deck', { cornerRadius: v })} />
        </Section>

        <Section title={t('admin.felt.title')}>
          <ColorField label={t('admin.felt.color')} value={draft.felt.color} onChange={(v) => patch('felt', { color: v })} />
          <RangeField label={t('admin.felt.textureIntensity')} value={draft.felt.textureIntensity} min={0} max={1} step={0.05} onChange={(v) => patch('felt', { textureIntensity: v })} />
          <ColorField label={t('admin.felt.vignetteColor')} value={draft.felt.vignetteColor} onChange={(v) => patch('felt', { vignetteColor: v })} />
          <RangeField label={t('admin.felt.vignetteStrength')} value={draft.felt.vignetteStrength} min={0} max={1} step={0.05} onChange={(v) => patch('felt', { vignetteStrength: v })} />
          <label className="flex items-center gap-2 py-1 text-xs">
            <span className="flex-1">{t('admin.felt.logoText')}</span>
            <input className="input !w-[170px] !py-0.5" value={draft.felt.logoText ?? ''} onChange={(e) => patch('felt', { logoText: e.target.value || undefined })} />
          </label>
          <RangeField label={t('admin.felt.logoOpacity')} value={draft.felt.logoOpacity} min={0} max={1} step={0.05} onChange={(v) => patch('felt', { logoOpacity: v })} />
          <div className="flex items-center gap-2 py-1 text-xs">
            <span className="flex-1">{t('admin.felt.logoImage')}</span>
            <button type="button" className="btn !py-0.5 text-[11px]" onClick={() => logoInput.current?.click()}>
              {t('common.import')}
            </button>
            {draft.felt.logoAssetId && (
              <button type="button" className="btn !py-0.5 text-[11px]" onClick={() => patch('felt', { logoAssetId: undefined })}>
                {t('admin.felt.removeLogo')}
              </button>
            )}
            <input ref={logoInput} type="file" accept="image/png,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ''; }} />
          </div>
        </Section>

        <Section title={t('admin.table.title')}>
          <ColorField label={t('admin.table.railColor')} value={draft.table.railColor} onChange={(v) => patch('table', { railColor: v })} />
          <ColorField label={t('admin.table.railHighlight')} value={draft.table.railHighlight} onChange={(v) => patch('table', { railHighlight: v })} />
          <RangeField label={t('admin.table.railWidth')} value={draft.table.railWidth} min={0.02} max={0.12} step={0.005} onChange={(v) => patch('table', { railWidth: v })} />
          <RangeField label={t('admin.table.railShine')} value={draft.table.railShine} min={0} max={1} step={0.05} onChange={(v) => patch('table', { railShine: v })} />
          <RangeField label={t('admin.table.aspect')} value={draft.table.aspect} min={0.4} max={0.75} step={0.01} onChange={(v) => patch('table', { aspect: v })} />
        </Section>

        <Section title={t('admin.ui.title')}>
          {(['bg', 'bgEnd', 'surface', 'surface2', 'text', 'textMuted', 'accent', 'border'] as const).map((k) => (
            <ColorField key={k} label={t(`admin.ui.${k}`)} value={draft.ui[k]} onChange={(v) => patch('ui', { [k]: v })} />
          ))}
        </Section>

        <Section title={t('admin.chips.title')}>
          {CHIP_DENOMINATIONS.map((d) => (
            <ColorField key={d} label={t('admin.chips.denomination', { value: d >= 1000 ? `${d / 1000}K` : d })} value={draft.chips.colors[String(d)] ?? '#888888'} onChange={(v) => patch('chips', { colors: { ...draft.chips.colors, [String(d)]: v } })} />
          ))}
          <ColorField label={t('admin.chips.edge')} value={draft.chips.edge} onChange={(v) => patch('chips', { edge: v })} />
          <ColorField label={t('admin.chips.dealerButton')} value={draft.chips.dealerButton} onChange={(v) => patch('chips', { dealerButton: v })} />
          <ColorField label={t('admin.chips.dealerButtonInk')} value={draft.chips.dealerButtonInk} onChange={(v) => patch('chips', { dealerButtonInk: v })} />
        </Section>

        <Section title={t('admin.plates.title')}>
          {(['bg', 'border', 'activeBorder', 'heroBorder', 'text', 'textMuted', 'foldLabel', 'allInLabel', 'winnerGlow'] as const).map((k) => (
            <ColorField key={k} label={t(`admin.plates.${k}`)} value={draft.plates[k]} onChange={(v) => patch('plates', { [k]: v })} />
          ))}
        </Section>
      </div>

      {/* ---------- preview ---------- */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-auto p-4" style={{ background: `linear-gradient(180deg, ${draft.ui.bg}, ${draft.ui.bgEnd})`, color: draft.ui.text }}>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">{t('admin.preview')}</h2>
          <div className="flex gap-1">
            {['As', 'Kh', 'Qd', 'Jc', 'Td', 'back'].map((c) => (
              <Card key={c} card={c} deck={draft.deck} width={44} />
            ))}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1100px]">
          <SvgTableRenderer
            hand={hand}
            frame={frame}
            skin={draft}
            slots={slots}
            heroName="Hero"
            positions={positions}
            showKnownHands
            animations={false}
            fmt={fmt}
            exact={exact}
            interactive={false}
          />
        </div>
        <div className="flex gap-2 text-xs">
          <div className="panel px-3 py-2" style={{ background: draft.ui.surface, borderColor: draft.ui.border, color: draft.ui.text }}>
            {t('admin.ui.surface')}
            <div style={{ color: draft.ui.textMuted }}>{t('admin.ui.textMuted')}</div>
            <button type="button" className="btn mt-1" style={{ background: draft.ui.accent, color: '#fff', borderColor: 'transparent' }}>
              {t('admin.ui.accent')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
