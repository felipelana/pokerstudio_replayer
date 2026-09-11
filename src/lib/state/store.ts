import { create } from 'zustand';
import type { Hand, Session, Site } from '@/domain/model/types';
import { accountApi } from '@/lib/infrastructure/http/accountApi';
import type { ChipDisplay } from '@/domain/model/format';
import type { Skin } from '@/lib/skins/types';
import { DEFAULT_LOOKUP_TEMPLATE } from '@/domain/model/lookup';
import { SEAT_DISTANCE_DEFAULT } from '@/features/replayer/renderers/layout';
import type { UserTag } from '@/domain/model/types';

/** Seed list — the leaks the app shipped with, now editable by the user (L1). */
export const DEFAULT_TAGS: UserTag[] = [
  { id: 'overfold', label: 'Overfold', color: '#4fa3ff' },
  { id: 'underfold', label: 'Underfold', color: '#38b6ff' },
  { id: 'sizing', label: 'Sizing', color: '#f5c542' },
  { id: 'icm', label: 'ICM', color: '#ef8f4c' },
  { id: 'bluff-catch', label: 'Bluff catch', color: '#c2185b' },
  { id: 'thin-value', label: 'Thin value', color: '#7b3fb5' },
  { id: 'position', label: 'Position', color: '#12a3a3' },
  { id: 'tilt', label: 'Tilt', color: '#e53935' },
  { id: 'preflop-range', label: 'Preflop range', color: '#43a047' },
  { id: 'missed-value', label: 'Missed value', color: '#aacc00' },
];
import { skinApi } from '@/lib/infrastructure/http/accountApi';
import { BUILT_IN_SKINS, SKIN_DEFAULT_DARK, SKIN_POKERSTUDIO } from '@/lib/skins/presets';
import { getRepository } from '@/lib/db/repository';
import { takeSpot } from '@/lib/db/lastSpot';

export type RendererChoice = 'auto' | 'three' | 'svg';

export interface Settings {
  language: string;
  theme: 'dark' | 'light';
  skinId: string;
  chipDisplay: ChipDisplay;
  /** 'auto' follows the language; the other two are explicit. */
  dateFormat: 'auto' | 'dmy' | 'mdy';
  showKnownHands: boolean;
  colorHintResults: boolean;
  startAtHero: boolean;
  /** Skip ante/blind posting frames while navigating (R6). */
  skipPosts: boolean;
  /** Left column collapsed / its width in px (R5). */
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  /** Result bar: full, compact or hidden (R17). */
  timelineMode: 'normal' | 'compact' | 'hidden';
  /** External player lookup, {nick} and {network} placeholders (R18). */
  playerLookupUrl: string;
  /** Quick replayer toggles (R8). */
  hideHeroCards: boolean;
  holeLayoutOverride: 'skin' | 'spread' | 'overlap' | 'fan';
  /** Deck colours for this session; 'skin' keeps whatever the skin sets. */
  deckPreset: string;
  /** Independent zooms, 0.7..1.6 (R21). */
  zoomTable: number;
  zoomCards: number;
  zoomChips: number;
  /** Overrides the skin's board spacing; 'skin' follows whatever it sets. */
  boardGapOverride: number | 'skin';
  /** How far the seats sit from the felt, 0..1.2. */
  seatDistance: number;
  /** Print the denomination on each chip (R22). */
  chipDenominations: boolean;
  /** The user's own leak tags (L1). */
  leakTags: UserTag[];
  rotateToHero: boolean;
  /** Where the hero sits, as a fraction of the ring: 0 = bottom, 0.5 = top. */
  heroSeat: number;
  animations: boolean;
  /** Playback speed multiplier 0.5..3 */
  speed: number;
  renderer: RendererChoice;
  /** Blind review: hide result colours and net amounts in the list/timeline. */
  hideResults: boolean;
  /** Glowing edge on the felt (colour and strength come from the skin). */
  neon: boolean;
  /** Each guided run has been offered once: the library, and the replayer. */
  tourSeen: boolean;
  tourReplayerSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'dark',
  skinId: SKIN_POKERSTUDIO.id,
  chipDisplay: 'chips',
  dateFormat: 'auto',
  showKnownHands: true,
  colorHintResults: true,
  startAtHero: true,
  skipPosts: false,
  sidebarCollapsed: false,
  sidebarWidth: 268,
  timelineMode: 'normal',
  playerLookupUrl: DEFAULT_LOOKUP_TEMPLATE,
  hideHeroCards: false,
  holeLayoutOverride: 'skin',
  deckPreset: 'skin',
  zoomTable: 1,
  zoomCards: 1,
  zoomChips: 1,
  boardGapOverride: 'skin',
  seatDistance: SEAT_DISTANCE_DEFAULT,
  chipDenominations: true,
  leakTags: DEFAULT_TAGS,
  rotateToHero: true,
  heroSeat: 0,
  animations: true,
  speed: 1,
  renderer: 'auto',
  hideResults: false,
  neon: true,
  tourSeen: false,
  tourReplayerSeen: false,
};

