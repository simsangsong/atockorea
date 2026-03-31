"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { getSiteCopyBaseline } from "@/src/lib/site-copy-data";
import type { Locale } from "@/lib/locale";
import type { SiteCopy } from "@/src/lib/site-copy-data";

export type { SiteCopy };

/** Localized marketing/product copy (replaces static `COPY` from design/copy). */
export function useSiteCopy(): SiteCopy {
  const { locale } = useI18n();
  return useMemo(() => getSiteCopyBaseline(locale as Locale), [locale]);
}
