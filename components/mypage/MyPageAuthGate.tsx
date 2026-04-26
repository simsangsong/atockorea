'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

/**
 * MyPage 접근 가드.
 * - 세션 확인 시 일시적 네트워크 오류로 즉시 /signin으로 튕기지 않도록 1회 재시도.
 * - `onAuthStateChange` 구독으로 다른 탭/창에서의 로그아웃 즉시 반영.
 */
export function MyPageAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const [status, setStatus] = useState<'checking' | 'ready'>('checking');
  const redirectingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const redirectToSignIn = () => {
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      router.replace(`/signin?redirect=${encodeURIComponent(pathname || '/mypage')}`);
    };

    const getSessionWithRetry = async (): Promise<unknown> => {
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) return null;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
      } catch {
        // network blip — 재시도 1회
        await new Promise((r) => setTimeout(r, 600));
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) return data.session;
        } catch {
          // fall through
        }
      }
      return null;
    };

    (async () => {
      const session = await getSessionWithRetry();
      if (cancelled) return;
      if (!session) {
        redirectToSignIn();
        return;
      }
      setStatus('ready');

      const { supabase } = await import('@/lib/supabase');
      if (!supabase || cancelled) return;
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          redirectToSignIn();
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [pathname, router]);

  if (status !== 'ready') {
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
