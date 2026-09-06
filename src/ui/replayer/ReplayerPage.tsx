import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildReplay, quickResult } from '@/engine/replay';
import { computePositions } from '@/model/positions';
import { useAppStore, useActiveSkin, type JumpTarget } from '@/state/store';
import { useAmountFormatter } from '@/ui/hooks/useFormat';
import { ImportPanel } from '@/ui/library/ImportPanel';
import { Footer } from './Footer';
import { HelpModal } from './HelpModal';
import { ReviewPanel } from './ReviewPanel';
import { Sidebar, type HandRow } from './Sidebar';
import { TableArea } from './TableArea';
import { useReplayerKeyboard } from './useKeyboard';

export function ReplayerPage() {
  const { t } = useTranslation();
  const { sessionId, handId } = useParams();
  const navigate = useNavigate();
  const session = useAppStore((s) => s.session);
  const hands = useAppStore((s) => s.hands);
  const handIndex = useAppStore((s) => s.handIndex);
  const frameIndex = useAppStore((s) => s.frameIndex);
  const playing = useAppStore((s) => s.playing);
  const focusPlayer = useAppStore((s) => s.focusPlayer);
  const settings = useAppStore((s) => s.settings);
  const loadSession = useAppStore((s) => s.loadSession);
  const selectHand = useAppStore((s) => s.selectHand);
  const setReplayMeta = useAppStore((s) => s.setReplayMeta);
  const nextFrame = useAppStore((s) => s.nextFrame);
  const setFocus = useAppStore((s) => s.setFocus);
  const importModalOpen = useAppStore((s) => s.importModalOpen);
  const setImportModalOpen = useAppStore((s) => s.setImportModalOpen);
  const reviewOpen = useAppStore((s) => s.reviewOpen);
  const setReviewOpen = useAppStore((s) => s.setReviewOpen);
  const skin = useActiveSkin();

  useEffect(() => {
    if (sessionId && session?.id !== sessionId) void loadSession(sessionId, handId);
  }, [sessionId, handId, session?.id, loadSession]);

  const hand = hands[handIndex];
  const heroName = useMemo(() => {
    if (!hand) return undefined;
    if (focusPlayer && hand.players.some((p) => p.name === focusPlayer)) return focusPlayer;
    return hand.heroName;
  }, [hand, focusPlayer]);

  const replay = useMemo(() => (hand ? buildReplay(hand, heroName) : undefined), [hand, heroName]);

  const rows = useMemo<HandRow[]>(
    () =>
      hands.map((h) => {
        const hero = focusPlayer && h.players.some((p) => p.name === focusPlayer) ? focusPlayer : h.heroName;
        const meta = quickResult(h, hero);
        const position = hero ? computePositions(h)[hero] : undefined;
        return { hand: h, meta, position };
      }),
    [hands, focusPlayer],
  );

  // Publish frame count / jump targets to the store whenever the replay changes.
  useEffect(() => {
    if (!replay) return;
    const targets: Partial<Record<JumpTarget, number>> = {
      preflop: replay.streetStart.preflop,
      flop: replay.streetStart.flop,
      turn: replay.streetStart.turn,
      river: replay.streetStart.river,
      showdown: replay.streetStart.showdown,
      end: replay.streetStart.end,
      hero: replay.heroFirstAction,
    };
    setReplayMeta(replay.frames.length, targets);
  }, [replay, setReplayMeta]);

  // Keep the URL in sync with the selected hand.
  useEffect(() => {
    if (hand && sessionId && handId !== hand.id) navigate(`/replay/${sessionId}/${hand.id}`, { replace: true });
  }, [hand, sessionId, handId, navigate]);

  const goToHand = useCallback(
    (index: number) => {
      const target = hands[index];
      if (!target) return;
      const hero = focusPlayer && target.players.some((p) => p.name === focusPlayer) ? focusPlayer : target.heroName;
      let start = 0;
      if (settings.startAtHero && hero) {
        const r = buildReplay(target, hero);
        start = r.heroFirstAction ?? 0;
      }
      selectHand(index, start);
    },
    [hands, focusPlayer, settings.startAtHero, selectHand],
  );

  const onHandDelta = useCallback((delta: number) => goToHand(handIndex + delta), [goToHand, handIndex]);
  useReplayerKeyboard(!!replay, onHandDelta);

  // Playback timer.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => nextFrame(), 900 / settings.speed);
    return () => window.clearInterval(id);
  }, [playing, settings.speed, nextFrame]);

  const { fmt } = useAmountFormatter(hand);

  const onSeatClick = useCallback(
    (player: string) => {
      setFocus(focusPlayer === player ? undefined : player);
    },
    [focusPlayer, setFocus],
  );

  if (!session || !replay || !hand) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {hands.length === 0 && session ? t('table.noHands') : t('common.loading')}
      </div>
    );
  }

  const frame = replay.frames[Math.min(frameIndex, replay.frames.length - 1)];

  return (
    <div className="flex h-full">
      <Sidebar rows={rows} currentIndex={handIndex} skin={skin} heroName={heroName} fmt={fmt} onSelect={goToHand} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <TableArea replay={replay} frame={frame} heroName={heroName} onSeatClick={onSeatClick} />
          {reviewOpen ? (
            <ReviewPanel hand={hand} onClose={() => setReviewOpen(false)} />
          ) : (
            <button type="button" className="btn btn-ghost m-1 self-start" onClick={() => setReviewOpen(true)} title={t('header.review')}>
              ✎
            </button>
          )}
        </div>
        <Footer replay={replay} rows={rows} currentIndex={handIndex} fmt={fmt} onSelectHand={goToHand} />
      </div>
      <HelpModal />
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setImportModalOpen(false)} role="presentation">
          <div className="panel w-full max-w-3xl p-4 shadow-2xl" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center">
              <h2 className="font-semibold">{t('sidebar.loadHands')}</h2>
              <div className="flex-1" />
              <button type="button" className="btn btn-ghost" onClick={() => setImportModalOpen(false)} aria-label={t('common.close')}>
                ✕
              </button>
            </div>
            <ImportPanel
              compact
              onImported={(summaries) => {
                const first = summaries[0];
                if (first) {
                  setImportModalOpen(false);
                  navigate(`/replay/${first.session.id}`);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