/** The two guided runs: the library you land on, and the replayer itself. */
export type TourFlow = 'library' | 'replayer';

export type JumpTarget = 'preflop' | 'hero' | 'flop' | 'turn' | 'river' | 'showdown' | 'end';

interface AppState {
  settings: Settings;
  settingsLoaded: boolean;
  skins: Skin[];

  session?: Session;
  hands: Hand[];
  handIndex: number;
  frameIndex: number;
  playing: boolean;
  /** Manual "set as focus / hero" — applies to every hand of the session where the player sits. */
  focusPlayer?: string;
  /** Frame count of the current replay, set by the replayer view. */
  frameCount: number;
  /** Street start indices of the current replay (from HandReplay.streetStart + hero). */
  jumpTargets: Partial<Record<JumpTarget, number>>;
  /** Indices of ante/blind posting frames, used by the skip flag. */
  postFrames: number[];
  /** Hand-list filters and ordering (R14). */
  filterPositions: string[];
  filterResult: 'all' | 'won' | 'lost';
  /** Show only hands where the focused player put money in (VPIP). */
  filterPlayedOnly: boolean;
  sortMode: 'default' | 'potDesc' | 'reverse';
  fullscreen: boolean;
  importModalOpen: boolean;
  helpOpen: boolean;
  reviewOpen: boolean;

  loadSettings(): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;
  loadSkins(): Promise<void>;
  /** Merges the skins saved on the account into the local library. */
  syncSkinsFromAccount(): Promise<void>;
  cycleSkin(): void;

  loadSession(sessionId: string, handId?: string): Promise<void>;
  setHands(session: Session | undefined, hands: Hand[]): void;
  /** Records where the review stopped, in the database and in this store. */
  saveProgress(patch: {
    lastHandIndex?: number;
    lastFrameIndex?: number;
    status?: 'in-progress' | 'completed';
    resumeNoticeSeen?: boolean;
  }): Promise<void>;
  /** The screen name this account plays under in each room, from the server.
   *  Used to recognise the reader in a history that names no hero. */
  /** The guided tour, while it is running, and which of the two it is. */
  tourOpen: boolean;
  tourFlow: TourFlow;
  setTourOpen(open: boolean, flow?: TourFlow): void;
  /** Answers about the tool, raised from the header or from the tour. */
  helpCenterOpen: boolean;
  setHelpCenterOpen(open: boolean): void;
  /** The suggestion box, which the help panel can also raise. */
  feedbackOpen: boolean;
  setFeedbackOpen(open: boolean): void;

  roomNicks: Partial<Record<Site, string>>;
  loadRoomNicks(): Promise<void>;
  /** O vocabulário que a administração oferece, ao lado das etiquetas do leitor. */
  catalogueLeaks: UserTag[];
  loadCatalogueLeaks(): Promise<void>;

