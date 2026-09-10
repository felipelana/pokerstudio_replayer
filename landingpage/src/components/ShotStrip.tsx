import { useTranslation } from 'react-i18next';
import { SHOTS, type Shot } from '@landing/assets/shots';

/** Corners of the real interface, under the carousel: filters, display
 *  controls, the deck preview and the language menu. */
const STRIP: { shot: Shot; altKey: string }[] = [
  { shot: SHOTS.filters, altKey: 'alt.filters' },
  { shot: SHOTS.displayPanel, altKey: 'alt.displayPanel' },
  { shot: SHOTS.deck, altKey: 'alt.deck' },
  { shot: SHOTS.languages, altKey: 'alt.languages' },
];

export function ShotStrip() {
  const { t } = useTranslation();

  return (
    <div className="mt-8">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STRIP.map(({ shot, altKey }) => (
          <li
            key={altKey}
            className="flex h-[200px] items-center justify-center overflow-hidden rounded-xl border border-line bg-bg-2 p-3"
          >
            <img
              src={shot.src}
              width={shot.width}
              height={shot.height}
              alt={t(altKey)}
              loading="lazy"
              decoding="async"
              className="max-h-full w-auto max-w-full rounded-md object-contain"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
