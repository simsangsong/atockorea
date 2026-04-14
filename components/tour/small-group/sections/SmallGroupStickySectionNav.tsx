'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'sg-overview', label: 'Overview' },
  { id: 'sg-itinerary', label: 'Itinerary' },
  { id: 'sg-details', label: 'Details' },
  { id: 'sg-faq', label: 'FAQ' },
];

function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function headerHeight(): number {
  const header = document.querySelector<HTMLElement>('header[data-header-variant="premium-tour"]');
  return header?.offsetHeight ?? 52;
}

/**
 * Slim in-page nav below the hero decision strip — scroll targets use `sg-*` section ids.
 */
export default function SmallGroupStickySectionNav() {
  const [activeId, setActiveId] = useState<string>(TABS[0]?.id ?? 'sg-overview');
  const navRef = useRef<HTMLElement>(null);

  const updateActive = useCallback(() => {
    const navH = navRef.current?.offsetHeight ?? 38;
    const offset = headerHeight() + navH;
    const ids = TABS.map((tab: { id: string; label: string }) => tab.id);
    let current = ids[0] ?? 'sg-overview';
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top <= offset + 6) {
        current = id;
      }
    }
    setActiveId(current);
  }, []);

  useEffect(() => {
    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateActive);
      window.removeEventListener('resize', updateActive);
    };
  }, [updateActive]);

  const onTabClick = useCallback((id: string) => {
    setActiveId(id);
    scrollToAnchor(id);
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="On this page"
      className="sticky top-[3.25rem] z-[45] border-b border-stone-200/80 bg-[color-mix(in_oklab,var(--dp-secondary)_8%,#f7f6f3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md backdrop-saturate-150 sm:top-14 md:top-[3.75rem]"
    >
      <div className="sg-dp-page-gutter">
        <div className="sg-dp-page-column">
          <ul className="m-0 flex w-full list-none flex-nowrap items-stretch gap-0 overflow-x-auto p-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab: { id: string; label: string }) => {
              const isActive = activeId === tab.id;
              return (
                <li key={tab.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'touch-manipulation border-b-2 px-3 py-2 text-[11px] font-medium tracking-[0.04em] transition-[color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/35 sm:px-4 sm:py-2 sm:text-[11.5px]',
                      isActive
                        ? 'border-stone-800/80 text-stone-900'
                        : 'border-transparent text-stone-500 hover:text-stone-700',
                    )}
                    onClick={() => onTabClick(tab.id)}
                  >
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
