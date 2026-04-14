/**
 * 번역 완료 JSON 번들 → Supabase `tour_product_pages` upsert SQL 생성.
 *
 * 사용:
 *   npx tsx scripts/build-tour-product-locale-upsert-sql.ts path/to/bundle.ko.json [out.sql]
 *
 * (번들 만들기: npm run export:tour-product-bundle-en -- path/to/bundle.en.json)
 *
 * 전제: 동일 `slug`에 `locale = 'en'` 행이 있어야 함 (이미지·tour_id·가격 컬럼을 EN에서 복사).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isTourProductLocaleBundle,
  type TourProductLocaleBundle,
} from "../lib/tour-product/tourProductLocaleBundle";

function sqlStr(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function sqlTextArray(arr: string[]): string {
  return `ARRAY[${arr.map((x) => sqlStr(x)).join(", ")}]::text[]`;
}

function sqlJsonb(obj: unknown): string {
  return `${sqlStr(JSON.stringify(obj))}::jsonb`;
}

function buildSql(bundle: TourProductLocaleBundle): string {
  const { slug, locale, page } = bundle;
  const p = page;

  const priceAmountExpr =
    p.price_amount_label != null && p.price_amount_label !== ""
      ? sqlStr(p.price_amount_label)
      : "en.price_amount_label";
  const priceCurrencyExpr =
    p.price_currency != null && p.price_currency !== "" ? sqlStr(p.price_currency) : "en.price_currency";
  const pricePerExpr =
    p.price_per != null && p.price_per !== "" ? sqlStr(p.price_per) : "en.price_per";

  return `-- locale: ${locale} | slug: ${slug}
-- Source: EN row copies tour_id, images, price columns (unless overridden), counts, publish flags.
BEGIN;

INSERT INTO public.tour_product_pages (
  slug, locale, is_published, sort_order, tour_id,
  title, subtitle, region_label, duration_label, stops_count,
  rating_avg, review_count, badges, hero_image_url, thumbnail_url,
  card_short_description, seo_title, meta_description,
  headline_line_1, headline_line_2,
  price_amount_label, price_currency, price_per,
  detail_payload
)
SELECT
  en.slug,
  ${sqlStr(locale)},
  en.is_published,
  en.sort_order,
  en.tour_id,
  ${sqlStr(p.title)},
  ${sqlStr(p.subtitle)},
  ${sqlStr(p.region_label)},
  ${sqlStr(p.duration_label)},
  en.stops_count,
  en.rating_avg,
  en.review_count,
  ${sqlTextArray(p.badges)},
  en.hero_image_url,
  en.thumbnail_url,
  ${sqlStr(p.card_short_description)},
  ${sqlStr(p.seo_title)},
  ${sqlStr(p.meta_description)},
  ${sqlStr(p.headline_line_1)},
  ${sqlStr(p.headline_line_2)},
  ${priceAmountExpr},
  ${priceCurrencyExpr},
  ${pricePerExpr},
  ${sqlJsonb(p.detail_payload)}
FROM public.tour_product_pages en
WHERE en.slug = ${sqlStr(slug)} AND en.locale = 'en'
ON CONFLICT (slug, locale) DO UPDATE SET
  is_published = EXCLUDED.is_published,
  tour_id = EXCLUDED.tour_id,
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  region_label = EXCLUDED.region_label,
  duration_label = EXCLUDED.duration_label,
  stops_count = EXCLUDED.stops_count,
  rating_avg = EXCLUDED.rating_avg,
  review_count = EXCLUDED.review_count,
  badges = EXCLUDED.badges,
  hero_image_url = EXCLUDED.hero_image_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  card_short_description = EXCLUDED.card_short_description,
  seo_title = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  headline_line_1 = EXCLUDED.headline_line_1,
  headline_line_2 = EXCLUDED.headline_line_2,
  price_amount_label = EXCLUDED.price_amount_label,
  price_currency = EXCLUDED.price_currency,
  price_per = EXCLUDED.price_per,
  detail_payload = EXCLUDED.detail_payload,
  updated_at = NOW();

COMMIT;
`;
}

function main() {
  const file = process.argv[2];
  const outFile = process.argv[3];
  if (!file) {
    console.error(
      "Usage: npx tsx scripts/build-tour-product-locale-upsert-sql.ts <bundle.json> [out.sql]",
    );
    process.exit(1);
  }
  const raw = readFileSync(resolve(process.cwd(), file), "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON:", e);
    process.exit(1);
  }
  if (!isTourProductLocaleBundle(json)) {
    console.error(
      "Invalid bundle: need slug, locale, page.{title,subtitle,region_label,duration_label,card_short_description,seo_title,meta_description,headline_line_1,headline_line_2,badges,detail_payload} and detail_payload.schema_version === 1",
    );
    process.exit(1);
  }
  const sql = buildSql(json);
  if (outFile) {
    writeFileSync(resolve(process.cwd(), outFile), sql, "utf8");
  } else {
    process.stdout.write(sql);
  }
}

main();
