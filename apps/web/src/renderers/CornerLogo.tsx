import type { CSSProperties } from 'react';
import type { UiSkin } from '@/skins/types';
import { useAssetImage } from '@/ui/hooks/useAssetImage';

const CORNERS: Record<string, CSSProperties> = {
  'top-left': { top: 12, left: 12 },
  'top-right': { top: 12, right: 12 },
  'bottom-left': { bottom: 12, left: 12 },
  'bottom-right': { bottom: 12, right: 12 },
};

/** Skin logo pinned to one corner of the table area (both renderers). */
export function CornerLogo({ ui }: { ui: UiSkin }) {
  const image = useAssetImage(ui.logoAssetId);
  const corner = ui.logoCorner ?? 'none';
  if (!image || corner === 'none') return null;
  return (
    <img
      src={image.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: 'absolute',
        height: ui.logoSize ?? 44,
        width: 'auto',
        opacity: ui.logoOpacity ?? 0.85,
        pointerEvents: 'none',
        zIndex: 6,
        ...CORNERS[corner],
      }}
    />
  );
}
