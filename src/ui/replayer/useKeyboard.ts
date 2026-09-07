import { useEffect } from 'react';
import i18n from '@/i18n';
import { useAppStore } from '@/state/store';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Global replayer shortcuts. Suspended while an input has focus.
 * → next · ← prev · ↑ prev hand · ↓ next hand · Home/End · Space play ·
 * 1..5 streets · B chips/BB · T theme · C skin · S show known · ? help ·
 * F fullscreen · [ collapse the hand list
 */
export function useReplayerKeyboard(enabled: boolean, onHandChange: (delta: number) => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useAppStore.getState();
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          s.setPlaying(false);
          s.nextFrame();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          s.setPlaying(false);
          s.prevFrame();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onHandChange(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          onHandChange(1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          s.setFullscreen(!s.fullscreen);
          break;
        case '[':
          e.preventDefault();
          s.toggleSidebar();
          break;
        case 'Home':
          e.preventDefault();
          s.setFrame(0);
          break;
        case 'End':
          e.preventDefault();
          s.setFrame(s.frameCount - 1);
          break;
        case ' ':
          e.preventDefault();
          s.setPlaying(!s.playing);
          break;
        case '1':
          s.jumpTo('preflop');
          break;
        case '2':
          s.jumpTo('hero');
          break;
        case '3':
          s.jumpTo('flop');
          break;
        case '4':
          s.jumpTo('turn');
          break;
        case '5':
          s.jumpTo('river');
          break;
        case 'b':
        case 'B':
          s.updateSettings({ chipDisplay: s.settings.chipDisplay === 'bb' ? 'chips' : 'bb' });
          break;
        case 't':
        case 'T':
          s.updateSettings({ theme: s.settings.theme === 'dark' ? 'light' : 'dark' });
          break;
        case 'c':
        case 'C':
          s.cycleSkin();
          break;
        case 's':
        case 'S':
          s.updateSettings({ showKnownHands: !s.settings.showKnownHands });
          break;
        case '?':
          s.setHelpOpen(!s.helpOpen);
          break;
        case 'Escape':
          if (s.helpOpen) s.setHelpOpen(false);
          else if (s.importModalOpen) s.setImportModalOpen(false);
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, onHandChange]);
}

export function currentLanguage(): string {
  return i18n.language;
}
