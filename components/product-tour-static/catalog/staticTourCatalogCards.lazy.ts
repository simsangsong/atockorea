"use client";

/**
 * Client-bundle-friendly catalog access (D1, 2026-07-05): ships ONLY the EN
 * catalog pages inline and lazy-imports the active locale's pages on demand.
 * Mirrors the i18n message-loading pattern (`lib/i18n.ts`
 * ensureLocaleMessages): non-EN visitors briefly see EN card copy, then the
 * locale chunk resolves and the subscribed components re-render — the same
 * graceful fallback every other UI string on the site already has.
 *
 * Why: `staticTourCatalogCards.ts` statically imports the combined 6-locale
 * generated module (~60KB gz / ~230KB parse), which was riding into the
 * /tours/list initial JS via ShelvesContainer. One locale is ~1/6 of that.
 *
 * SSR/hydration: the server snapshot always builds from EN (version 0), and
 * the client's first render does too (`useI18n` also boots as "en"), so
 * there's no mismatch; locale data lands via effects only.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { TourProductPageLocale as Locale } from "@/lib/tour-product/resolveTourProductDbLocale";
import type { SlimCatalogPage } from "./catalogCards.generated";
import { PAGES as EN_PAGES } from "./catalogCards.en.generated";
import { SLIM_CATALOG_SLUG_ORDER } from "./catalogCards.slugs.generated";
import {
  buildCatalogRegistrations,
  type StaticTourProductRegistration,
} from "./catalogRegistrationBuilder";

type PagesMap = Record<string, SlimCatalogPage>;

const loadedPages: Partial<Record<Locale, PagesMap>> = { en: EN_PAGES };
const inFlight = new Set<Locale>();
let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion(): number {
  return version;
}

function getServerVersion(): number {
  return 0;
}

// Explicit loader map (not a template-literal import) so webpack emits one
// deterministic chunk per locale.
const LOCALE_LOADERS: Partial<Record<Locale, () => Promise<{ PAGES: PagesMap }>>> = {
  ko: () => import("./catalogCards.ko.generated"),
  zh: () => import("./catalogCards.zh.generated"),
  "zh-TW": () => import("./catalogCards.zh-TW.generated"),
  es: () => import("./catalogCards.es.generated"),
  ja: () => import("./catalogCards.ja.generated"),
};

function ensureLocaleCatalog(locale: Locale): void {
  if (loadedPages[locale] || inFlight.has(locale)) return;
  const loader = LOCALE_LOADERS[locale];
  if (!loader) return;
  inFlight.add(locale);
  void loader()
    .then((mod) => {
      loadedPages[locale] = mod.PAGES;
      version += 1;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      // Chunk load failure — keep the EN fallback (graceful, no crash),
      // and leave the locale retryable on the next mount.
    })
    .finally(() => {
      inFlight.delete(locale);
    });
}

/**
 * Locale-aware catalog registrations with EN fallback until the locale chunk
 * arrives. Drop-in for `listStaticTourProducts(locale)` in client components.
 */
export function useStaticTourProductsLazy(
  locale: Locale,
): readonly StaticTourProductRegistration[] {
  const v = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  useEffect(() => {
    ensureLocaleCatalog(locale);
  }, [locale]);
  return useMemo(() => {
    void v; // re-build when a locale chunk resolves
    return buildCatalogRegistrations(
      SLIM_CATALOG_SLUG_ORDER,
      loadedPages[locale] ?? EN_PAGES,
      EN_PAGES,
    );
  }, [locale, v]);
}
