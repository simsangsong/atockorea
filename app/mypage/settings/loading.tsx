import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { MyPageHeaderSkeleton } from '@/components/mypage/MyPageSkeletons';

/** Settings shape — header + a form card with labelled input rows. */
export default function SettingsLoading() {
  return (
    <div className="space-y-4">
      <MyPageHeaderSkeleton />
      <div className={cn(MYPAGE_SURFACE_PAGE, 'space-y-5 p-6 md:p-7')}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200/70" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-slate-200/60" />
          </div>
        ))}
        <div className="h-11 w-36 animate-pulse rounded-xl bg-slate-200/70" />
      </div>
    </div>
  );
}
