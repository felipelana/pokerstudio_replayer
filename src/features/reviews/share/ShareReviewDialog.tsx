import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { suggestCoachPassword, validateCoachPassword } from '@pokerstudio/shared';
import {
  coachLink,
  shareApi,
  type CoachAssessment,
  type Invite,
  type NewInvite,
} from '@/lib/infrastructure/http/shareApi';
import { ApiError } from '@/lib/infrastructure/http/client';
import {
  IconCheck,
  IconClose,
  IconCopy,
  IconEye,
  IconRefresh,
  IconTrash,
} from '@/components/ui/icons';
import { useDateFormatter } from '@/components/hooks/useFormat';

/** A password drawn from the browser's own randomness, not from Math.random. */
function freshPassword(): string {
  return suggestCoachPassword((max) => {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  });
}

/** An input the caller can fill from the clipboard, with a copy button beside it. */
function CopyField({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // A browser that refuses the clipboard still shows the value to select.
    }
  };

  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <span className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={`input flex-1 ${secret ? 'font-mono tracking-wider' : ''}`}
        />
        <button type="button" className="btn" onClick={() => void copy()} title={t('share.copy')}>
          <IconCopy size={14} />
          {copied ? t('common.copied') : t('share.copy')}
        </button>
      </span>
    </label>
  );
}

/**
 * Handing one review to one coach: a link, a password, and a deadline.
 *
 * The password is shown here once and never again. It is not in the link, so
 * the two travel separately and a forwarded link on its own opens nothing.
 */
