'use client';

/**
 * `/match` — standalone (deep-form) version of the home hero planner.
 *
 * Same backend API as `components/home/v2/HomeV2MatchProvider.tsx` (`POST
 * /api/tour-product/match`), but with a focused one-step UX: a single freeform
 * textarea → winner card + alt options. Kept in parallel with the home planner
 * as the "wide-input" entry point for deep links (`HOME_CTA_MATCHING_HREF`,
 * shares, SNS). Positioning (merge vs. keep) is tracked in the `/match` audit
 * plan (P3 — p3-positioning).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, ChevronRight, Clock, MapPin, RefreshCw, Star } from 'lucide-react';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { useI18n, useTranslations } from '@/lib/i18n';
import { getStaticTourProductBySlug } from '@/components/product-tour-static/catalog/staticTourCatalogCards';
import type { ScoredProduct, TourMatchApiResponse } from '@/lib/tour-match-v2/api-types';
import { cn } from '@/lib/utils';
import { analytics } from '@/src/design/analytics';

type Phase = 'idle' | 'loading' | 'result';

const LOADING_STEP_1_MS = 450;
const LOADING_STEP_2_MS = 900;

/**
 * Detail route guard: only slugs registered in the static tour-product registry
 * render successfully on `/tour-product/[slug]`. DB-only profiles (when Supabase
 * is seeded beyond the in-app registry) fall back to the catalog list so users
 * never hit a `notFound()` after a successful match.
 */
function safeDetailHrefForSlug(slug: string): string {
  return getStaticTourProductBySlug(slug) ? `/tour-product/${slug}` : '/tours/list';
}

