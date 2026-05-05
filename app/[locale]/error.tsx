'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { isChunkLoadError, NEXT_DEV_CHUNK_RELOAD_KEY } from '@/lib/dev-chunk-recovery';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      console.error('[locale]', error?.message ?? error);
    } catch {
      // Do not throw; keep error UI visible
    }
  }, [error]);

  /** Same as root `app/error.tsx`: stale chunk manifests after HMR / restart often recover after one full reload. */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !isChunkLoadError(error)) return;
    try {
      const pending = sessionStorage.getItem(NEXT_DEV_CHUNK_RELOAD_KEY);
      if (!pending) {
        sessionStorage.setItem(NEXT_DEV_CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return;
      }
      sessionStorage.removeItem(NEXT_DEV_CHUNK_RELOAD_KEY);
    } catch {
      // ignore
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          We couldn’t load this page. Please try again or go back to the home page.
        </p>
        {process.env.NODE_ENV === 'development' && isChunkLoadError(error) && (
          <p className="mb-6 text-left text-xs leading-relaxed text-amber-900/90 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Dev: If this keeps happening after an automatic retry, stop{' '}
            <code className="rounded bg-amber-100/80 px-1">npm run dev</code>, run{' '}
            <code className="rounded bg-amber-100/80 px-1">npm run clean</code>, restart the dev server, then hard-refresh
            (Ctrl+Shift+R).
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