  /** How the library was left: filters, order and page survive a trip to the
   *  replayer and back, so the reader returns to the list they were reading. */
  libraryView: {
    query: string;
    site: string;
    from: string;
    to: string;
    storage: 'all' | 'saved' | 'local';
    sort: 'imported' | 'opened' | 'name';
    pageIndex: number;
    pageSize: number;
  };
  setLibraryView(patch: Partial<AppState['libraryView']>): void;

  /** Hand a reopened session landed on, until the notice is dismissed. */
  resumedFrom?: number;
  clearResumed(): void;
  selectHand(index: number, startFrame?: number): void;
  nextHand(): void;
  prevHand(): void;
  setFrame(index: number): void;
  nextFrame(): void;
  prevFrame(): void;
  jumpTo(target: JumpTarget): void;
  setPlaying(playing: boolean): void;
  setReplayMeta(
    frameCount: number,
    jumpTargets: Partial<Record<JumpTarget, number>>,
    postFrames?: number[],
  ): void;
  togglePosition(position: string): void;
  setFilterResult(value: 'all' | 'won' | 'lost'): void;
  setFilterPlayedOnly(value: boolean): void;
  setSortMode(value: 'default' | 'potDesc' | 'reverse'): void;
  clearFilters(): void;
  toggleSidebar(): void;
  setSidebarWidth(width: number): void;
  setFullscreen(value: boolean): void;
  cycleTimelineMode(): void;
  setFocus(player: string | undefined): void;
  setImportModalOpen(open: boolean): void;
  setHelpOpen(open: boolean): void;
  setReviewOpen(open: boolean): void;
}

const SETTINGS_KEY = 'settings';

