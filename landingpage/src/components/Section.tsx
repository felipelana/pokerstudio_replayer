import type { ReactNode } from 'react';
import { useReveal } from '@/hooks/useReveal';
import { SECTION_ICONS } from '@/components/Icons';
import { SECTIONS, type SectionId } from '@/config';

interface SectionProps {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
  /** A darker band, used to separate neighbouring sections. */
  tone?: 'base' | 'raised';
}

function isSectionId(id: string): id is SectionId {
  return (SECTIONS as readonly string[]).includes(id);
}

export function Section({ id, title, lead, children, tone = 'base' }: SectionProps) {
  const ref = useReveal<HTMLDivElement>();
  const headingId = `${id}-title`;
  // The same icon the navigation uses for this section, so the menu entry and
  // the heading it jumps to carry the same mark.
  const Icon = isSectionId(id) ? SECTION_ICONS[id] : null;

  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={[
        'scroll-mt-24 border-t border-line py-20 focus:outline-none sm:py-24',
        tone === 'raised' ? 'bg-bg-2' : 'bg-bg',
      ].join(' ')}
    >
      <div className="container-page">
        <div ref={ref} className="reveal max-w-3xl">
          <h2
            id={headingId}
            className="flex items-center gap-3.5 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {Icon ? (
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/35 bg-accent/10 text-[color:var(--accent-soft)] sm:h-12 sm:w-12"
              >
                <Icon className="h-6 w-6 sm:h-[26px] sm:w-[26px]" />
              </span>
            ) : null}
            {title}
          </h2>
          {lead ? <p className="mt-4 text-lg leading-relaxed text-muted">{lead}</p> : null}
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
