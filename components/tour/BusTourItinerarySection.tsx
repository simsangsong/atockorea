'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Camera, Clock, MapPin, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BusTourItineraryStop = {
  id: number;
  name: string;
  nameEn: string;
  duration: string;
  image: string;
  highlight: string;
  details: string;
  photoSpot: boolean;
  travelTime: string | null;
};

/** 샌드박스 목업과 동일 — API 일정이 없을 때만 버스투어에서 사용 */
export const BUS_TOUR_ITINERARY_DEMO_STOPS: BusTourItineraryStop[] = [
  {
    id: 1,
    name: '해동 용궁사',
    nameEn: 'Haedong Yonggungsa Temple',
    duration: '45-60 min',
    image: 'https://images.unsplash.com/photo-1548115184-bc6544d06a58?w=400&h=300&fit=crop',
    highlight: 'Temple perched on oceanside cliffs with stunning sunrise views',
    details:
      "One of Korea's most beautiful seaside temples. Walk through the traditional gate and descend the 108 steps to the main temple complex. Don't miss the golden Buddha statue overlooking the sea.",
    photoSpot: true,
    travelTime: null,
  },
  {
    id: 2,
    name: '해운대 해변',
    nameEn: 'Haeundae Beach',
    duration: '30-45 min',
    image: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=400&h=300&fit=crop',
    highlight: "Korea's most famous beach with a vibrant boardwalk",
    details:
      'Stroll along the crescent-shaped beach and enjoy the coastal atmosphere. Visit the interactive street art installations and take photos with the iconic skyline backdrop.',
    photoSpot: true,
    travelTime: '20 min',
  },
  {
    id: 3,
    name: '감천 문화마을',
    nameEn: 'Gamcheon Culture Village',
    duration: '60-90 min',
    image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&h=300&fit=crop',
    highlight: "Colorful hillside village known as 'Machu Picchu of Korea'",
    details:
      'Wander through narrow alleyways adorned with murals and art installations. Find the famous Little Prince statue and enjoy panoramic views of the pastel-colored houses cascading down the hillside.',
    photoSpot: true,
    travelTime: '25 min',
  },
  {
    id: 4,
    name: '자갈치 시장',
    nameEn: 'Jagalchi Fish Market',
    duration: '45-60 min',
    image: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=400&h=300&fit=crop',
    highlight: "Korea's largest seafood market with fresh catches daily",
    details:
      "Experience the bustling atmosphere of Korea's largest fish market. Watch local vendors prepare fresh seafood and optionally enjoy a lunch of raw fish (sashimi) or grilled shellfish.",
    photoSpot: false,
    travelTime: '15 min',
  },
  {
    id: 5,
    name: '광안리 해변',
    nameEn: 'Gwangalli Beach & Diamond Bridge',
    duration: '30-45 min',
    image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400&h=300&fit=crop',
    highlight: 'Scenic beach with views of the illuminated Diamond Bridge',
    details:
      'Perfect spot for afternoon relaxation or evening views. The Diamond Bridge is especially spectacular when lit up at night, creating a perfect ending to your Busan tour.',
    photoSpot: true,
    travelTime: '10 min',
  },
];

/** One-line pickup summary for bus itinerary (times + place names), shown above stop cards. */
export function formatBusPickupInfoSummary(
  items: Array<{ time: string; title: string }>
): string {
  return items
    .map((item) => {
      const time = (item.time || '').trim();
      const title = (item.title || '').trim();
      if (!title) return '';
      if (time && title.includes(time)) return title;
      return time ? `${time} ${title}` : title;
    })
    .filter(Boolean)
    .join('\n');
}

