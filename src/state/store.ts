import { create } from 'zustand';
import type { Hand, Session } from '@/model/types';
import type { ChipDisplay } from '@/model/format';
import type { Skin } from '@/skins/types';
import { BUILT_IN_SKINS, SKIN_DEFAULT_DARK } from '@/skins/presets';
import { getRepository } from '@/db/repository';

export type RendererChoice = 'auto' | 'three' | 'svg';

export interface Settings {
  language: string;
  theme: 'dark' | 'light';
  skinId: string;
  chipDisplay: ChipDisplay;
  showKnownHands: boolean;
  colorHintResults: boolean;
  colorVpipOnly: boolean;
  startAtHero: boolean;
  /** Skip ante/blind posting frames while navigating (R6). */
  skipPosts: boolean;
  rotateToHero: boolean;
  animations: boolean;
  /** Playback speed multiplier 0.5..3 */
  speed: number;
  renderer: RendererChoice;
  /** Blind review: hide result colours and net amounts in the list/timeline. */
  hideResults: boolean;
  /** Glowing edge on the felt (colour and strength come from the skin). */
  neon: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'dark',
  skinId: SKIN_DEFAULT_DARK.id,
  chipDisplay: 'chips',
  showKnownHands: true,
  colorHintResults: true,
  colorVpipOnly: false,
  startAtHero: true,
  skipPosts: false,
  rotateToHero: true,
  animations: true,
  speed: 1,
  renderer: 'auto',
  hideResults: false,
  neon: true,
};

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
  importModalOpen: boolean;
  helpOpen: boolean;
  reviewOpen: boolean;

  loadSettings(): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;
  loadSkins(): Promise<void>;
  cycleSkin(): void;

  loadSession(sessionId: string, handId?: string): Promise<void>;
  setHands(session: Session | undefined, hands: Hand[]): void;
  selectHand(index: number, startFrame?: number): void;
  nextHand(): void;
  prevHand(): void;
  setFrame(index: number): void;
  nextFrame(): void;
  prevFrame(): void;
  jumpTo(target: JumpTarget): void;
  setPlaying(playing: boolean): void;
  setReplayMeta(frameCount: number, jumpTargets: Partial<Record<JumpTarget, number>>, postFrames?: number[]): void;
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
    const idx = handId ? Math.max(0, hands.findIndex((h) => h.id === handId)) : 0;
    // Focus player is remembered per session (hero-less dealer exports).
    const focusPlayer = await repo.getSetting<string | undefined>(`focus:${sessionId}`, undefined);
    set({ session, hands, handIndex: idx, frameIndex: 0, playing: false, focusPlayer });
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
