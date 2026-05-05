'use client';

// Force dynamic rendering for error pages
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { isChunkLoadError, NEXT_DEV_CHUNK_RELOAD_KEY } from '@/lib/dev-chunk-recovery';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    try {
      console.error('Page error', error?.message ?? '(no message)', error?.digest);
    } catch {
      // Avoid breaking the error UI if logging fails
    }
  }, [error]);

  /** Dev-only: stale chunk manifests after HMR / server restart often fix themselves after one full reload. */
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 p-4">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-8 max-w-2xl w-full">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">
            We encountered an error while loading this page. Please try again.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
              <p className="text-sm font-semibold text-red-800 mb-2">Error Details:</p>
              <p className="text-sm text-red-700 font-mono mb-2">
                {error.name}: {error.message ?? 'Unknown error'}
              </p>
              {error.digest && (
                <p className="text-xs text-red-600">Error ID: {error.digest}</p>
              )}
              {isChunkLoadError(error) && (
                <p className="mt-3 text-xs leading-relaxed text-red-800/90">
                  If this persists after an automatic retry: stop <code className="rounded bg-red-100 px-1">npm run dev</code>,
                  delete the <code className="rounded bg-red-100 px-1">.next</code> folder, restart the dev server, then hard-refresh
                  the browser (Ctrl+Shift+R). Same-origin <code className="rounded bg-red-100 px-1">http://localhost:3000</code>{' '}
                  avoids mixed HTTPS/HTTP chunk issues.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-4 justify-center mt-6">
            <button
              onClick={reset}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}













