export type TableShapeName = 'ellipse' | 'oval' | 'rounded-rect' | 'racetrack';

export const TABLE_SHAPES: TableShapeName[] = ['ellipse', 'oval', 'rounded-rect', 'racetrack'];

/**
 * Outline of the table, sampled as points on the given radii (R20).
 * One generator feeds both renderers, so a shape change moves the felt, the
 * rail, the bevel and the seat ring together.
 */
export function shapePoints(
  shape: TableShapeName,
  rx: number,
  ry: number,
  steps = 128,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push(pointAt(shape, rx, ry, t));
  }
  return pts;
}

function pointAt(shape: TableShapeName, rx: number, ry: number, t: number): [number, number] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  switch (shape) {
    case 'ellipse':
      return [rx * c, ry * s];
    case 'oval': {
      // Superellipse: flatter long sides, still fully rounded ends.
      const n = 2.7;
      const p = 2 / n;
      return [rx * Math.sign(c) * Math.abs(c) ** p, ry * Math.sign(s) * Math.abs(s) ** p];
    }
    case 'rounded-rect':
      return squircle(rx, ry, t, Math.min(rx, ry) * 0.45);
    case 'racetrack':
      return squircle(rx, ry, t, ry);
  }
}

/** Rectangle of half-size (rx, ry) with corner radius `r`, sampled by angle. */
function squircle(rx: number, ry: number, t: number, r: number): [number, number] {
  const radius = Math.min(r, rx, ry);
  const ax = rx - radius;
  const ay = ry - radius;
  // Ray from the centre against the rounded rectangle: march the parameter.
  const dx = Math.cos(t);
  const dy = Math.sin(t);
  // Straight edges first.
  const tx = dx !== 0 ? rx / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? ry / Math.abs(dy) : Infinity;
  let k = Math.min(tx, ty);
  let x = dx * k;
  let y = dy * k;
  // Inside a corner region: solve against the corner circle instead.
  if (Math.abs(x) > ax && Math.abs(y) > ay) {
    const cx = Math.sign(x) * ax;
    const cy = Math.sign(y) * ay;
    // |(dx,dy)*k - (cx,cy)| = radius
    const b = -2 * (dx * cx + dy * cy);
    const cc = cx * cx + cy * cy - radius * radius;
    const disc = Math.max(0, b * b - 4 * cc);
    k = (-b + Math.sqrt(disc)) / 2;
    x = dx * k;
    y = dy * k;
  }
  return [x, y];
}

/** SVG path for a shape, centred on (cx, cy). */
export function shapeSvgPath(
  shape: TableShapeName,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  steps = 128,
): string {
  const pts = shapePoints(shape, rx, ry, steps);
  return (
    pts
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(cx + x).toFixed(2)} ${(cy + y).toFixed(2)}`)
      .join(' ') + ' Z'
  );
}
