import type { ReactNode } from 'react';

type TourDetailHeroOverlapCardProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Pull-up card below the hero (visual only). Parent must not render when there is no content.
 */
export function TourDetailHeroOverlapCard({ children, className = '' }: TourDetailHeroOverlapCardProps) {
  return (
    <div className={`relative z-20 -mt-5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`.trim()}>
      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-xl shadow-black/5 lg:p-6">
        {children}
      </div>
    </div>
  );
}
