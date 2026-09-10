import { useEffect, useState } from 'react';
import { HEADER_HEIGHT, SECTIONS, type SectionId } from '@landing/config';

/**
 * Which section the reader is currently in.
 *
 * Rather than an IntersectionObserver ratio (which picks the wrong section when
 * one is much taller than the viewport), this asks a simpler question on every
 * scroll: which section's top has most recently passed just below the header?
 * The answer is stable while scrolling in both directions, and the last section
 * wins once the page is scrolled to the bottom — otherwise a short final
 * section can never become active.
 */
export function useScrollSpy(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const line = HEADER_HEIGHT + 24;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      let current: SectionId | null = null;
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const { top, bottom } = el.getBoundingClientRect();
        if (top <= line && bottom > line) current = id;
        if (atBottom) current = SECTIONS[SECTIONS.length - 1];
      }
      setActive(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return active;
}
