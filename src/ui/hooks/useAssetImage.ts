import { useEffect, useState } from 'react';
import { getRepository } from '@/db/repository';

/**
 * Loads an uploaded image (felt watermark, corner logo) out of IndexedDB and
 * hands back a decoded <img>. The object URL lives as long as the element, so
 * the same result works both as an SVG `href` and as a canvas draw source.
 */
export function useAssetImage(assetId?: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement>();

  useEffect(() => {
    if (!assetId) {
      setImage(undefined);
      return;
    }
    let url: string | undefined;
    let cancelled = false;
    void (async () => {
      const blob = await getRepository().getAsset(assetId);
      if (!blob || cancelled) return;
      url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setImage(img);
      };
      img.src = url;
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setImage(undefined);
    };
  }, [assetId]);

  return image;
}
