'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Ensures only signed-in users see mypage content. Redirects to /signin?redirect=…
 */
export function MyPageAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        if (!supabase) {
          if (!cancelled) router.replace(`/signin?redirect=${encodeURIComponent(pathname || '/mypage')}`);
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          router.replace(`/signin?redirect=${encodeURIComponent(pathname || '/mypage')}`);
          return;
        }
        setReady(true);
      } catch {
        if (!cancelled) router.replace(`/signin?redirect=${encodeURIComponent(pathname || '/mypage')}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-[1.75rem] border border-white/25 bg-white/55 p-8 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
