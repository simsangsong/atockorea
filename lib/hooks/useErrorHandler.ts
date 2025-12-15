'use client';

import { useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useRouter } from 'next/navigation';

/**
 * Custom hook for handling errors in client components
 */
export function useErrorHandler() {
  const router = useRouter();

  const handleError = useCallback((error: unknown, context?: string) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));

    logger.error(
      context ? `${context}: ${errorMessage}` : errorMessage,
      errorObj,
      {
        context,
        url: window.location.href,
      }
    );

    // Show user-friendly error message
    // You can customize this to show toast notifications, modals, etc.
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      router.push('/signin?redirect=' + encodeURIComponent(window.location.pathname));
    }
  }, [router]);

  const handleAsyncError = useCallback(
    async <T,>(
      asyncFn: () => Promise<T>,
      context?: string
    ): Promise<T | null> => {
      try {
        return await asyncFn();
      } catch (error) {
        handleError(error, context);
        return null;
      }
    },
    [handleError]
  );

  return {
    handleError,
    handleAsyncError,
  };
}

