/**
 * East Signature 상품 EN 번들(JSON) 출력 — 번역 후 동일 형식으로 locale만 바꿔 돌려주면 됨.
 *
 *   npx tsx scripts/export-east-signature-locale-bundle-en.ts bundle.en.json
 *   (복사본에서 locale → ko 등으로 바꾸고 page·detail_payload 문자열만 번역)
 *   npx tsx scripts/build-tour-product-locale-upsert-sql.ts bundle.ko.json > upsert-ko.sql
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { eastSignatureNatureCoreStaticProduct } from "../components/product-tour-static/catalog/staticTourProductRegistry";
import { buildEastSignatureDetailPayloadForSupabase } from "../components/product-tour-static/east-signature-nature-core/buildDetailPayloadForSeed";
import { eastSignatureNatureCoreProduct } from "../components/product-tour-static/east-signature-nature-core/staticProductData";
import { eastSignatureNatureCoreDetailViewModel } from "../components/product-tour-static/east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
import type { TourProductLocaleBundle } from "../lib/tour-product/tourProductLocaleBundle";

const reg = eastSignatureNatureCoreStaticProduct;
const prod = eastSignatureNatureCoreProduct;
const vm = eastSignatureNatureCoreDetailViewModel;

const bundle: TourProductLocaleBundle = {
  slug: reg.slug,
  locale: "en",
  page: {
    title: reg.title,
    subtitle: reg.subtitle,
    region_label: reg.region,
    duration_label: reg.duration,
    card_short_description: reg.shortCardDescription,
    seo_title: `${reg.title} | AtoC Korea`,
    meta_description: prod.description,
    headline_line_1: vm.headlineLine1,
    headline_line_2: vm.headlineLine2,
    badges: [...reg.badges],
    detail_payload: buildEastSignatureDetailPayloadForSupabase(),
  },
};

const out = process.argv[2];
const text = `${JSON.stringify(bundle, null, 2)}\n`;
if (out) {
  writeFileSync(resolve(process.cwd(), out), text, "utf8");
} else {
  process.stdout.write(text);
}
