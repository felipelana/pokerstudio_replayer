/**
 * Hole-card size shared by both renderers: crowded tables get smaller cards,
 * the hero (or focus player) always gets the largest pair.
 */
export function cardWidthFor(seatCount: number, isHero: boolean): number {
  const base = seatCount >= 9 ? 40 : seatCount >= 7 ? 45 : 50;
  return isHero ? Math.round(base * 1.28) : base;
}
