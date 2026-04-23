'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useI18n, useTranslations } from '@/lib/i18n';

type MatchResponse = {
  winner: { product_id: string } | null;
  matchExplanation: string | null;
  matchedProducts: Array<{ product_id: string; score: number }>;
};

export default function MatchPage() {
  const t = useTranslations('home');
  const { locale } = useI18n();
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResponse | null>(null);

  const runMatching = async () => {
    const text = intent.trim();
    if (!text) {
      setError('원하는 여행 스타일을 입력해 주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/tour-product/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, locale }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '매칭 처리 중 오류가 발생했습니다.');
      }
      const payload = (await response.json()) as MatchResponse;
      setResult(payload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '매칭 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SitePageShell>
      <main className="relative z-10 container mx-auto px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="home-panel-elevated rounded-[1.75rem] p-6 md:p-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('premium.v2.hero.plannerTitle')}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              맞춤 프라이빗 투어 매칭
            </h1>
            <p className="mt-2 text-sm text-slate-600 md:text-base">
              여행 스타일을 입력하면 프라이빗/소그룹/버스 중 가장 적합한 옵션을 찾아드립니다.
            </p>

            <div className="mt-6 space-y-3">
              <textarea
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder={t('premium.hero.inputPlaceholder')}
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 md:text-base"
              />
              <button
                type="button"
                onClick={runMatching}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t('common.processing') : t('premium.hero.findMatchCta')}
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {result ? (
              <div className="mt-6 space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
                <h2 className="text-base font-semibold text-slate-900">매칭 결과</h2>
                <p className="text-sm text-slate-600">
                  {result.matchExplanation || '입력하신 조건에 맞춰 추천 결과를 준비했습니다.'}
                </p>
                {result.winner ? (
                  <Link
                    href={`/tour-product/${result.winner.product_id}`}
                    className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    추천 투어 상세 보기
                  </Link>
                ) : (
                  <Link
                    href="/tours/list"
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    전체 투어 보러가기
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </SitePageShell>
  );
}