export function mapDestinationItemsToBusTourStops(
  items: Array<{ time: string; title: string; description: string; image?: string }>,
  fallbackImage: string
): BusTourItineraryStop[] {
  return items.map((step, i: number) => {
    const desc = (step.description || '').trim();
    const highlight =
      desc.length > 160 ? `${desc.slice(0, 157)}...` : desc || step.title || '—';
    return {
      id: i + 1,
      name: step.title || '—',
      nameEn: step.time || '',
      duration: step.time || '—',
      image: step.image || fallbackImage,
      highlight: highlight || '—',
      details: desc || '—',
      photoSpot: true,
      travelTime: null,
    };
  });
}

export type BusTourItinerarySectionProps = {
  stops: BusTourItineraryStop[];
  journeyTitle?: string;
  journeySubtitle?: string;
  footerNote?: string;
  /** Merged pickup rows (not shown as separate timeline cards). */
  pickupInfoSummary?: string;
  pickupInfoHeading?: string;
};

/** Image chip: time ranges stay as-is; "45–60 min" → first number + min. */
function busDurationChipLabel(duration: string): string {
  const t = duration.trim();
  if (!t) return '—';
  if (/\d{1,2}:\d{2}/.test(t)) return t;
  const m = t.match(/(\d+)/);
  if (m) return `${m[1]} min`;
  return t;
}

function nameEnLooksLikeTime(nameEn: string): boolean {
  return /^\s*\d{1,2}:\d{2}/.test(nameEn.trim());
}

