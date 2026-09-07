import { lazy, Suspense } from 'react';
import type { RendererChoice } from '@/state/store';
import { CornerLogo } from './CornerLogo';
import { TableBackground } from './TableBackground';
import { hasWebGL, type TableRendererProps } from './TableRenderer';
import { SvgTableRenderer } from './svg/SvgTableRenderer';

const ThreeTableRenderer = lazy(() =>
  import('./three/ThreeTableRenderer').then((m) => ({ default: m.ThreeTableRenderer })),
);

/**
 * Picks the table renderer from the user's preference, falling back to SVG when
 * WebGL is unavailable or while the 3D bundle loads. Everything that draws a
 * table (replayer, skin editor) goes through here, so the preview and the real
 * table are always the same surface.
 */
export function TableSurface({
  renderer,
  ...props
}: TableRendererProps & { renderer: RendererChoice }) {
  const useThree = renderer === 'three' || (renderer === 'auto' && hasWebGL());
  return (
    <div className="relative h-full w-full">
      <TableBackground ui={props.skin.ui} />
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        {useThree ? (
          <Suspense fallback={<SvgTableRenderer {...props} />}>
            <ThreeTableRenderer {...props} />
          </Suspense>
        ) : (
          <SvgTableRenderer {...props} />
        )}
      </div>
      <CornerLogo ui={props.skin.ui} />
    </div>
  );
}
