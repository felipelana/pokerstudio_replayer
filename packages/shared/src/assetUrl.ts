/**
 * The address of an imported image, whichever bundler resolved it.
 *
 * Vite hands back a string. Next hands back an object carrying the same string
 * under `src`, plus the size it measured. Both front ends are built by both at
 * the moment, so the difference is absorbed here rather than spelled out at
 * every `<img>`.
 */
export function assetUrl(imported: string | { src: string }): string {
  return typeof imported === 'string' ? imported : imported.src;
}
