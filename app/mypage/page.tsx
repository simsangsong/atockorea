'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * MyPage root.
 * - Mobile: layout renders the profile card + navigation on root, so this page is empty.
 * - Desktop (md+): redirect to dashboard since the sidebar already shows on every child route.
 */
export default function MyPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      router.replace('/mypage/dashboard');
    }
  }, [router]);

  return null;
}
