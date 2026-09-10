import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { shareApi, type CoachSession, type HandReading } from '@/infrastructure/http/shareApi';
import { ApiError } from '@/infrastructure/http/client';
import { LanguageSelector } from '@/ui/LanguageSelector';
import { IconCheck, IconEye, IconLogout } from '@/ui/icons';
import { useDateFormatter } from '@/ui/hooks/useFormat';
import { useAppStore } from '@/state/store';
import { buildReplay } from '@/engine/replay';
import { parseInWorker } from '@/parsers/importer';
import { TableArea } from '@/ui/replayer/TableArea';
import type { Session } from '@/model/types';
import brandMark from '@/assets/pokerstudio-mark.png';
import { assetUrl } from '@pokerstudio/shared';

/**
 * Everything a coach sees, and the boundary of it.
 *
 * The token arrives in the address; the password does not, and is asked for
 * here. What comes back is one review: its hands, replayed with the same
 * engine the player uses, and a place to write what the coach thinks of each
 * one. There is no library, no import, no other review and no other reading,
 * and the server refuses those routes to this cookie regardless of what is
 * drawn here.
 */
export function CoachPage() {
  const { t } = useTranslation();
  const df = useDateFormatter();
  const { token = '' } = useParams();
  const [session, setSession] = useState<CoachSession>();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);

  /** A cookie may still be live from an earlier visit on this browser. */
  const load = useCallback(async () => {
    try {
      setSession(await shareApi.session(token));
    } catch {
      setSession(undefined);
    } finally {
      setChecked(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await shareApi.open(token, password);
      setPassword('');
      await load();
    } catch (err) {
      // A token the server will not even look at means the address itself is
      // broken, which is a different thing to say than "wrong password".
      const problem = err instanceof ApiError ? err.problem : undefined;
      setError(problem ? (problem.status === 422 ? t('coach.badLink') : problem.title) : t('auth.offline'));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await shareApi.close().catch(() => undefined);
    useAppStore.getState().setHands(undefined, []);
    setSession(undefined);
  };

  if (!checked) {
    return (
      <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  /* ---------- the way in ---------- */
  if (!session) {
    return (
      <div className="auth-theme flex h-full items-center justify-center overflow-auto p-6">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex flex-col items-center gap-3">
            <img src={assetUrl(brandMark)} alt="PokerStudio Replayer" className="h-16 w-16 select-none" draggable={false} />
            <span className="text-lg font-semibold tracking-wide">
              PokerStudio <span style={{ color: 'var(--accent)' }}>Replayer</span>
            </span>
            <LanguageSelector />
          </div>
          <form className="panel flex flex-col gap-3 p-6" onSubmit={(e) => void open(e)}>
            <h1 className="text-xl font-semibold">{t('coach.title')}</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('coach.lead')}
            </p>
            <label className="flex flex-col gap-1 text-sm">
              {t('coach.password')}
              <input
                className="input font-mono tracking-wider"
                autoComplete="one-time-code"
                required
                maxLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary justify-center" disabled={busy || !password}>
              {busy ? t('auth.working') : t('coach.open')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ---------- the review ---------- */
  return (
    <div className="flex h-full flex-col">
      <header
        className="flex flex-wrap items-center gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <img src={assetUrl(brandMark)} alt="" aria-hidden="true" className="h-6 w-6 select-none" draggable={false} />
        <span className="text-sm font-semibold">
          PokerStudio <span style={{ color: 'var(--accent)' }}>Replayer</span>
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <IconEye size={12} />
          {t('coach.badge')}
        </span>
        <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
          {session.handIndex === null || session.handIndex === undefined
            ? t('coach.reviewing', { player: session.player, hands: session.session.handCount })
            : t('coach.reviewingHand', { player: session.player, number: session.handIndex + 1 })}
        </span>
        <div className="flex-1" />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('coach.expiresAt', { when: df.dateTime(new Date(session.expiresAt)) })}
        </span>
        <LanguageSelector />
        <button type="button" className="btn-icon" title={t('coach.leave')} aria-label={t('coach.leave')} onClick={() => void leave()}>
          <IconLogout size={15} />
        </button>
      </header>

      <CoachReview session={session} />
    </div>
  );
}

type LoadState = 'loading' | 'ready' | 'no-history' | 'failed';

/**
 * The hands, replayed, with the coach's reading beside them. The store holds
 * the parsed hands in memory only: nothing about the player's review is written
 * to this browser's database.
 */
function CoachReview({ session }: { session: CoachSession }) {
  const { t } = useTranslation();
  const hands = useAppStore((s) => s.hands);
  const handIndex = useAppStore((s) => s.handIndex);
  const frameIndex = useAppStore((s) => s.frameIndex);
  const setHands = useAppStore((s) => s.setHands);
  const selectHand = useAppStore((s) => s.selectHand);
  const setFrame = useAppStore((s) => s.setFrame);

  const [state, setState] = useState<LoadState>('loading');
  /** Review indices, in the order the hands were parsed. */
  const [indices, setIndices] = useState<number[]>([]);
  const [readings, setReadings] = useState<Record<number, HandReading>>({});
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [payload, mine] = await Promise.all([shareApi.hands(), shareApi.reading().catch(() => undefined)]);
        if (!alive) return;
        if (mine) {
          setCompleted(mine.assessment.status === 'COMPLETED');
          const seed: Record<number, HandReading> = {};
          for (const row of mine.rows) if (row.assessment) seed[row.index] = row.assessment;
          setReadings(seed);
        }
        if (!payload.stored || !payload.items.length) {
          setState('no-history');
          return;
        }
        const result = await parseInWorker(payload.items.map((item) => item.rawHistory).join('\n\n'));
        if (!alive) return;
        if (!result.hands.length) {
          setState('no-history');
          return;
        }
        const parsed: Session = {
          id: session.session.id,
          name: session.session.title,
          site: result.site,
          handIds: result.hands.map((hand) => hand.id),
          handCount: result.hands.length,
          importedAt: new Date(),
          players: [],
          warnings: result.warnings,
          sourceFileName: session.session.sourceFileName ?? undefined,
        };
        setIndices(payload.items.slice(0, result.hands.length).map((item) => item.index));
        setHands(parsed, result.hands);
        setState('ready');
      } catch {
        if (alive) setState('failed');
      }
    })();
    return () => {
      alive = false;
    };
  }, [session.session.id, session.session.title, session.session.sourceFileName, setHands]);

  const hand = hands[handIndex];
  const heroName = hand?.heroName;
  const replay = useMemo(() => (hand ? buildReplay(hand, heroName) : undefined), [hand, heroName]);
  const frame = replay?.frames[Math.min(frameIndex, replay.frames.length - 1)];
  const reviewIndex = indices[handIndex] ?? handIndex;
  const reading = readings[reviewIndex] ?? {};

  const save = async (patch: HandReading) => {
    const next = { ...reading, ...patch };
    setReadings((prev) => ({ ...prev, [reviewIndex]: next }));
    setSaving(true);
    try {
      await shareApi.saveHand(reviewIndex, next);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  if (state !== 'ready' || !replay || !frame || !hand) {
    return (
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[760px]">
          <h1 className="text-xl font-semibold">{session.session.title}</h1>
          <p className="mt-6 rounded-lg border border-dashed p-4 text-sm leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {t(state === 'failed' ? 'coach.loadFailed' : 'coach.noHistory')}
          </p>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {t('coach.privacyNote')}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* the hands */}
      {hands.length > 1 && (
      <nav
        className="max-h-28 shrink-0 overflow-auto border-b lg:max-h-none lg:w-52 lg:border-b-0 lg:border-r"
        style={{ borderColor: 'var(--border)' }}
      >
        <ul className="flex gap-1 p-2 lg:flex-col">
          {hands.map((h, i) => {
            const read = readings[indices[i] ?? i];
            const done = read?.markedOk || read?.comment || typeof read?.score === 'number';
            return (
              <li key={h.id}>
                <button
                  type="button"
                  className={`flex w-full shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                    i === handIndex ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]' : ''
                  }`}
                  onClick={() => selectHand(i)}
                >
                  <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {i + 1}
                  </span>
                  <span className="truncate">{h.handNumber}</span>
                  {done && <IconCheck size={12} />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      )}

      {/* the table */}
      <main className="flex min-h-[420px] min-w-0 shrink-0 flex-col lg:min-h-0 lg:flex-1 lg:shrink">
        <div className="min-h-0 flex-1">
          <TableArea replay={replay} frame={frame} heroName={heroName} onSeatClick={() => undefined} />
        </div>
        <div className="flex items-center justify-center gap-2 border-t p-2 text-xs" style={{ borderColor: 'var(--border)' }}>
          <button type="button" className="btn" onClick={() => selectHand(handIndex - 1)} disabled={handIndex === 0}>
            {t('coach.prevHand')}
          </button>
          <button type="button" className="btn" onClick={() => setFrame(Math.max(0, frameIndex - 1))} disabled={frameIndex === 0}>
            {t('coach.back')}
          </button>
          <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {Math.min(frameIndex, replay.frames.length - 1) + 1} / {replay.frames.length}
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => setFrame(Math.min(replay.frames.length - 1, frameIndex + 1))}
            disabled={frameIndex >= replay.frames.length - 1}
          >
            {t('coach.forward')}
          </button>
          <button type="button" className="btn" onClick={() => selectHand(handIndex + 1)} disabled={handIndex >= hands.length - 1}>
            {t('coach.nextHand')}
          </button>
        </div>
      </main>

      {/* what the coach thinks */}
      <aside className="shrink-0 border-t p-3 lg:w-80 lg:overflow-auto lg:border-l lg:border-t-0" style={{ borderColor: 'var(--border)' }}>
        <ReadingPanel
          key={reviewIndex}
          reading={reading}
          readOnly={completed}
          saving={saving}
          savedAt={savedAt}
          onSave={(patch) => void save(patch)}
        />
        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {completed ? t('coach.finished') : t('coach.finishNote')}
          </p>
          {!completed && (
            <button
              type="button"
              className="btn btn-primary mt-2 w-full justify-center"
              onClick={() => void shareApi.finish().then(() => setCompleted(true))}
            >
              {t('coach.finish')}
            </button>
          )}
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {t('coach.privacyNote')}
          </p>
        </div>
      </aside>
    </div>
  );
}

/** Score, the "played well" mark and the comment, for one hand. */
function ReadingPanel({
  reading,
  readOnly,
  saving,
  savedAt,
  onSave,
}: {
  reading: HandReading;
  readOnly: boolean;
  saving: boolean;
  savedAt: number;
  onSave(patch: HandReading): void;
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState(reading.comment ?? '');
  const [score, setScore] = useState(typeof reading.score === 'number' ? String(reading.score) : '');
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t('coach.yourReading')}</h2>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!reading.markedOk}
          disabled={readOnly}
          onChange={(e) => onSave({ markedOk: e.target.checked })}
        />
        {t('coach.playedWell')}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('coach.score')}
        <input
          className="input w-24"
          type="number"
          min={0}
          max={100}
          value={score}
          disabled={readOnly}
          onChange={(e) => setScore(e.target.value)}
          onBlur={() => onSave({ score: score === '' ? null : Math.max(0, Math.min(100, Number(score))) })}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('coach.comment')}
        <textarea
          className="input min-h-[140px] resize-y"
          maxLength={4000}
          value={comment}
          disabled={readOnly}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => onSave({ comment: comment.trim() ? comment : null })}
        />
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {comment.length} / 4000
        </span>
      </label>

      <p className="min-h-[1rem] text-[11px]" style={{ color: 'var(--text-muted)' }} aria-live="polite">
        {saving ? t('coach.saving') : savedAt ? t('coach.saved') : ''}
      </p>
    </div>
  );
}