export default function MatchPage() {
  const t = useTranslations('home.premium.hero');
  const { locale } = useI18n();

  const [intent, setIntent] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2>(0);
  const [result, setResult] = useState<TourMatchApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clearStepTimeouts = useCallback(() => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    timeoutsRef.current = [];
  }, []);

  // Cleanup on unmount: abort any in-flight request + clear pending step timers.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      for (const id of timeoutsRef.current) clearTimeout(id);
      timeoutsRef.current = [];
    };
  }, []);

  const runMatching = useCallback(async () => {
    const text = intent.trim();
    if (!text) {
      setInvalid(true);
      setError(t('matchErrorEmptyInput'));
      setResult(null);
      setPhase('idle');
      textareaRef.current?.focus();
      return;
    }

    setInvalid(false);
    setError(null);
    setResult(null);
    setPhase('loading');
    setLoadingStep(0);

    // Abort any previous in-flight match before starting a new one.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    clearStepTimeouts();
    const t1 = setTimeout(() => setLoadingStep(1), LOADING_STEP_1_MS);
    const t2 = setTimeout(() => setLoadingStep(2), LOADING_STEP_2_MS);
    timeoutsRef.current.push(t1, t2);

    analytics.matchPageSubmit({ textLength: text.length, locale });

    try {
      const res = await fetch('/api/tour-product/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, locale }),
        signal: ctrl.signal,
      });
      const data = (await res
        .json()
        .catch(() => ({}))) as TourMatchApiResponse & {
        error?: string;
        parsed_query?: unknown;
      };
      if (!res.ok) {
        throw new Error(data.error || t('matchErrorGeneric'));
      }

      if (ctrl.signal.aborted) return;
      clearStepTimeouts();
      setLoadingStep(2);
      setResult(data);
      setPhase('result');
      analytics.matchPageResultView({
        outcome: data.matchOutcome === 'matched' ? 'matched' : 'no_match',
        winnerId: data.winner?.product_id ?? null,
        matchedCount: data.matchedProducts.length,
        noMatchReason: data.noMatchReason,
      });

      // Background fetch — Haiku explanation. /match endpoint returns
      // matchExplanation = parser_notes fallback; this swap-in fades in the
      // richer locale-specific summary once Haiku resolves.
      const winnerSlugForExplain = data.winner?.product_id ?? null;
      if (winnerSlugForExplain && data.parsed_query) {
        void fetch('/api/tour-product/match-explanation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text,
            locale,
            parsed_query: data.parsed_query,
            winner_slug: winnerSlugForExplain,
          }),
          signal: ctrl.signal,
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { explanation?: string | null } | null) => {
            const explanation = j?.explanation?.trim();
            if (!explanation || ctrl.signal.aborted) return;
            setResult((prev) =>
              prev ? { ...prev, matchExplanation: explanation } : prev,
            );
          })
          .catch(() => {
            // silent — UI keeps the fallback summary
          });
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      clearStepTimeouts();
      setLoadingStep(0);
      setPhase('idle');
      // Server errors surface via `data.error` above; catch unknown/network failures here.
      setError(t('matchErrorGeneric'));
      analytics.matchPageResultView({
        outcome: 'error',
        winnerId: null,
        matchedCount: 0,
        noMatchReason: null,
      });
    }
  }, [intent, locale, t, clearStepTimeouts]);

  const backToPlanner = useCallback(() => {
    clearStepTimeouts();
    abortRef.current?.abort();
    setPhase('idle');
    setLoadingStep(0);
    setResult(null);
    setError(null);
    setInvalid(false);
    analytics.matchPageRefine();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => {
        textareaRef.current?.focus({ preventScroll: true });
      }, 350);
    }
  }, [clearStepTimeouts]);

  const winner = result?.winner ?? null;
  const winnerProduct = useMemo(
    () => (winner ? getStaticTourProductBySlug(winner.product_id, locale) : undefined),
    [winner, locale],
  );
  const alsoConsider = useMemo<ScoredProduct[]>(
    () => (result?.matchedProducts ?? []).slice(1, 4),
    [result],
  );
  const winnerHref = winner ? safeDetailHrefForSlug(winner.product_id) : '/tours/list';

  const noMatchMessage = useMemo(() => {
    if (!result || result.matchOutcome !== 'no_match') return null;
    switch (result.noMatchReason) {
      case 'no_exact_type_match':
        return t('matchNoMatchTypeReason');
      case 'no_step_free_products':
        return t('matchNoMatchStepFreeReason');
      case 'all_products_excluded':
      default:
        return t('matchNoMatchGenericReason');
    }
  }, [result, t]);

  const loadingLabel =
    loadingStep === 2
      ? t('matchLoadingComplete')
      : loadingStep === 1
        ? t('matchLoadingMatching')
        : t('matchLoadingAnalyzing');

  return (
    <SitePageShell>
      <main className="relative z-10 container mx-auto px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="home-panel-elevated p-6 md:p-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {t('matchPageEyebrow')}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {t('matchPageTitle')}
            </h1>
            <p className="mt-2 text-sm text-slate-600 md:text-base">{t('matchPageSubtitle')}</p>
            <p className="mt-3 text-xs text-slate-500 md:text-sm">{t('matchPageHint')}</p>

            <div className="mt-6 space-y-3">
              <textarea
                ref={textareaRef}
                value={intent}
                onChange={(e) => {
                  setIntent(e.target.value);
                  if (invalid && e.target.value.trim()) {
                    setInvalid(false);
                    setError(null);
                  }
                }}
                placeholder={t('inputPlaceholder')}
                aria-invalid={invalid || undefined}
                aria-label={t('intentInputAria')}
                disabled={phase === 'loading'}
                className={cn(
                  'min-h-28 w-full resize-y rounded-2xl border bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition md:text-base',
                  invalid
                    ? 'border-rose-300 ring-2 ring-rose-200 focus:border-rose-400 focus:ring-rose-200'
                    : 'border-slate-200 focus:border-primary/35 focus:ring-2 focus:ring-primary/15',
                  phase === 'loading' && 'cursor-not-allowed opacity-60',
                )}
              />

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={runMatching}
                  disabled={phase === 'loading'}
                  aria-label={t('matchSubmitAria')}
                  aria-busy={phase === 'loading'}
                  className="inline-flex min-h-[3rem] items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70 md:min-h-[3.25rem] md:text-base"
                  style={{
                    background: 'linear-gradient(to bottom, #1e3a5f, #172d4a)',
                    boxShadow: 'var(--home-shadow-btn-primary)',
                    border: 'none',
                  }}
                >
                  {phase === 'loading' ? loadingLabel : t('findMatchCta')}
                  {phase !== 'loading' ? (
                    <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden />
                  ) : null}
                </button>
                {error && phase !== 'loading' ? (
                  <button
                    type="button"
                    onClick={runMatching}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    {t('matchErrorRetry')}
                  </button>
                ) : null}
              </div>
            </div>

            {phase === 'loading' ? <LoadingStepsRow step={loadingStep} t={t} /> : null}

            {error ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-900"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}
          </section>

          {result && phase === 'result' ? (
            <section className="home-panel-elevated match-result-soft-enter p-6 md:p-8">
              {result.matchOutcome === 'matched' && winner ? (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    {t('matchResultHeading')}
                  </p>
                  <WinnerCard
                    product={winnerProduct}
                    winnerId={winner.product_id}
                    explanation={result.matchExplanation}
                    href={winnerHref}
                    detailLabel={t('matchViewDetailCta')}
                    metaRatingLabel={
                      winnerProduct?.rating != null
                        ? t('matchResultMetaRating', {
                            rating: winnerProduct.rating.toString(),
                            count: (winnerProduct.reviewCount ?? 0).toString(),
                          })
                        : ''
                    }
                    onClick={() =>
                      analytics.matchPageWinnerClick({
                        winnerId: winner.product_id,
                        destinationHref: winnerHref,
                      })
                    }
                  />
                  {alsoConsider.length > 0 ? (
                    <AlsoConsiderList
                      heading={t('matchAlsoConsiderHeading')}
                      items={alsoConsider}
                      detailLabel={t('matchViewDetailCta')}
                      locale={locale}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                    {t('matchNoMatchTitle')}
                  </p>
                  <p className="text-sm text-slate-700 md:text-base">{noMatchMessage}</p>
                </>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={backToPlanner}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
                >
                  {t('matchResultBackCta')}
                </button>
                <Link
                  href="/tours/list"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
                >
                  {t('matchSeeAllToursCta')}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </SitePageShell>
  );
}

// ===== Sub-components =====

function LoadingStepsRow({
  step,
  t,
}: {
  step: 0 | 1 | 2;
  t: (k: string) => string;
}) {
  const steps = [
    { key: 'matchLoadingAnalyzing' },
    { key: 'matchLoadingMatching' },
    { key: 'matchLoadingComplete' },
  ];
  return (
    <ol
      aria-live="polite"
      className="mt-5 flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/60 p-4"
    >
      {steps.map((s, i) => {
        const active = step === i;
        const done = step > i;
        return (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border',
                done
                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                  : active
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-400',
              )}
            >
              {done ? (
                <span className="text-[10px] leading-none">✓</span>
              ) : active ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              ) : (
                <span className="text-[10px] leading-none">{i + 1}</span>
              )}
            </span>
            <span
              className={cn(done || active ? 'font-medium text-slate-900' : 'text-slate-500')}
            >
              {t(s.key)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function WinnerCard({
  product,
  winnerId,
  explanation,
  href,
  detailLabel,
  metaRatingLabel,
  onClick,
}: {
  product: ReturnType<typeof getStaticTourProductBySlug>;
  winnerId: string;
  explanation: string | null;
  href: string;
  detailLabel: string;
  metaRatingLabel: string;
  onClick?: () => void;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/85 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.15)]">
      {product?.heroImage ? (
        <div className="relative aspect-[16/8] w-full">
          <Image
            src={product.heroImage}
            alt={product.title}
            fill
            sizes="(min-width: 768px) 640px, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="p-5 md:p-6">
        <h2 className="text-lg font-bold leading-snug text-slate-900 md:text-xl">
          {product?.title ?? winnerId}
        </h2>

        {product?.subtitle ? (
          <p className="mt-1 text-sm text-slate-600 md:text-[15px]">{product.subtitle}</p>
        ) : null}

        {explanation ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm italic text-slate-700">
            “{explanation}”
          </p>
        ) : null}

        <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-slate-600">
          {product?.priceLabel ? (
            <dd className="font-semibold text-slate-900">{product.priceLabel}</dd>
          ) : null}
          {product?.rating != null && metaRatingLabel ? (
            <dd className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
              {metaRatingLabel}
            </dd>
          ) : null}
          {product?.duration ? (
            <dd className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              {product.duration}
            </dd>
          ) : null}
          {product?.region ? (
            <dd className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              {product.region}
            </dd>
          ) : null}
        </dl>

        <Link
          href={href}
          onClick={onClick}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {detailLabel}
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function AlsoConsiderList({
  heading,
  items,
  detailLabel,
  locale,
}: {
  heading: string;
  items: ScoredProduct[];
  detailLabel: string;
  locale: import('@/lib/tour-product/resolveTourProductDbLocale').TourProductPageLocale;
}) {
  return (
    <div className="mt-6 border-t border-slate-200/70 pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {heading}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((p) => {
          const staticP = getStaticTourProductBySlug(p.product_id, locale);
          const href = staticP ? `/tour-product/${p.product_id}` : '/tours/list';
          return (
            <li key={p.product_id}>
              <Link
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 p-3 transition hover:border-slate-300 hover:bg-white"
              >
                {staticP?.thumbnail ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={staticP.thumbnail}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-100" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                    {staticP?.title ?? p.product_id}
                  </p>
                  {staticP?.priceLabel ? (
                    <p className="mt-0.5 text-xs text-slate-500">{staticP.priceLabel}</p>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-slate-500 transition group-hover:text-slate-800">
                  {detailLabel}
                </span>
                <ChevronRight
                  className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