export function BusTourItinerarySection({
  stops,
  journeyTitle = 'Your journey through Busan',
  journeySubtitle = 'Tap each stop to explore details and tips',
  footerNote =
    'The order may be adjusted based on traffic and your preferences. Total driving time is approximately 1.5 hours spread throughout the day.',
  pickupInfoSummary,
  pickupInfoHeading = 'Pickup info',
}: BusTourItinerarySectionProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <section className="tour-itinerary-premium border-t border-neutral-200/35 bg-transparent px-2 font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1] sm:px-3 md:px-5 lg:px-0 py-12 md:py-16">
      <div className="max-w-4xl mx-auto lg:mx-0">
        <div className="mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-neutral-600" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Itinerary</span>
        </div>
        <h2 className="mb-2 text-2xl font-bold tracking-[-0.03em] text-neutral-950 md:text-[28px] md:leading-[1.2]">
          {journeyTitle}
        </h2>
        <p className="mb-8 text-[15px] font-normal leading-relaxed text-neutral-500 md:mb-10">{journeySubtitle}</p>

        {pickupInfoSummary?.trim() ? (
          <div className="mb-8 rounded-3xl border border-neutral-200/90 bg-white px-4 py-3.5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] md:px-5 md:py-4">
            <div className="mb-1.5 flex items-center gap-2">
              <Car className="h-4 w-4 shrink-0 text-neutral-600" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                {pickupInfoHeading}
              </span>
            </div>
            <p className="m-0 text-[14px] leading-relaxed text-neutral-700 whitespace-pre-line">
              {pickupInfoSummary.trim()}
            </p>
          </div>
        ) : null}

        {stops.length > 0 ? (
          <div className="relative">
            {/* Rail centered in gutter: w-8 → 16px; md:w-9 → 18px */}
            <div
              className="pointer-events-none absolute bottom-0 left-4 top-3 w-px bg-neutral-200 md:left-[18px] md:top-2"
              aria-hidden
            />

            <div className="flex flex-col gap-6 md:gap-8">
              {stops.map((stop: BusTourItineraryStop) => (
                <div key={stop.id} className="flex flex-col gap-2.5 md:gap-3">
                  {stop.travelTime ? (
                    <div className="flex min-w-0 gap-2 sm:gap-2.5 md:gap-4">
                      <div
                        className="relative z-[1] flex w-8 shrink-0 justify-center self-start pt-0.5 md:w-9"
                        aria-hidden
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200/90 bg-white shadow-sm ring-[2px] ring-neutral-50 md:h-7 md:w-7 md:ring-[3px]">
                          <Car className="h-3 w-3 text-neutral-500 md:h-3.5 md:w-3.5" strokeWidth={2} />
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-1 items-center pt-0.5">
                        <span className="text-[12px] font-medium text-neutral-500">{stop.travelTime} drive</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex min-w-0 gap-2 sm:gap-2.5 md:gap-4">
                    <div
                      className="relative z-[1] flex w-8 shrink-0 justify-center self-start md:w-9"
                      aria-hidden
                    >
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-[12px] font-bold tabular-nums text-white shadow-sm ring-[2px] ring-neutral-50 md:mt-0 md:h-9 md:w-9 md:text-[13px] md:ring-[5px]">
                        {stop.id}
                      </div>
                    </div>

                    <article className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'overflow-hidden rounded-[1.75rem] border border-neutral-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-shadow md:rounded-[2rem]',
                          expandedId === stop.id && 'shadow-[0_8px_24px_rgba(15,23,42,0.08)]'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExpand(stop.id)}
                          aria-expanded={expandedId === stop.id}
                          className="w-full cursor-pointer overflow-hidden text-left"
                        >
                          <div className="relative aspect-[16/10] w-full sm:aspect-[5/3]">
                            <Image
                              src={stop.image}
                              alt={stop.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 48rem"
                              loading="lazy"
                            />
                            <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-black/72 px-3 py-1.5 text-[12px] font-semibold tabular-nums text-white backdrop-blur-[2px]">
                              <Clock className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden strokeWidth={2} />
                              {busDurationChipLabel(stop.duration)}
                            </div>
                          </div>

                          <div className="px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                {stop.nameEn?.trim() && nameEnLooksLikeTime(stop.nameEn) ? (
                                  <p className="mb-1.5 inline-flex max-w-full items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold leading-none tracking-[-0.01em] text-amber-950 ring-1 ring-amber-200/80 md:text-[11px] md:px-3 md:py-1">
                                    {stop.nameEn.trim()}
                                  </p>
                                ) : null}
                                <h3 className="text-base font-bold leading-tight tracking-[-0.03em] text-neutral-950 md:text-[17px] md:leading-[1.2]">
                                  {stop.name}
                                </h3>
                                {stop.nameEn?.trim() && !nameEnLooksLikeTime(stop.nameEn) ? (
                                  <p className="mt-1 text-[11px] font-medium leading-tight tracking-[-0.02em] text-neutral-500">
                                    {stop.nameEn.trim()}
                                  </p>
                                ) : null}
                              </div>
                              <ChevronDown
                                className={cn(
                                  'mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200',
                                  expandedId === stop.id && 'rotate-180'
                                )}
                                aria-hidden
                                strokeWidth={2}
                              />
                            </div>

                            <p className="mt-2 text-[13px] font-normal leading-snug tracking-[-0.01em] text-neutral-600 md:leading-[1.45]">
                              {stop.highlight}
                            </p>

                            {stop.photoSpot ? (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium leading-none tracking-[-0.01em] text-neutral-600">
                                  <Camera className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                                  Photo spot
                                </span>
                              </div>
                            ) : null}

                            {expandedId === stop.id ? (
                              <div className="mt-4 border-t border-neutral-200/90 pt-4">
                                <p className="m-0 text-[13px] font-normal leading-relaxed tracking-[-0.01em] text-neutral-600">
                                  {stop.details}
                                </p>
                                {stop.photoSpot ? (
                                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-neutral-200/90 bg-neutral-50 px-3 py-2.5">
                                    <Camera className="h-4 w-4 shrink-0 text-neutral-700" aria-hidden />
                                    <span className="text-[12px] font-medium text-neutral-700">
                                      Best photo opportunity
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      </div>
                    </article>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 rounded-3xl border border-neutral-200/90 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] md:p-6">
          <p className="m-0 text-[13px] leading-relaxed text-neutral-600">
            <span className="font-semibold text-neutral-950">Flexible timing:</span> {footerNote}
          </p>
        </div>
      </div>
    </section>
  );
}
