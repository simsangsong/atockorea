'use client';

import TourSectionRow from '@/components/TourSectionRow';
import type { TourSectionFetchParams } from '@/components/TourSectionRow';

const SECTIONS: Array<{
  titleKey: string;
  seeAllHref: string;
  fetchParams: TourSectionFetchParams;
}> = [
  {
    titleKey: 'home.sections.popularTours',
    seeAllHref: '/tours?sortBy=rating&sortOrder=desc',
    fetchParams: { limit: 4, sortBy: 'rating', sortOrder: 'desc' },
  },
];

export default function HomeTourSections() {
  return (
    <div className="bg-white/80 backdrop-blur-sm border-y border-gray-100">
      {SECTIONS.map(({ titleKey, seeAllHref, fetchParams }) => (
        <TourSectionRow
          key={titleKey}
          titleKey={titleKey}
          seeAllHref={seeAllHref}
          fetchParams={fetchParams}
        />
      ))}
    </div>
  );
}
