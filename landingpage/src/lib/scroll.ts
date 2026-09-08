import { HEADER_HEIGHT } from '@/config';

/**
 * Scrolls a section to just under the fixed header, animated unless the visitor
 * asked for less motion, and updates the address bar so the anchor can be
 * copied and shared. Focus moves to the section itself, so keyboard and screen
 * reader users continue from where the page just moved to — the browser does
 * that for a real anchor jump, and it has to be done by hand here.
 */
export function scrollToSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 16;

  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  history.replaceState(null, '', `#${id}`);

  // `preventScroll` keeps focusing from undoing the animated scroll above.
  el.focus({ preventScroll: true });
}
