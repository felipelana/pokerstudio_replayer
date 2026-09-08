import { useTranslation } from 'react-i18next';
import { Section } from '@/components/Section';
import { ROOMS } from '@/data/rooms';
import { ROOM_MARKS } from '@/components/RoomLogos';

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
              className="group flex flex-col items-center justify-center gap-4 rounded-xl border border-line bg-black px-3 py-7 text-center transition-colors hover:border-[color:var(--border-strong)]"
            >
              <span className="flex h-11 w-full items-center justify-center text-white/85 transition-colors group-hover:text-white">
                <Mark className="h-11 w-auto max-w-[86%]" />
              </span>
              <span className="text-sm font-semibold leading-tight text-white">{room.name}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-faint">{t('rooms.note')}</p>
    </Section>
  );
}
