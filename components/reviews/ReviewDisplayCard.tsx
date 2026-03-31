import Image from 'next/image';
import { cn } from '@/lib/utils';

export type ReviewDisplayData = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  images: string[];
  created_at: string;
  is_shadow?: boolean;
  is_anonymous?: boolean;
  tours: { id: string; title: string } | null;
  user_profiles: { id: string | null; full_name: string | null; avatar_url: string | null } | null;
};

function collectImages(row: Record<string, unknown>): string[] {
  const raw = row.images;
  if (Array.isArray(raw)) {
    return raw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  }
  if (raw == null) return [];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.filter((u): u is string => typeof u === 'string' && u.trim().length > 0) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Normalize API / server review rows to display props. Uses `images` only (never photos).
 */
export function reviewRowToDisplayData(row: Record<string, unknown>): ReviewDisplayData | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const rating = typeof row.rating === 'number' ? row.rating : null;
  if (!id || rating == null) return null;
  const title = row.title == null ? null : String(row.title).trim() || null;
  const comment = row.comment == null ? null : String(row.comment);
  const created_at = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
  const is_shadow = Boolean(row.is_shadow);
  const is_anonymous = Boolean(row.is_anonymous);
  const toursRaw = row.tours;
  let tours: ReviewDisplayData['tours'] = null;
  if (
    toursRaw &&
    typeof toursRaw === 'object' &&
    toursRaw !== null &&
    'id' in toursRaw &&
    'title' in toursRaw &&
    typeof (toursRaw as { id: unknown }).id === 'string' &&
    typeof (toursRaw as { title: unknown }).title === 'string'
  ) {
    tours = { id: (toursRaw as { id: string }).id, title: (toursRaw as { title: string }).title };
  }
  const up = row.user_profiles;
  let user_profiles: ReviewDisplayData['user_profiles'] = null;
  if (up && typeof up === 'object' && up !== null) {
    user_profiles = {
      id: 'id' in up && typeof (up as { id: unknown }).id === 'string' ? (up as { id: string }).id : null,
      full_name: 'full_name' in up && (up as { full_name: unknown }).full_name != null
        ? String((up as { full_name: unknown }).full_name)
        : null,
      avatar_url:
        'avatar_url' in up && (up as { avatar_url: unknown }).avatar_url != null
          ? String((up as { avatar_url: unknown }).avatar_url)
          : null,
    };
  }
  return {
    id,
    rating,
    title,
    comment,
    images: collectImages(row),
    created_at,
    is_shadow,
    is_anonymous,
    tours,
    user_profiles,
  };
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={value >= star ? 'text-amber-400' : 'text-slate-200'}>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </span>
      ))}
    </div>
  );
}

export type ReviewDisplayCardProps = {
  review: ReviewDisplayData;
  /** Homepage: first image only. Full page: compact grid for multiple `images`. */
  variant: 'compact' | 'list';
  className?: string;
  /** When true, show shadow badge (author-only / low-rating reviews in “my” area). */
  showShadowBadge?: boolean;
};

export default function ReviewDisplayCard({
  review,
  variant,
  className = '',
  showShadowBadge = false,
}: ReviewDisplayCardProps) {
  const displayName = review.is_anonymous
    ? 'Anonymous'
    : review.user_profiles?.full_name?.trim() || 'Traveler';
  const dateLabel = new Date(review.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const imgs = review.images;
  const showGrid = variant === 'list' && imgs.length > 1;

  return (
    <article
      className={cn(
        variant === 'compact'
          ? 'home-neutral-review-card p-5 sm:p-6'
          : 'rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {variant === 'compact' && imgs[0] ? (
          <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl border border-slate-100 sm:h-24 sm:w-32">
            <Image src={imgs[0]} alt="" fill className="object-cover" sizes="(max-width:640px) 100vw, 8rem" />
          </div>
        ) : null}
        {variant === 'list' && imgs.length > 0 ? (
          <div
            className={
              showGrid
                ? 'grid shrink-0 grid-cols-2 gap-1.5 sm:w-[7.5rem]'
                : 'relative h-24 w-full shrink-0 overflow-hidden rounded-xl border border-slate-100 sm:h-24 sm:w-32'
            }
          >
            {showGrid
              ? imgs.slice(0, 4).map((url, i) => (
                  <div key={`${url}-${i}`} className="relative aspect-square overflow-hidden rounded-lg border border-slate-100">
                    <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                  </div>
                ))
              : (
                  <Image src={imgs[0]} alt="" fill className="object-cover" sizes="128px" />
                )}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Stars value={review.rating} />
            <span className="font-bold tracking-[-0.02em] text-slate-800">{displayName}</span>
            <span className="tabular-nums">{dateLabel}</span>
            {showShadowBadge && review.is_shadow ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200/80">
                Visible only to you
              </span>
            ) : null}
          </div>

          {review.tours?.title ? (
            <p className="mt-2 text-xs font-medium text-slate-600">
              Tour: <span className="text-slate-800">{review.tours.title}</span>
            </p>
          ) : null}

          {review.title ? (
            <h3
              className={cn(
                'mt-2 text-sm text-slate-900',
                variant === 'compact' ? 'font-black tracking-tight' : 'font-semibold',
              )}
            >
              {review.title}
            </h3>
          ) : null}

          {review.comment ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{review.comment}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Rated {review.rating} out of 5.</p>
          )}
        </div>
      </div>
    </article>
  );
}