export function ShareReviewDialog({
  reviewId,
  reviewTitle,
  hand,
  onSaveToAccount,
  open,
  onClose,
}: {
  reviewId: string;
  reviewTitle: string;
  /**
   * The hand on screen, when the dialog is opened from the replayer. Its
   * presence is what makes sharing a single hand possible at all.
   */
  hand?: { index: number; label: string };
  /**
   * How to put this review on the account, when it is not there yet. A link
   * points at a review the server holds, so there is nothing to share until it
   * has been sent. Given here, the dialog offers to do it rather than refusing.
   */
  onSaveToAccount?: () => Promise<void>;
  open: boolean;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const df = useDateFormatter();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [limits, setLimits] = useState({ defaultHours: 24, maxHours: 168 });
  const [invites, setInvites] = useState<Invite[]>([]);
  const [coachName, setCoachName] = useState('');
  const [password, setPassword] = useState(freshPassword);
  const [hours, setHours] = useState(24);
  const [scope, setScope] = useState<'review' | 'hand'>('review');
  const [onAccount, setOnAccount] = useState(true);
  // Only whether there is a hand matters here, and a fresh object on every
  // render would restart this effect for no reason.
  const hasHand = !!hand;
  const [created, setCreated] = useState<NewInvite | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<{ id: string; assessmentId: string; coachName: string }>();

  const reload = useCallback(async () => {
    const settings = await shareApi.settings();
    setLimits(settings);
    setHours((h) => (h === 24 ? settings.defaultHours : h));
    try {
      const list = await shareApi.list(reviewId);
      setInvites(list.items);
      setOnAccount(true);
    } catch (err) {
      // The review is not on the account yet, which is a thing to offer to fix,
      // not an error to report.
      if (err instanceof ApiError && err.problem.status === 404) {
        setInvites([]);
        setOnAccount(false);
        return;
      }
      throw err;
    }
  }, [reviewId]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    setError('');
    setCreated(undefined);
    // Opened over a hand, the offer starts on that hand: it is what the reader
    // was looking at when they reached for the button.
    setScope(hasHand ? 'hand' : 'review');
    void reload().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, reload, hasHand]);

  if (!open) return null;

  const problems = validateCoachPassword(password);
  const canCreate = coachName.trim().length > 0 && problems.length === 0 && !busy && onAccount;

  const sendToAccount = async () => {
    if (!onSaveToAccount) return;
    setBusy(true);
    setError('');
    try {
      await onSaveToAccount();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
      const invite = await shareApi.create(reviewId, {
        coachName: coachName.trim(),
        password,
        expiresAt,
        handIndex: scope === 'hand' && hand ? hand.index : undefined,
      });
      setCreated(invite);
      setCoachName('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (invite: Invite) => {
    setBusy(true);
    try {
      await shareApi.revoke(invite.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy(false);
    }
  };

  const stateOf = (invite: Invite) => {
    if (invite.revokedAt) return { label: t('share.stateRevoked'), color: 'var(--result-lost)' };
    if (new Date(invite.expiresAt) <= new Date())
      return { label: t('share.stateExpired'), color: 'var(--text-muted)' };
    if (invite.assessment?.completedAt)
      return { label: t('share.stateDone'), color: 'var(--result-won)' };
    if (invite.assessment)
      return { label: t('share.stateReading'), color: 'var(--result-break-even)' };
    return { label: t('share.stateWaiting'), color: 'var(--text-muted)' };
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('share.title')}
        className="panel flex max-h-[85vh] w-full max-w-[640px] flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pb-2 pt-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{t('share.title')}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('share.subtitle', { review: reviewTitle })}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <IconClose size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {created ? (
            <section className="flex flex-col gap-3">
              <p className="text-sm" style={{ color: 'var(--result-won)' }}>
                {t('share.created', { coach: created.coachName })}
              </p>
              <CopyField label={t('share.link')} value={coachLink(created.token)} />
              <CopyField label={t('share.password')} value={password} secret />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t('share.passwordOnce')}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {created.handIndex === null || created.handIndex === undefined
                  ? t('share.readOnlyNote')
                  : t('share.readOnlyNoteHand')}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setCreated(undefined);
                    setPassword(freshPassword());
                  }}
                >
                  {t('share.another')}
                </button>
                <button type="button" className="btn btn-primary" onClick={onClose}>
                  {t('common.close')}
                </button>
              </div>
            </section>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              {!onAccount && (
                <div
                  className="rounded-lg border border-dashed p-3 text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <p style={{ color: 'var(--text-muted)' }}>{t('share.notOnAccount')}</p>
                  {onSaveToAccount && (
                    <button
                      type="button"
                      className="btn btn-primary mt-2"
                      disabled={busy}
                      onClick={() => void sendToAccount()}
                    >
                      {busy ? t('auth.working') : t('share.sendToAccount')}
                    </button>
                  )}
                </div>
              )}

              {hand && (
                <fieldset className="flex flex-col gap-1 text-sm">
                  <legend className="mb-1">{t('share.scope')}</legend>
                  <label className="checkbox">
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === 'hand'}
                      onChange={() => setScope('hand')}
                    />
                    {t('share.scopeHand', { hand: hand.label })}
                  </label>
                  <label className="checkbox">
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === 'review'}
                      onChange={() => setScope('review')}
                    />
                    {t('share.scopeReview')}
                  </label>
                </fieldset>
              )}

              <label className="flex flex-col gap-1 text-sm">
                {t('share.coachName')}
                <input
                  className="input"
                  required
                  maxLength={80}
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  placeholder={t('share.coachNameHint')}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                {t('share.password')}
                <span className="flex gap-2">
                  <input
                    className="input flex-1 font-mono tracking-wider"
                    value={password}
                    maxLength={8}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPassword(freshPassword())}
                    title={t('share.newPassword')}
                  >
                    <IconRefresh size={14} />
                    {t('share.newPassword')}
                  </button>
                </span>
                <span
                  className="text-xs leading-relaxed"
                  style={{ color: problems.length ? 'var(--result-lost)' : 'var(--text-muted)' }}
                >
                  {problems.length ? problems.join(' ') : t('share.passwordRule')}
                </span>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                {t('share.expiry')}
                <select
                  className="input"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                >
                  {[6, 12, 24, 48, 72, 168]
                    .filter((h) => h <= limits.maxHours)
                    .map((h) => (
                      <option key={h} value={h}>
                        {t('share.hours', { count: h })}
                      </option>
                    ))}
                </select>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('share.expiryNote', {
                    when: df.dateTime(new Date(Date.now() + hours * 3600_000)),
                    max: limits.maxHours,
                  })}
                </span>
              </label>

              {error && (
                <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" className="btn" onClick={onClose}>
                  {t('common.close')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={!canCreate}>
                  {busy ? t('auth.working') : t('share.create')}
                </button>
              </div>
            </form>
          )}

          {invites.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">{t('share.existing')}</h3>
              <ul className="flex flex-col gap-1">
                {invites.map((invite) => {
                  const state = stateOf(invite);
                  const live = !invite.revokedAt && new Date(invite.expiresAt) > new Date();
                  return (
                    <li key={invite.id} className="flex items-center gap-2 text-xs">
                      <span className="min-w-[120px] truncate font-semibold">
                        {invite.coachName}
                      </span>
                      {invite.handIndex !== null && invite.handIndex !== undefined && (
                        <span
                          className="shrink-0 rounded-full border px-1.5 text-[10px]"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                          {t('share.oneHand', { number: invite.handIndex + 1 })}
                        </span>
                      )}
                      <span className="shrink-0" style={{ color: state.color }}>
                        {state.label}
                      </span>
                      <span
                        className="ml-auto shrink-0 tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {df.dateTime(new Date(invite.expiresAt))}
                      </span>
                      {invite.assessment && (
                        <button
                          type="button"
                          className="btn-icon !px-1.5"
                          title={t('share.readFeedback')}
                          aria-label={`${t('share.readFeedback')}: ${invite.coachName}`}
                          onClick={() =>
                            setReading(
                              reading?.id === invite.id
                                ? undefined
                                : {
                                    id: invite.id,
                                    assessmentId: invite.assessment!.id,
                                    coachName: invite.coachName,
                                  },
                            )
                          }
                        >
                          <IconEye size={13} />
                        </button>
                      )}
                      {live && (
                        <button
                          type="button"
                          className="btn-icon !px-1.5"
                          title={t('share.revoke')}
                          aria-label={`${t('share.revoke')}: ${invite.coachName}`}
                          disabled={busy}
                          onClick={() => void revoke(invite)}
                        >
                          <IconTrash size={13} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {reading && (
                <CoachFeedback assessmentId={reading.assessmentId} coachName={reading.coachName} />
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * What one coach wrote, as the player sees it: only the hands the coach
 * actually touched, in the order they were played.
 */
function CoachFeedback({ assessmentId, coachName }: { assessmentId: string; coachName: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<CoachAssessment>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    shareApi
      .readingOf(assessmentId)
      .then((value) => alive && setData(value))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [assessmentId]);

  if (failed)
    return (
      <p className="mt-3 text-xs" style={{ color: 'var(--result-lost)' }}>
        {t('auth.offline')}
      </p>
    );
  if (!data)
    return (
      <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </p>
    );

  const written = data.rows.filter(
    (row) =>
      row.assessment &&
      (row.assessment.comment ||
        typeof row.assessment.score === 'number' ||
        row.assessment.markedOk),
  );

  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
      <p className="mb-2 text-xs font-semibold">{t('share.feedbackFrom', { coach: coachName })}</p>
      {written.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('share.feedbackEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {written.map((row) => (
            <li key={row.index} className="text-xs">
              <span className="font-semibold">
                {t('share.handNumber', { number: row.index + 1 })}
              </span>
              {typeof row.assessment?.score === 'number' && (
                <span className="ml-2 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {row.assessment.score}/100
                </span>
              )}
              {row.assessment?.markedOk && <IconCheck size={12} />}
              {row.assessment?.comment && (
                <p
                  className="mt-0.5 whitespace-pre-wrap leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {row.assessment.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
