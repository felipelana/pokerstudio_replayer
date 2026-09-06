import { lazy, Suspense } from 'react';
import type { RendererChoice } from '@/state/store';
import { CornerLogo } from './CornerLogo';
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
export function TableSurface({ renderer, ...props }: TableRendererProps & { renderer: RendererChoice }) {
  const useThree = renderer === 'three' || (renderer === 'auto' && hasWebGL());
  return (
    <div className="relative h-full w-full">
      {useThree ? (
        <Suspense fallback={<SvgTableRenderer {...props} />}>
          <ThreeTableRenderer {...props} />
        </Suspense>
      ) : (
        <SvgTableRenderer {...props} />
      )}
      <CornerLogo ui={props.skin.ui} />
    </div>
  );
}
