'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';

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
      <div className="flex min-h-[40vh] items-center justify-center rounded-[1.75rem] border border-white/25 bg-white/55 p-8 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-600">{t('mypage.bookingsLoading')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
