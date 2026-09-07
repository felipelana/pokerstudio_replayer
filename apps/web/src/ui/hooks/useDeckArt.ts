import { useEffect, useState } from 'react';
import { getRepository } from '@/db/repository';
import type { DeckSkin } from '@/skins/types';

/**
 * Loads the artwork a skin sets per rank. Cards without their own art keep the
 * drawn face, so a deck can be customised one card at a time.
 */
export function useDeckArt(deck: DeckSkin): Record<string, HTMLImageElement> {
  const [art, setArt] = useState<Record<string, HTMLImageElement>>({});
  const ids = JSON.stringify(deck.rankImages ?? {});

  useEffect(() => {
    const entries = Object.entries(JSON.parse(ids) as Record<string, string>);
    if (entries.length === 0) {
      setArt({});
      return;
    }

    let alive = true;
    const urls: string[] = [];

    void (async () => {
      const loaded: Record<string, HTMLImageElement> = {};
      for (const [rank, assetId] of entries) {
        const blob = await getRepository().getAsset(assetId);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          loaded[rank] = image;
        } catch {
          // A file that will not decode simply leaves that card drawn.
        }
      }
      if (alive) setArt(loaded);
    })();

    return () => {
      alive = false;
      // The images stay alive as long as the elements reference them, so the
      // URLs are only released once this deck is replaced.
      window.setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 10_000);
    };
  }, [ids]);

  return art;
}
