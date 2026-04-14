/**
 * `tour_product_full_page_v1` JSON (번역본) → `TourProductLocaleBundle` 변환.
 * matching_profile / matching_metadata / page_sections 등은 제외하고 detail_payload만 추출.
 *
 *   npx tsx scripts/convert-full-page-to-locale-bundle.ts <full-page.json> [out-bundle.json]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TourProductDetailPayloadV1 } from "../lib/tour-product/detailPayloadV1";
import type { TourProductLocaleBundle } from "../lib/tour-product/tourProductLocaleBundle";

const DETAIL_PAYLOAD_KEYS = [
  "schema_version",
  "sectionUi",
  "hero",
  "subnavItems",
  "glanceItems",
  "galleryItems",
  "itineraryStops",
  "routeFlowStops",
  "routePhases",
  "routeShapeIntro",
  "whyTourWorks",
  "practicalAccordionItems",
  "practicalWeatherStatic",
  "seasonalVariations",
  "bookingTrustItems",
  "bookingSupportSteps",
  "staticQuestions",
  "guestReviews",
  "reviewsSummary",
] as const;

function fullPageToBundle(raw: Record<string, unknown>): TourProductLocaleBundle {
  const catalog = raw.catalog_card as Record<string, unknown>;
  const seo = raw.seo as Record<string, unknown>;
  const price = raw.price as Record<string, unknown> | undefined;

  const detail_payload = {} as Record<string, unknown>;
  for (const k of DETAIL_PAYLOAD_KEYS) {
    if (k in raw) detail_payload[k] = raw[k];
  }

  /** `tour_product_pages.locale` / resolveTourProductDbLocale: URL·문서의 zh-CN → DB는 zh */
  const rawLocale = String(raw.locale);
  const dbLocale = rawLocale === "zh-CN" ? "zh" : rawLocale;

  const bundle: TourProductLocaleBundle = {
    slug: String(raw.slug),
    locale: dbLocale,
    page: {
      title: String(catalog.title),
      subtitle: String(catalog.subtitle),
      region_label: String(catalog.region),
      duration_label: String(catalog.duration),
      card_short_description: String(catalog.shortCardDescription),
      seo_title: String(seo.pageTitle),
      meta_description: String(seo.metaDescription),
      headline_line_1: String(raw.headlineLine1),
      headline_line_2: String(raw.headlineLine2),
      badges: (catalog.badges as string[]).filter((x) => typeof x === "string"),
      detail_payload: detail_payload as unknown as TourProductDetailPayloadV1,
    },
  };

  if (price && typeof price.per === "string" && price.per.trim() !== "") {
    bundle.page.price_per = price.per.trim();
  }
  if (price && typeof price.amountLabel === "string" && price.amountLabel.trim() !== "") {
    bundle.page.price_amount_label = price.amountLabel.trim();
  }
  if (price && typeof price.currency === "string" && price.currency.trim() !== "") {
    bundle.page.price_currency = price.currency.trim();
  }

  return bundle;
}

function main() {
  const inp = process.argv[2];
  const outp = process.argv[3];
  if (!inp) {
    console.error("Usage: npx tsx scripts/convert-full-page-to-locale-bundle.ts <full-page.json> [out.json]");
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), inp), "utf8")) as Record<string, unknown>;
  const bundle = fullPageToBundle(raw);
  const text = `${JSON.stringify(bundle, null, 2)}\n`;
  if (outp) {
    writeFileSync(resolve(process.cwd(), outp), text, "utf8");
  } else {
    process.stdout.write(text);
  }
}

main();
