import { useTranslation } from 'react-i18next';
import { Section } from '@landing/components/Section';
import { ROOMS } from '@landing/data/rooms';
import { ROOM_MARKS } from '@landing/components/RoomLogos';

/**
 * Two rooms read today; the rest are on the way. The card says which is which
 * rather than leaving a visitor to find out after importing a file — a grid of
 * ten logos at equal weight would promise ten.
 */
export function Rooms() {
  const { t } = useTranslation();

  return (
    <Section id="rooms" title={t('rooms.title')} lead={t('rooms.lead')} tone="raised">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ROOMS.map((room) => {
          const Mark = ROOM_MARKS[room.id];
          return (
            <li
              key={room.id}
              className={`group relative flex flex-col items-center justify-center gap-4 rounded-xl border bg-black px-3 py-7 text-center transition-colors ${
                (room.status === 'available')
                  ? 'border-[color:var(--border-strong)] hover:border-white/40'
                  : 'border-line opacity-40 hover:opacity-60'
              }`}
            >
              <span
                className={`flex h-11 w-full items-center justify-center transition-colors ${
                  (room.status === 'available') ? 'text-white' : 'text-white/70'
                }`}
              >
                <Mark className="h-11 w-auto max-w-[86%]" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold leading-tight text-white">{room.name}</span>
                {room.network && <span className="text-[11px] leading-tight text-faint">{room.network}</span>}
                {room.status === 'available' ? (
                  <span className="mt-0.5 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-white">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                    {t('rooms.available')}
                  </span>
                ) : (
                  <span className="mt-0.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-faint">
                    {t('rooms.soon')}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-faint">{t('rooms.note')}</p>
    </Section>
  );
}
