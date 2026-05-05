/** Session flag for one automatic reload after ChunkLoadError in development (see app/error.tsx). */
export const NEXT_DEV_CHUNK_RELOAD_KEY = 'next_dev_chunk_reload_pending';

export function isChunkLoadError(error: Error): boolean {
  const msg = error?.message ?? '';
  return (
    error?.name === 'ChunkLoadError' ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk') ||
    msg.includes('chunk failed')
  );
}
