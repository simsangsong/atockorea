'use client';

import Link from 'next/link';
import {
  CalendarIcon,
  HeartIcon,
  HistoryIcon,
  MapIcon,
  SettingsIcon,
  StarIcon,
} from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_FOCUS_RING, MYPAGE_SECTION_TITLE, MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

export interface QuickAccessCounts {
  bookings: number;
  upcoming: number;
  history: number;
  reviews: number;
  wishlist: number;
  /** Optional 0..100 — renders as completion dot on Settings tile */
  settingsPct?: number;
}

interface QuickAccessTilesProps {
  counts: QuickAccessCounts;
}

const ICON_BG: Record<string, string> = {
  bookings: 'bg-emerald-100 text-emerald-700',
  upcoming: 'bg-sky-100 text-sky-700',
  history: 'bg-slate-100 text-slate-700',
  reviews: 'bg-amber-100 text-amber-700',
  wishlist: 'bg-rose-100 text-rose-700',
  settings: 'bg-indigo-100 text-indigo-700',
};

export function QuickAccessTiles({ counts }: QuickAccessTilesProps) {
  const t = useTranslations();

  const tiles = [
    {
      key: 'bookings',
      label: t('mypage.landing.quickAccess.items.bookings'),
      href: '/mypage/mybookings',
      Icon: HistoryIcon,
      count: counts.bookings,
    },
    {
      key: 'upcoming',
      label: t('mypage.landing.quickAccess.items.upcoming'),
      href: '/mypage/upcoming',
      Icon: CalendarIcon,
      count: counts.upcoming,
    },
    {
      key: 'history',
      label: t('mypage.landing.quickAccess.items.history'),
      href: '/mypage/history',
      Icon: MapIcon,
      count: counts.history,
    },
    {
      key: 'reviews',
      label: t('mypage.landing.quickAccess.items.reviews'),
      href: '/mypage/reviews',
      Icon: StarIcon,
      count: counts.reviews,
    },
    {
      key: 'wishlist',
      label: t('mypage.landing.quickAccess.items.wishlist'),
      href: '/mypage/wishlist',
      Icon: HeartIcon,
      count: counts.wishlist,
    },
    {
      key: 'settings',
      label: t('mypage.landing.quickAccess.items.settings'),
      href: '/mypage/settings',
      Icon: SettingsIcon,
      count: -1,
    },
  ] as const;

  return (
    <section>
      <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-3 px-1')}>
        {t('mypage.landing.quickAccess.title')}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.Icon;
          const hasCount = tile.count >= 0;
          const countLabel = hasCount
            ? tile.count > 0
              ? t('mypage.landing.quickAccess.count', { count: tile.count })
              : t('mypage.landing.quickAccess.view')
            : null;
          const pct = tile.key === 'settings' ? counts.settingsPct : undefined;
          return (
            <Link
              key={tile.key}
              href={tile.href}
              className={cn(
                MYPAGE_SURFACE_PAGE,
                'group flex min-h-[112px] flex-col justify-between p-4 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_14px_40px_-8px_rgba(15,23,42,0.14)]',
                MYPAGE_FOCUS_RING,
              )}
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl',
                    ICON_BG[tile.key],
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                {tile.key === 'settings' && typeof pct === 'number' && pct < 100 && (
                  <span
                    aria-hidden
                    className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.2)]"
                  />
                )}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#0f172a]">{tile.label}</p>
                {countLabel && (
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">{countLabel}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
