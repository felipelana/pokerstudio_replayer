import pokerStudioLogo from '@/assets/pokerstudio-logo.png';
import pokerStudioMark from '@/assets/pokerstudio-mark.png';
import { assetUrl } from '@pokerstudio/shared';

/**
 * Images shipped with the app. Skins reference them through the same
 * `logoAssetId` field used for user uploads, with a `builtin:` prefix, so the
 * admin UI, export/import and the renderers need no special case.
 */
export const BUILTIN_ASSET_PREFIX = 'builtin:';

export const BUILTIN_ASSETS: Record<string, string> = {
  'builtin:pokerstudio': assetUrl(pokerStudioLogo),
  'builtin:pokerstudio-mark': assetUrl(pokerStudioMark),
};

export function isBuiltinAsset(id?: string): boolean {
  return !!id && id.startsWith(BUILTIN_ASSET_PREFIX);
}
