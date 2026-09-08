import type { Shot as ShotAsset } from '@/assets/shots';

interface ShotProps {
  shot: ShotAsset;
  alt: string;
  /** The hero image is the only one that must not wait to be scrolled to. */
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  /** Shows only the top of a tall crop, so a column shot does not dominate. */
  crop?: boolean;
}

/**
 * A framed capture. Width and height are always set from the file's real size,
 * so the browser reserves the right box before the bytes arrive and the layout
 * never jumps.
 */
export function Shot({
  shot,
  alt,
  priority = false,
  className = '',
  imgClassName = '',
  crop = false,
}: ShotProps) {
  return (
    <figure className={['shot-frame m-0', crop ? 'relative' : '', className].join(' ')}>
      <img
        src={shot.src}
        width={shot.width}
        height={shot.height}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        className={['block h-auto w-full', imgClassName].join(' ')}
      />
    </figure>
  );
}
