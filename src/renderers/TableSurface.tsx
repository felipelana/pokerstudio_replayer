import { lazy, Suspense } from 'react';
import type { RendererChoice } from '@/state/store';
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
  if (!useThree) return <SvgTableRenderer {...props} />;
  return (
    <Suspense fallback={<SvgTableRenderer {...props} />}>
      <ThreeTableRenderer {...props} />
    </Suspense>
  );
}
