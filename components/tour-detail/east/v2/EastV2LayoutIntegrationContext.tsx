'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type EastV2LayoutIntegration = {
  /** Tailwind position `top-*` when section subnav is sticky (below site header / preview chrome). */
  stickySubnavTopClass: string;
  scrollToSectionOffsetPx: number;
  scrollSpyViewportOffsetPx: number;
};

const defaultIntegration: EastV2LayoutIntegration = {
  stickySubnavTopClass: 'top-[3.25rem] sm:top-14 md:top-[3.75rem]',
  scrollToSectionOffsetPx: 96,
  scrollSpyViewportOffsetPx: 168,
};

const EastV2LayoutIntegrationContext = createContext<EastV2LayoutIntegration>(defaultIntegration);

export function EastV2LayoutIntegrationProvider({
  stickySubnavTopClass,
  scrollToSectionOffsetPx,
  scrollSpyViewportOffsetPx,
  children,
}: Partial<EastV2LayoutIntegration> & { children: ReactNode }) {
  const merged = useMemo(
    () => ({
      stickySubnavTopClass: stickySubnavTopClass ?? defaultIntegration.stickySubnavTopClass,
      scrollToSectionOffsetPx: scrollToSectionOffsetPx ?? defaultIntegration.scrollToSectionOffsetPx,
      scrollSpyViewportOffsetPx: scrollSpyViewportOffsetPx ?? defaultIntegration.scrollSpyViewportOffsetPx,
    }),
    [stickySubnavTopClass, scrollToSectionOffsetPx, scrollSpyViewportOffsetPx],
  );
  return (
    <EastV2LayoutIntegrationContext.Provider value={merged}>{children}</EastV2LayoutIntegrationContext.Provider>
  );
}

export function useEastV2LayoutIntegration() {
  return useContext(EastV2LayoutIntegrationContext);
}
