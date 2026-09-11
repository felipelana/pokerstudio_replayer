import { useEffect, useState } from 'react';
import { getRepository } from '@/lib/db/repository';
import { BUILTIN_ASSETS, isBuiltinAsset } from '@/lib/skins/builtinAssets';

/**
 * Turns the black background of a logo exported without alpha into real
 * transparency: alpha becomes the pixel's brightness, colours are kept. Doing
 * it once here means the renderers composite normally, with no blend modes
 * that would wash out whatever is drawn on top.
 */
function keyOutBlack(source: HTMLImageElement): HTMLImageElement {
  const c = document.createElement('canvas');
  c.width = source.naturalWidth;
  c.height = source.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, c.width, c.height);
  } catch {
    return source; // tainted canvas (remote image) — leave it as it is
  }
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const brightness = Math.max(d[i], d[i + 1], d[i + 2]);
    d[i + 3] = Math.min(255, Math.round(brightness * 1.15));
  }
  ctx.putImageData(data, 0, 0);
  const out = new Image();
  out.src = c.toDataURL('image/png');
  return out;
}

/**
 * Loads an uploaded or bundled image (felt watermark, corner logo) and hands
 * back a decoded <img>, usable both as an SVG `href` and as a canvas source.
 * `keyBlack` drops a black backdrop so the logo can sit on any felt.
 */
export function useAssetImage(assetId?: string, keyBlack = false): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement>();

  useEffect(() => {
    if (!assetId) {
      setImage(undefined);
      return;
    }
    let url: string | undefined;
    let cancelled = false;

    const publish = (img: HTMLImageElement) => {
      if (cancelled) return;
      if (!keyBlack) {
        setImage(img);
        return;
      }
      const keyed = keyOutBlack(img);
      if (keyed === img) setImage(img);
      else keyed.onload = () => !cancelled && setImage(keyed);
    };

    void (async () => {
      // Shipped images resolve to a bundled URL; uploads come from IndexedDB.
      const src = isBuiltinAsset(assetId)
        ? BUILTIN_ASSETS[assetId]
        : await (async () => {
            const blob = await getRepository().getAsset(assetId);
            if (!blob) return undefined;
            url = URL.createObjectURL(blob);
            return url;
          })();
      if (!src || cancelled) return;
      const img = new Image();
      img.onload = () => publish(img);
      img.src = src;
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setImage(undefined);
    };
  }, [assetId, keyBlack]);

  return image;
}
