import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { TourDetailTemplateView } from '@/components/tour-detail-template';
import { adaptTourDetailResponse } from '@/src/lib/adapters/tours-adapter';

/** Only these slugs may be viewed on this route (safe preview). */
const ALLOWED_SLUGS = new Set(['jeju-east-small-group-template-preview', 'east-signature-nature-core']);

export const metadata: Metadata = {
  title: 'Tour detail template preview',
  robots: { index: false, follow: false },
};

/** Avoid static shell that only shows "Loading…" until client fetch runs. */
export const dynamic = 'force-dynamic';

function pickLocale(searchParams: { locale?: string | string[] }): string {
  const raw = searchParams.locale;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && v.trim() !== '' ? v : 'en';
}

export default async function TourTemplatePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locale?: string | string[] }>;
}) {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.has(slug)) {
    notFound();
  }

  const sp = await searchParams;
  const locale = pickLocale(sp);

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const apiUrl = `${proto}://${host}/api/tours/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`;

  let tour = null;
  let error: string | null = null;

  try {
    const res = await fetch(apiUrl, { cache: 'no-store' });
    if (!res.ok) {
      error = res.status === 404 ? 'Tour not found' : `Failed to load tour (${res.status})`;
    } else {
      const data = await res.json();
      tour = adaptTourDetailResponse(data, slug);
      if (!tour) {
        error = 'Tour data could not be adapted (check server console for zod errors).';
      }
    }
  } catch {
    error = 'Failed to reach tour API. Is `npm run dev` running and env pointing at the same DB as Supabase?';
  }

  if (error || !tour) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-red-600">{error ?? 'Unknown error'}</p>
        <p className="text-xs text-gray-500">
          Slug: {slug} · locale: {locale}
        </p>
        <p className="max-w-md text-xs text-gray-500">
          직접 확인: <code className="rounded bg-gray-100 px-1">{apiUrl}</code>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[11px] font-medium text-amber-950">
        Preview only — v0 detail template with live API data. Not the production tour page. Slug: {slug}
      </div>
      <TourDetailTemplateView tour={tour} />
    </>
  );
}
