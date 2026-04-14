"use client";

import { shouldUseLegacyHomepage } from "@/lib/homepage-body-variant";
import LegacyHomePage from "@/components/home/legacy/LegacyHomePage";
import HomeV2Page from "@/components/home/v2/HomeV2Page";

/** Renders v2 (v0-derived) body by default; legacy body when `NEXT_PUBLIC_USE_LEGACY_HOMEPAGE` is set. */
export function HomeMainBody() {
  return shouldUseLegacyHomepage() ? <LegacyHomePage /> : <HomeV2Page />;
}
