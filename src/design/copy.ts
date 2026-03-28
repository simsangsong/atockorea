import copyEn from '@/messages/copy/en.json';

/** English default copy (server adapters, legacy imports). Client UI should use `useCopy()` from `@/lib/i18n`. */
export const COPY = copyEn;

export type Copy = typeof copyEn;
