import type { CardCode } from '@/model/cards';
import type { DeckSkin } from '@/skins/types';
import { CARD_H, CARD_W, cardPrimitives, glossStops, patternShapes } from './primitives';

const cache = new Map<string, HTMLCanvasElement>();

function deckKey(deck: DeckSkin): string {
  return JSON.stringify(deck);
}

/**
 * Draw a card into a canvas using the same primitives as the SVG component.
 * Cached by (card, deck). Used as a Three.js texture.
 */
export function cardCanvas(card: CardCode | 'back', deck: DeckSkin, scale = 4, art?: HTMLImageElement): HTMLCanvasElement {
  // The back is never replaced by artwork — a marked deck would be worse than
  // a plain one.
  const face = card === 'back' ? undefined : art;
  const key = `${card}|${scale}|${face?.src ?? ''}|${deckKey(deck)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W * scale;
  canvas.height = CARD_H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, CARD_W, CARD_H);

  const prims = cardPrimitives(card, deck, !!face);
  const [background, ...rest] = prims;
  if (background?.kind === 'rect') {
    ctx.beginPath();
    ctx.roundRect(background.x, background.y, background.w, background.h, background.rx);
    ctx.fillStyle = background.fill;
    ctx.fill();
    if (background.stroke) {
      ctx.strokeStyle = background.stroke;
      ctx.lineWidth = background.strokeWidth ?? 1;
      ctx.stroke();
    }
    ctx.save();
    ctx.clip();
  }
  if (face) {
    // Behind the indices, inside the same margin the SVG card uses.
    const inset = 8;
    const boxW = CARD_W - inset * 2;
    const boxH = CARD_H - inset * 2;
    const ratio = Math.min(boxW / face.naturalWidth, boxH / face.naturalHeight) || 1;
    const w = face.naturalWidth * ratio;
    const h = face.naturalHeight * ratio;
    ctx.drawImage(face, inset + (boxW - w) / 2, inset + (boxH - h) / 2, w, h);
  }

  for (const p of (background?.kind === 'rect' ? rest : prims)) {
    switch (p.kind) {
      case 'rect': {
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, p.rx);
        ctx.fillStyle = p.fill;
        ctx.fill();
        if (p.stroke) {
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = p.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      }
      case 'text': {
        ctx.font = `${p.weight} ${p.size}px ${p.font}`;
        ctx.fillStyle = p.fill;
        ctx.textAlign = p.anchor === 'middle' ? 'center' : p.anchor === 'end' ? 'right' : 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(p.text, p.x, p.y);
        break;
      }
      case 'path': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.scale, p.scale);
        ctx.fillStyle = p.fill;
        ctx.fill(new Path2D(p.d));
        ctx.restore();
        break;
      }
      case 'gloss': {
        const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
        for (const s of glossStops(p.strength)) g.addColorStop(s.offset, `rgba(255,255,255,${s.alpha})`);
        ctx.beginPath();
        ctx.roundRect(0, 0, CARD_W, CARD_H, p.rx);
        ctx.fillStyle = g;
        ctx.fill();
        break;
      }
      case 'pattern': {
        ctx.fillStyle = p.ink;
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = 0.8;
        for (const s of patternShapes(p.pattern, p.inset)) {
          if (s.kind === 'circle') {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.w, 0, Math.PI * 2);
            ctx.fill();
          } else if (s.kind === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y - s.h / 2);
            ctx.lineTo(s.x + s.w / 2, s.y);
            ctx.lineTo(s.x, s.y + s.h / 2);
            ctx.lineTo(s.x - s.w / 2, s.y);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x + s.w, s.y + s.h);
            ctx.stroke();
          }
        }
        break;
      }
    }
  }
  if (background?.kind === 'rect') ctx.restore();
  cache.set(key, canvas);
  return canvas;
}

export function clearCardTextureCache() {
  cache.clear();
}
