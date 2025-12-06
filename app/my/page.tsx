'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/mypage');
  }, [router]);

  return null;
}

