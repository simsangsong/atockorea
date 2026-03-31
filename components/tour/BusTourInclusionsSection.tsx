'use client';

import { useState } from 'react';
import { Check, Minus, Info, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TourDetailViewModel } from '@/src/types/tours';

/** 샌드박스와 동일 — API 비어 있을 때 폴백 */
export const BUS_TOUR_INCLUSIONS_DEMO_INCLUDED: string[] = [
  'Private vehicle (sedan or SUV based on group size)',
  'Professional local driver-guide',
  'Hotel pickup and drop-off',
  'Bottled water',
  'All parking and toll fees',
  'Flexible itinerary adjustments',
];

export const BUS_TOUR_INCLUSIONS_DEMO_NOT_INCLUDED: string[] = [
  'Meals and personal expenses',
  'Temple or attraction admission fees (if any)',
  'Tips for guide (appreciated but optional)',
  'Travel insurance',
  'Items not mentioned in inclusions',
];

export const BUS_TOUR_INCLUSIONS_DEMO_GOOD_TO_KNOW: string[] = [
  'Child seats available upon request (please mention when booking)',
  'Tour can accommodate luggage for travelers with late flights',
  'Weather-dependent activities may be adjusted',
  'Comfortable walking shoes recommended',
  'Some temple areas require modest dress',
  'Guide can recommend restaurants based on your preferences',
];

export function linesFromTourList(
  items: TourDetailViewModel['inclusions'] | TourDetailViewModel['exclusions'] | undefined,
  fallback: string[]
): string[] {
  if (!items?.length) return [...fallback];
  return items.map((item: string | { text?: string }) =>
    typeof item === 'string' ? item : item.text ?? ''
  );
}

export type BusTourInclusionsLabels = {
  eyebrow: string;
  title: string;
  tabIncluded: string;
  tabNotIncluded: string;
  tabGoodToKnow: string;
};

export type BusTourInclusionsSectionProps = {
  included: string[];
  notIncluded: string[];
  /** 비어 있으면 샌드박스 데모 문구 사용 */
  goodToKnow?: string[];
  labels?: Partial<BusTourInclusionsLabels>;
};

const DEFAULT_LABELS: BusTourInclusionsLabels = {
  eyebrow: 'Package Details',
  title: "What's included",
  tabIncluded: 'Included',
  tabNotIncluded: 'Not Included',
  tabGoodToKnow: 'Good to Know',
};

export function BusTourInclusionsSection({
  included,
  notIncluded,
  goodToKnow,
  labels: labelsProp,
}: BusTourInclusionsSectionProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const tabs = [labels.tabIncluded, labels.tabNotIncluded, labels.tabGoodToKnow] as const;

  const goodToKnowLines =
    goodToKnow && goodToKnow.length > 0 ? goodToKnow : BUS_TOUR_INCLUSIONS_DEMO_GOOD_TO_KNOW;

  const [activeTab, setActiveTab] = useState(0);

  const getContent = () => {
    switch (activeTab) {
      case 0:
        return included.map((item: string, i: number) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-500/15">
              <Check className="w-3 h-3 text-blue-600" />
            </div>
            <span className="text-[13px] text-slate-900 leading-relaxed">{item}</span>
          </li>
        ));
      case 1:
        return notIncluded.map((item: string, i: number) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Minus className="w-3 h-3 text-slate-500" />
            </div>
            <span className="text-[13px] text-slate-500 leading-relaxed">{item}</span>
          </li>
        ));
      case 2:
        return goodToKnowLines.map((item: string, i: number) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-500/15">
              <Info className="w-3 h-3 text-blue-600" />
            </div>
            <span className="text-[13px] text-slate-900 leading-relaxed">{item}</span>
          </li>
        ));
      default:
        return null;
    }
  };

  return (
    <section className="tour-inclusions-premium relative border-t border-neutral-200/35 bg-transparent py-12 md:py-16 overflow-hidden">
      <div className="relative px-5 md:px-8 lg:px-0">
        <div className="max-w-4xl mx-auto lg:mx-0">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-blue-600">{labels.eyebrow}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mb-8">{labels.title}</h2>

          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
            {tabs.map((tab: string, index: number) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(index)}
                className={cn(
                  'px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap',
                  activeTab === index
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25'
                    : 'itinerary-glass-card-subtle text-slate-500 hover:text-slate-900'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6 rounded-design-lg itinerary-glass-card">
            <ul className="divide-y divide-slate-200/40">{getContent()}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}
