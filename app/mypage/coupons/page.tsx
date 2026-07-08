'use client';

/**
 * Mypage — My Coupons tab (§7 of the welcome-coupon master plan).
 *
 * Renders the signed-in user's coupon grants from GET /api/mypage/coupons with
 * status badges (active / locked / redeemed / expired), a D-3 expiring-soon
 * nudge strip, and a quiet-luxury card tone consistent with the popup — no
 * ticket-perforation skeuomorphism.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TicketIcon } from '@/components/Icons';
import { useI18n, useTranslations } from '@/lib/i18n';
import { MYPAGE_SURFACE_PAGE, MYPAGE_SURFACE, MYPAGE_SECTION_TITLE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

export const dynamic = 'force-dynamic';

interface CouponItem {
  id: string;
  status: 'active' | 'locked' | 'redeemed' | 'expired';
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  expiresAt: string | null;
  redeemedAt: string | null;
  daysLeft: number | null;
  isExpiringSoon: boolean;
}

/** "10%" for percentage codes; "$15" style for legacy fixed codes (USD-denominated). */
function discountLabel(coupon: CouponItem, locale: string): string {
  if (coupon.discountType === 'percentage') {
    // zh idiom: 10% off = 9折 (§6.5 localization note)
    if (locale === 'zh' || locale === 'zh-TW') {
      const zhe = (100 - coupon.discountValue) / 10;
      return `${Number.isInteger(zhe) ? zhe : zhe.toFixed(1)}折`;
    }
    return `${coupon.discountValue}% OFF`;
  }
  return `$${coupon.discountValue} OFF`;
}

export default function MyCouponsPage() {
  const router = useRouter();
  const t = useTranslations('mypage.coupons');
  const { locale } = useI18n();
  const { getAccessToken } = useMyPageSession();
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          router.push('/signin');
          return;
        }
        const res = await fetch('/api/mypage/coupons', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) setCoupons(data.coupons ?? []);
      } catch (err) {
        console.error('Error fetching coupons:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateFmt = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(new Date(iso))
      : '';

  const badge = (coupon: CouponItem) => {
    switch (coupon.status) {
      case 'active':
        return (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            {t('available')}
          </span>
        );
      case 'locked':
        return (
          <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
            {t('inUse')}
          </span>
        );
      case 'redeemed':
        return (
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-500">
            {t('used')}
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-400">
            {t('expired')}
          </span>
        );
    }
  };

  const subline = (coupon: CouponItem) => {
    switch (coupon.status) {
      case 'active':
        return t('autoApplied');
      case 'locked':
        return t('inUseNote');
      case 'redeemed':
        return t('usedOn', { date: dateFmt(coupon.redeemedAt) });
      default:
        return t('expiredOn', { date: dateFmt(coupon.expiresAt) });
    }
  };

  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'space-y-6')}>
      <h1 className={cn(MYPAGE_SECTION_TITLE)}>{t('tabTitle')}</h1>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className={cn(MYPAGE_SURFACE, 'h-28 animate-pulse')} />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <div className={cn(MYPAGE_SURFACE, 'flex flex-col items-center gap-3 py-12 text-center')}>
          <TicketIcon className="h-8 w-8 text-stone-300" />
          <p className="text-[14px] text-stone-500">{t('empty')}</p>
          <Link
            href="/tours/list"
            className="rounded-xl bg-stone-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
          >
            {t('browseCta')}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {coupons.map((coupon) => {
            const dimmed = coupon.status === 'expired' || coupon.status === 'redeemed';
            return (
              <li
                key={coupon.id}
                className={cn(
                  MYPAGE_SURFACE,
                  'overflow-hidden p-0',
                  dimmed && 'opacity-60',
                )}
              >
                {coupon.isExpiringSoon && coupon.daysLeft != null && (
                  <div className="bg-amber-50 px-4 py-1.5 text-[12px] font-semibold text-amber-700">
                    {t('expiringSoon', { n: coupon.daysLeft })}
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-[18px] leading-none text-stone-900">
                        {discountLabel(coupon, locale)}
                      </span>
                      {badge(coupon)}
                    </div>
                    <p className="truncate text-[12px] uppercase tracking-wide text-stone-400">
                      {coupon.code}
                    </p>
                    <p className="text-[13px] text-stone-600">{subline(coupon)}</p>
                    {coupon.status === 'active' && coupon.daysLeft != null && !coupon.isExpiringSoon && (
                      <p className="text-[12px] text-stone-400">D-{coupon.daysLeft}</p>
                    )}
                  </div>
                  {coupon.status === 'active' && (
                    <Link
                      href="/tours/list"
                      className="shrink-0 rounded-xl border border-stone-300 px-3.5 py-2 text-[13px] font-semibold text-stone-800 transition hover:bg-stone-100"
                    >
                      {t('browseCta')}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
