'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { useMyPageSession } from './MyPageSessionProvider';

export function MyPageAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const { status, session } = useMyPageSession();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (status !== 'ready' || session) return;
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace(`/signin?redirect=${encodeURIComponent(pathname || '/mypage')}`);
  }, [pathname, router, session, status]);

  if (status !== 'ready' || !session) {
    return (
      <div
        className={cn(MYPAGE_SURFACE_PAGE, 'flex min-h-[40vh] items-center justify-center p-8')}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-800 border-t-transparent" />
          <p className="text-[13px] font-medium text-slate-600">{t('mypage.common.verifyingSession')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
