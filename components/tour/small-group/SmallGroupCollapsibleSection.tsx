'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SmallGroupSectionHeader from './SmallGroupSectionHeader';

export interface SmallGroupCollapsibleSectionProps {
  eyebrow?: string;
  title: string;
  /** Shown only when expanded (under the title). */
  description?: string;
  titleId?: string;
  children: React.ReactNode;
  /** First-tap state; default collapsed. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Section shell: title row always visible; body folds with a slow “roll open” (grid 0fr → 1fr).
 */
export default function SmallGroupCollapsibleSection({
  eyebrow,
  title,
  description,
  titleId,
  children,
  defaultOpen = false,
  className = '',
}: SmallGroupCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = titleId ? `${titleId}-panel` : undefined;

  return (
    <section
      className={`w-full sg-section-card sg-float-card ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="sg-collapsible-trigger group/tr w-full text-left flex items-start justify-between gap-3 sm:gap-4 rounded-xl -mx-1 px-2 py-2 sm:-mx-2 sm:px-3 transition-[background-color,box-shadow] duration-500 ease-out hover:bg-black/[0.025] focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <div className="min-w-0 flex-1">
          <SmallGroupSectionHeader
            as="div"
            eyebrow={eyebrow}
            title={title}
            description={undefined}
            titleId={titleId}
            className="mb-0 [&_h2]:pr-2"
          />
        </div>
        <ChevronDown
          className={`w-5 h-5 sm:w-[1.375rem] sm:h-[1.375rem] shrink-0 text-stone-400 mt-1 transition-transform duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        className="sg-collapsible-roll grid overflow-hidden motion-reduce:!transition-none"
        data-open={open ? 'true' : 'false'}
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-5 sm:pt-6 mt-1 border-t border-stone-100">
            {description ? (
              <p className="max-w-prose text-[0.875rem] sm:text-[0.9375rem] text-stone-600 leading-relaxed mb-5 sm:mb-6 text-pretty">
                {description}
              </p>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
