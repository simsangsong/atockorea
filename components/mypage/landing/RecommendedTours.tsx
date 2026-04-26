'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ClockIcon, MapIcon, StarIcon } from '@/components/Icons';
import { useCurrency } from '@/lib/currency';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_FOCUS_RING, MYPAGE_SECTION_TITLE, MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { cn } from '@/lib/utils';

export interface RecommendedTour {
  id: string;
  slug?: string | null;
  title: string;
  image?: string | null;
  city?: string | null;
  duration?: string | null;
  price?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
}

interface RecommendedToursProps {
  tours: RecommendedTour[];
}

export function RecommendedTours({ tours }: RecommendedToursProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();

  return (
    <section>
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <h2 className={MYPAGE_SECTION_TITLE}>{t('mypage.landing.recommendations.title')}</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {t('mypage.landing.recommendations.subtitle')}
          </p>
        </div>
        <Link
          href="/tours/list"
          className={cn(
            'text-[12px] font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline',
            MYPAGE_FOCUS_RING,
          )}
        >
          {t('mypage.viewAll')} →
        </Link>
      </div>

      {tours.length === 0 ? (
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-8 text-center')}>
          <p className="text-[13px] text-slate-500">{t('mypage.landing.recommendations.empty')}</p>
        </div>
      ) : (
        <div
          className={cn(
            'flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth pb-2 [scrollbar-gutter:stable] scrollbar-hide',
            '-mx-1 px-1 sm:mx-0 sm:px-0',
          )}
        >
          {tours.map((tour) => {
            const href = consumerTourDetailHref(tour.id, tour.slug ?? null);
            const img = tour.image || 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';
            return (
              <Link
                key={tour.id}
                href={href}
                className={cn(
                  MYPAGE_SURFACE_PAGE,
                  'group relative block w-[10.75rem] min-w-[10.75rem] max-w-[10.75rem] flex-shrink-0 snap-start overflow-hidden',
                  'transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_-10px_rgba(15,23,42,0.14)]',
                  'sm:min-w-[12rem] sm:max-w-[12rem] sm:w-[12rem]',
                  MYPAGE_FOCUS_RING,
                )}
              >
                <div className="relative aspect-[4/3] w-full sm:aspect-[5/3]">
                  <Image
                    src={img}
                    alt={tour.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    sizes="172px, (min-width: 640px) 192px"
                  />
                  {typeof tour.rating === 'number' && tour.rating > 0 && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-800 shadow sm:text-[11px]">
                      <StarIcon className="h-2.5 w-2.5 text-amber-500 sm:h-3 sm:w-3" />
                      {tour.rating.toFixed(1)}
                      {typeof tour.reviewCount === 'number' && tour.reviewCount > 0 && (
                        <span className="text-slate-500">({tour.reviewCount})</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-2.5 sm:p-3">
                  <h3 className="line-clamp-2 min-h-[2.4rem] text-[12px] font-semibold leading-tight text-[#0f172a] sm:min-h-0 sm:text-[13px] sm:leading-snug">
                    {tour.title}
                  </h3>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 sm:text-[11px]">
                    {tour.city && (
                      <span className="inline-flex min-w-0 max-w-full items-center gap-0.5 truncate">
                        <MapIcon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                        {tour.city}
                      </span>
                    )}
                    {tour.duration && (
                      <span className="inline-flex shrink-0 items-center gap-0.5">
                        <ClockIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        {tour.duration}
                      </span>
                    )}
                  </div>
                  {typeof tour.price === 'number' && (
                    <p className="pt-0.5 text-[12.5px] font-bold tabular-nums text-[#0f172a] sm:text-[14px]">
                      {formatPrice(tour.price)}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
