'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CheckIcon } from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_FOCUS_RING, MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

/**
 * Profile field weights — sum to 100. Determines `completionPercent`.
 * Kept colocated here because only the landing WelcomeHero consumes it.
 */
const PROFILE_WEIGHTS = {
  avatar_url: 20,
  full_name: 20,
  phone: 20,
  birth_year: 15,
  nationality: 15,
  language_preference: 10,
} as const;

export interface ProfileCompletionInput {
  avatar_url?: string | null;
  full_name?: string | null;
  phone?: string | null;
  birth_year?: number | null;
  nationality?: string | null;
  language_preference?: string | null;
}

export function computeProfileCompletion(p: ProfileCompletionInput | null | undefined): number {
  if (!p) return 0;
  let score = 0;
  if (p.avatar_url && /^https?:\/\//i.test(String(p.avatar_url))) score += PROFILE_WEIGHTS.avatar_url;
  if (p.full_name && String(p.full_name).trim().length > 0) score += PROFILE_WEIGHTS.full_name;
  if (p.phone && String(p.phone).trim().length > 0) score += PROFILE_WEIGHTS.phone;
  if (typeof p.birth_year === 'number' && p.birth_year > 1900) score += PROFILE_WEIGHTS.birth_year;
  if (p.nationality && String(p.nationality).trim().length > 0) score += PROFILE_WEIGHTS.nationality;
  if (p.language_preference && String(p.language_preference).trim().length > 0) {
    score += PROFILE_WEIGHTS.language_preference;
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}

function greetingKey(hour: number): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  if (hour < 12) return 'greetingMorning';
  if (hour < 17) return 'greetingAfternoon';
  return 'greetingEvening';
}

interface WelcomeHeroProps {
  name: string;
  profile: ProfileCompletionInput | null;
}

/**
 * Landing page welcome hero: time-of-day greeting + profile completion ring.
 * Renders beside the dashboard entry link so users can jump to analytics if
 * they prefer the numerical view.
 */
export function WelcomeHero({ name, profile }: WelcomeHeroProps) {
  const t = useTranslations();

  const pct = useMemo(() => computeProfileCompletion(profile), [profile]);
  const complete = pct >= 100;

  const hour = new Date().getHours();
  const greeting = t(`mypage.landing.${greetingKey(hour)}`, { name });

  const circumference = 2 * Math.PI * 26;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6 md:p-7')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t('mypage.title')}
          </p>
          <h1 className="truncate text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
            {greeting}
          </h1>
          <p className="mt-1 text-[13px] leading-snug text-slate-600">{t('mypage.landing.subtitle')}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/mypage/dashboard"
              className={cn(
                'inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-slate-50',
                MYPAGE_FOCUS_RING,
              )}
            >
              {t('mypage.landing.viewDashboard')} →
            </Link>
            {!complete && (
              <Link
                href="/mypage/settings"
                className={cn(
                  'inline-flex items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800',
                  MYPAGE_FOCUS_RING,
                )}
              >
                {t('mypage.landing.profile.completeCta', { pct })}
              </Link>
            )}
            {complete && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                <CheckIcon className="h-3.5 w-3.5" />
                {t('mypage.landing.profile.completeBadge')}
              </span>
            )}
          </div>
        </div>

        <div
          className="relative hidden h-[64px] w-[64px] shrink-0 sm:block"
          role="img"
          aria-label={t('mypage.landing.profile.ringLabel') + ' ' + pct + '%'}
        >
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgb(226 232 240)" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke={complete ? 'rgb(16 185 129)' : 'rgb(15 23 42)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[13px] font-bold tabular-nums text-[#0f172a]">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