export const useAppStore = create<AppState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  skins: BUILT_IN_SKINS,
  hands: [],
  handIndex: 0,
  frameIndex: 0,
  playing: false,
  focusPlayer: undefined,
  frameCount: 0,
  jumpTargets: {},
  postFrames: [],
  filterPositions: [],
  filterResult: 'all',
  filterPlayedOnly: false,
  sortMode: 'default',
  fullscreen: false,
  importModalOpen: false,
  helpOpen: false,
  reviewOpen: false,

  async loadSettings() {
    const stored = await getRepository().getSetting<Partial<Settings>>(SETTINGS_KEY, {});
    set({ settings: { ...DEFAULT_SETTINGS, ...stored }, settingsLoaded: true });
  },

  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void getRepository().setSetting(SETTINGS_KEY, settings);
  },

  async loadSkins() {
    const custom = await getRepository().listSkins();
    const byId = new Map<string, Skin>();
    for (const s of BUILT_IN_SKINS) byId.set(s.id, s);
    for (const s of custom) byId.set(s.id, s);
    set({ skins: Array.from(byId.values()) });
  },

  /**
   * Account skins win over a local copy with the same id, so opening the app on
   * a second device brings the customisation with it.
   */
  async syncSkinsFromAccount() {
    try {
      const remote = await skinApi.list();
      const repo = getRepository();
      for (const row of remote) {
        const skin = { ...(row.data as Skin), id: row.id, name: row.name, isBuiltIn: false };
        await repo.saveSkin(skin);
      }
      if (remote.length) await get().loadSkins();
    } catch {
      // Offline or signed out: the local library stays as it is.
    }
  },

  cycleSkin() {
    const { skins, settings } = get();
    const idx = skins.findIndex((s) => s.id === settings.skinId);
    const next = skins[(idx + 1) % skins.length];
    if (next) get().updateSettings({ skinId: next.id, theme: next.theme });
  },

  async loadSession(sessionId, handId) {
    const repo = getRepository();
    const session = await repo.getSession(sessionId);
    if (!session) {
      set({ session: undefined, hands: [], handIndex: 0, frameIndex: 0 });
      return;
    }
    const hands = await repo.getHands(session.handIds);
    hands.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    // Without a hand in the URL, a session opens exactly where it stopped —
    // walking away mid-hand must not cost the reader anything. "Finished" is a
    // label the library sets, not a reason to lose the place.
    // A spot written while the page was closing beats the row: the tab may
    // have gone away before the database write landed.
    const parting = takeSpot(sessionId);
    const savedHand = parting?.handIndex ?? session.lastHandIndex ?? 0;
    const savedFrame = parting?.frameIndex ?? session.lastFrameIndex ?? 0;
    const saved = Math.min(Math.max(0, savedHand), Math.max(0, hands.length - 1));
    // A hand in the URL is an explicit request and wins; without one the saved
    // hand does. Either way, landing on the saved hand restores the saved
    // moment inside it — reloading the page the replayer itself wrote into the
    // address bar must not cost the reader the action they were looking at.
    const idx = handId
      ? Math.max(
          0,
          hands.findIndex((h) => h.id === handId),
        )
      : saved;
    const frame = idx === saved ? savedFrame : 0;
    // Focus player is remembered per session (hero-less dealer exports).
    const focusPlayer = await repo.getSetting<string | undefined>(`focus:${sessionId}`, undefined);
    set({
      session,
      hands,
      handIndex: idx,
      frameIndex: frame,
      playing: false,
      focusPlayer,
      // The notice explains what the replayer just did; once that is known,
      // repeating it on every return is noise.
      resumedFrom: saved > 0 && idx === saved && !session.resumeNoticeSeen ? saved : undefined,
    });
  },

  tourOpen: false,
  tourFlow: 'library',
  setTourOpen(open, flow) {
    set({ tourOpen: open, ...(flow ? { tourFlow: flow } : {}) });
  },

  helpCenterOpen: false,
  setHelpCenterOpen(open) {
    set({ helpCenterOpen: open });
  },

  feedbackOpen: false,
  setFeedbackOpen(open) {
    set({ feedbackOpen: open });
  },

  roomNicks: {},
  catalogueLeaks: [],

  /**
   * O catálogo é oferecido, não imposto: entra ao lado do que o leitor criou,
   * e uma falha em buscá-lo deixa a tela exatamente como estava.
   */
  async loadCatalogueLeaks() {
    try {
      const answer = await accountApi.leaks();
      set({
        catalogueLeaks: answer.items.map((leak) => ({
          id: leak.slug,
          label: leak.label,
          color: leak.color,
        })),
      });
    } catch {
      // Sem servidor, o leitor continua com as próprias etiquetas.
    }
  },

  async loadRoomNicks() {
    try {
      const { items } = await accountApi.roomNicks();
      set({
        roomNicks: Object.fromEntries(items.map((n) => [n.room, n.nickname])) as Partial<
          Record<Site, string>
        >,
      });
    } catch {
      // Signed out, or the server is not there: the replayer works without it.
      set({ roomNicks: {} });
    }
  },

  libraryView: {
    query: '',
    site: '',
    from: '',
    to: '',
    storage: 'all',
    sort: 'imported',
    pageIndex: 0,
    pageSize: 10,
  },

  setLibraryView(patch) {
    set({ libraryView: { ...get().libraryView, ...patch } });
  },

  clearResumed() {
    const { session } = get();
    set({ resumedFrom: undefined });
    if (session && !session.resumeNoticeSeen) {
      set({ session: { ...session, resumeNoticeSeen: true } });
      void getRepository().saveSessionProgress(session.id, { resumeNoticeSeen: true });
    }
  },

  async saveProgress(patch) {
    const { session } = get();
    if (!session) return;
    const full = { ...patch, lastOpenedAt: new Date() };
    // The in-memory session has to move with the row: reopening from the
    // library does not reload it, and a stale copy would send the reader back
    // to where they were two visits ago.
    set({ session: { ...session, ...full } });
    await getRepository().saveSessionProgress(session.id, full);
  },

  setHands(session, hands) {
    set({ session, hands, handIndex: 0, frameIndex: 0, playing: false });
  },

  selectHand(index, startFrame = 0) {
    const { hands } = get();
    if (index < 0 || index >= hands.length) return;
    set({ handIndex: index, frameIndex: startFrame, playing: false });
  },

  nextHand() {
    get().selectHand(get().handIndex + 1);
  },

  prevHand() {
    get().selectHand(get().handIndex - 1);
  },

  setFrame(index) {
    const { frameCount } = get();
    const clamped = Math.max(0, Math.min(Math.max(0, frameCount - 1), index));
    set({ frameIndex: clamped });
  },

  nextFrame() {
    const { frameIndex, frameCount, postFrames, settings } = get();
    if (frameIndex >= frameCount - 1) {
      set({ playing: false });
      return;
    }
    let next = frameIndex + 1;
    // With the flag on, ante/blind postings are not walked through one by one.
    if (settings.skipPosts) while (next < frameCount - 1 && postFrames.includes(next)) next += 1;
    set({ frameIndex: next });
  },

  prevFrame() {
    const { frameIndex, postFrames, settings } = get();
    if (frameIndex <= 0) return;
    let prev = frameIndex - 1;
    if (settings.skipPosts) while (prev > 0 && postFrames.includes(prev)) prev -= 1;
    set({ frameIndex: prev });
  },

  jumpTo(target) {
    const idx = get().jumpTargets[target];
    if (idx !== undefined) set({ frameIndex: idx, playing: false });
  },

  togglePosition(position) {
    const current = get().filterPositions;
    set({
      filterPositions: current.includes(position)
        ? current.filter((p) => p !== position)
        : [...current, position],
    });
  },

  setFilterPlayedOnly(value) {
    set({ filterPlayedOnly: value });
  },

  setFilterResult(value) {
    set({ filterResult: value });
  },

  setSortMode(value) {
    set({ sortMode: value });
  },

  clearFilters() {
    set({ filterPositions: [], filterResult: 'all', filterPlayedOnly: false, sortMode: 'default' });
  },

  toggleSidebar() {
    void get().updateSettings({ sidebarCollapsed: !get().settings.sidebarCollapsed });
  },

  setSidebarWidth(width) {
    void get().updateSettings({ sidebarWidth: Math.max(190, Math.min(460, Math.round(width))) });
  },

  setFullscreen(value) {
    set({ fullscreen: value });
  },

  cycleTimelineMode() {
    const order = ['normal', 'compact', 'hidden'] as const;
    const next = order[(order.indexOf(get().settings.timelineMode) + 1) % order.length];
    void get().updateSettings({ timelineMode: next });
  },

  setPlaying(playing) {
    set({ playing });
  },

  setReplayMeta(frameCount, jumpTargets, postFrames = []) {
    const { frameIndex } = get();
    set({
      frameCount,
      jumpTargets,
      postFrames,
      frameIndex: Math.min(frameIndex, Math.max(0, frameCount - 1)),
    });
  },

  setFocus(player) {
    set({ focusPlayer: player });
    const session = get().session;
    if (session) void getRepository().setSetting(`focus:${session.id}`, player);
  },

  setImportModalOpen(open) {
    set({ importModalOpen: open });
  },
  setHelpOpen(open) {
    set({ helpOpen: open });
  },
  setReviewOpen(open) {
    set({ reviewOpen: open });
  },
}));

/** Resolve the active skin, letting the theme toggle override UI tokens of any skin. */
export function useActiveSkin(): Skin {
  const skins = useAppStore((s) => s.skins);
  const { skinId, theme } = useAppStore((s) => s.settings);
  const base = skins.find((s) => s.id === skinId) ?? SKIN_DEFAULT_DARK;
  if (base.theme === theme) return base;
  const swap = BUILT_IN_SKINS.find((s) => s.theme === theme) ?? SKIN_DEFAULT_DARK;
  return { ...base, theme, ui: swap.ui, plates: swap.plates };
}
