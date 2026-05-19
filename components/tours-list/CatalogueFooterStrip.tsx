'use client';

import React from 'react';
import { useTranslations } from '@/lib/i18n';
import {
  LIST_CURATOR_CLS,
  LIST_CURATOR_RULE_CLS,
  LIST_EYEBROW_CLS,
} from '@/lib/tours-list-tokens';

/**
 * Footer strip mounted at the end of the catalogue grid (between the last load
 * batch and the page footer). Closes the magazine cover↔directory pairing
 * opened by `CatalogueHero` with a curator signature — the reader has just
 * walked the entire catalogue, the byline reminds them whose hands shaped it.
 *
 * Phase 1 (master plan §6.1.6). i18n keys come from Phase 0.4
 * (`toursList.footerCuratorLine` — 6 locales × 1 key).
 *
 * Anti-downgrade guards honored:
 *  • B1 — ivory-amber family (no slate-only)
 *  • B14 — i18n 6 locales mandatory (single key, all 6 present)
 *  • B16 — italic-serif curator signature matches hub/list-hero family
 */

interface CatalogueFooterStripProps {
  /** Total tour count — interpolates into the curator signature line. */
  count: number;
}

export function CatalogueFooterStrip({ count }: CatalogueFooterStripProps) {
  const t = useTranslations();
  const footerLine = t('toursList.footerCuratorLine', { count });

  return (
    <footer
      className="mx-auto mt-10 w-full max-w-5xl px-4 pb-2 pt-8 sm:mt-12 sm:px-6 sm:pt-10"
      aria-label="Catalogue editorial footer"
    >
      <div className="flex flex-col items-center gap-3 border-t border-amber-200/50 pt-7 text-center sm:gap-3.5">
        <span className={LIST_EYEBROW_CLS}>The Catalogue</span>
        <p className={`${LIST_CURATOR_CLS} max-w-[640px] text-balance leading-[1.6]`}>
          <span className={LIST_CURATOR_RULE_CLS} aria-hidden />
          {footerLine}
        </p>
      </div>
    </footer>
  );
}
