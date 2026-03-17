'use client';

import TourSectionRow from '@/components/TourSectionRow';
import type { TourSectionFetchParams } from '@/components/TourSectionRow';

const SECTIONS: Array<{
  titleKey: string;
  seeAllHref: string;
  fetchParams: TourSectionFetchParams;
}> = [
  {
    titleKey: 'home.sections.standardBusDayTour',
    seeAllHref: '/tours/list',
    fetchParams: { limit: 4, sortBy: 'rating', sortOrder: 'desc' },
  },
];

export default function HomeTourSections() {
  return (
    <div className="bg-[#F5F7FA]/50 border-y border-[#E1E5EA]">
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
