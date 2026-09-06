import { describe, expect, it } from 'vitest';
import { CHIP_DENOMINATIONS } from './types';
import { BUILT_IN_SKINS, DECK_PRESETS, SKIN_GG } from './presets';

const isColor = (v: string) => /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\(/.test(v);

describe('built-in skins', () => {
  it('have unique ids and names', () => {
    expect(new Set(BUILT_IN_SKINS.map((s) => s.id)).size).toBe(BUILT_IN_SKINS.length);
    expect(new Set(BUILT_IN_SKINS.map((s) => s.name)).size).toBe(BUILT_IN_SKINS.length);
  });

  it('define every colour token and a chip colour per denomination', () => {
    for (const skin of BUILT_IN_SKINS) {
      for (const [k, v] of Object.entries(skin.ui)) expect(isColor(v), `${skin.id}.ui.${k}`).toBe(true);
      for (const [k, v] of Object.entries(skin.plates)) expect(isColor(v), `${skin.id}.plates.${k}`).toBe(true);
      for (const [k, v] of Object.entries(skin.deck.suitColors)) expect(isColor(v), `${skin.id}.suit.${k}`).toBe(true);
      for (const d of CHIP_DENOMINATIONS) expect(skin.chips.colors[String(d)], `${skin.id}.chip.${d}`).toBeTruthy();
      expect(skin.table.aspect).toBeGreaterThan(0.3);
      expect(skin.table.aspect).toBeLessThan(0.9);
      expect(skin.deck.cornerRadius).toBeLessThanOrEqual(0.3);
      expect(skin.isBuiltIn).toBe(true);
    }
  });

  it('ships the GG-style skin with a 4-colour outlined deck and wooden rail', () => {
    expect(BUILT_IN_SKINS).toContain(SKIN_GG);
    expect(SKIN_GG.deck.colorMode).toBe(4);
    expect(SKIN_GG.deck.style).toBe('outlined');
    expect(new Set(Object.values(SKIN_GG.deck.suitColors)).size).toBe(4);
    expect(SKIN_GG.deck.cardBg).toBe('#ffffff');
    expect(SKIN_GG.theme).toBe('dark');
    // No third-party wordmark baked into the felt.
    expect(SKIN_GG.felt.logoText).toBeUndefined();
    expect(SKIN_GG.felt.logoAssetId).toBeUndefined();
  });

  it('deck presets never use more colours than their mode allows', () => {
    for (const p of DECK_PRESETS) {
      // Mono decks legitimately collapse to a single ink, hence "at most".
      expect(new Set(Object.values(p.deck.suitColors)).size, p.id).toBeLessThanOrEqual(p.deck.colorMode);
    }
  });
});
