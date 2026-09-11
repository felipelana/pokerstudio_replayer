import type { CSSProperties } from 'react';
import type { BackgroundSkin, UiSkin } from '@/lib/skins/types';
import { useAssetImage } from '@/components/hooks/useAssetImage';

/** CSS for the gradient mode, shared by the app and the skin editor preview. */
export function gradientCss(g: NonNullable<BackgroundSkin['gradient']>): string {
  const stops = [...g.stops]
    .sort((a, b) => a.at - b.at)
    .map((s) => `${s.color} ${Math.round(s.at * 100)}%`)
    .join(', ');
  return g.type === 'radial'
    ? `radial-gradient(circle at 50% 45%, ${stops})`
    : `linear-gradient(${g.angle}deg, ${stops})`;
}

const FIT: Record<string, CSSProperties> = {
  cover: { backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' },
  contain: {
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  },
  repeat: { backgroundRepeat: 'repeat' },
  center: { backgroundSize: 'auto', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' },
};

/**
 * Backdrop behind the table (R15): solid colour, gradient or image. It sits
 * below everything — table, felt glow, cards, chips and text — and never takes
 * pointer events, so it cannot interfere with the replayer.
 */
export function TableBackground({ ui }: { ui: UiSkin }) {
  const bg = ui.background;
  const image = useAssetImage(bg?.mode === 'image' ? bg.imageAssetId : undefined);

  if (!bg) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${ui.bg}, ${ui.bgEnd})`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ pointerEvents: 'none', zIndex: 0 }}
    >
      <div className="absolute inset-0" style={{ background: bg.color }} />
      {bg.mode === 'gradient' && bg.gradient && (
        <div className="absolute inset-0" style={{ background: gradientCss(bg.gradient) }} />
      )}
      {bg.mode === 'image' && image && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${image.src})`,
            opacity: bg.imageOpacity ?? 1,
            filter: bg.blur ? `blur(${bg.blur}px)` : undefined,
            ...FIT[bg.imageFit ?? 'cover'],
          }}
        />
      )}
    </div>
  );
}
