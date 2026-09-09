import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROOMS, type Room } from '@pokerstudio/shared';
import { accountApi, type RoomNick } from '@/infrastructure/http/accountApi';
import { ApiError } from '@/infrastructure/http/client';
import { useAuthStore } from '@/state/authStore';

/**
 * The key a nickname is filed under. Rooms with a parser keep that parser's
 * key, which is what the replayer looks up and what older rows already use;
 * the rest are filed under their catalogue id.
 */
function keyOf(room: Room): string {
  return room.site ?? room.id;
}

/** Rooms that can be read come first: those are the ones a nickname acts on today. */
const LISTED = [...ROOMS].sort((a, b) => (a.status === b.status ? 0 : a.status === 'available' ? -1 : 1));

/**
 * The screen names the reader plays under, one per room. Optional — but once
 * given, a hand history from any of these rooms can be tied back to them, which
 * is what lets the replayer know which seat is theirs.
 *
 * It lives on the account, not in this browser: the same nicknames follow the
 * reader to another machine.
 */
export function RoomNicks() {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.phase === 'authenticated');
  const [nicks, setNicks] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    void accountApi
      .roomNicks()
      .then((r) => {
        if (!alive) return;
        setNicks(Object.fromEntries(r.items.map((n: RoomNick) => [n.room, n.nickname])));
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [signedIn]);

  if (!signedIn) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('settings.roomNicksSignedOut')}
      </p>
    );
  }

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const items = Object.entries(nicks)
        .map(([room, nickname]) => ({ room, nickname: nickname.trim() }))
        .filter((n) => n.nickname);
      await accountApi.saveRoomNicks(items);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : t('auth.offline'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('settings.roomNicksHint')}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('settings.roomNicksSoonHint')}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {LISTED.map((room) => {
          const key = keyOf(room);
          return (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span>{room.name}</span>
                {room.status === 'coming-soon' && (
                  <span
                    className="rounded-full border px-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    {t('settings.comingSoon')}
                  </span>
                )}
                {room.network && (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {room.network}
                  </span>
                )}
              </span>
              <input
                className="input"
                maxLength={60}
                placeholder={t('settings.roomNickPlaceholder')}
                value={nicks[key] ?? ''}
                disabled={!loaded}
                onChange={(e) => {
                  setSaved(false);
                  setNicks((n) => ({ ...n, [key]: e.target.value }));
                }}
              />
            </label>
          );
        })}
      </div>

      {error && (
        <p className="text-sm" role="alert" style={{ color: 'var(--result-lost)' }}>
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-sm" role="status" style={{ color: 'var(--result-won)' }}>
          {t('settings.roomNicksSaved')}
        </p>
      )}

      <div>
        <button type="button" className="btn btn-primary" disabled={busy || !loaded} onClick={() => void save()}>
          {busy ? t('auth.working') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
