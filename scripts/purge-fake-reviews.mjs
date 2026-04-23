/**
 * 모든 tour-product JSON bundle에서 가짜 `guestReviews` / `reviewsSummary`를 제거.
 *
 * - 최상위 `guestReviews` → `[]`, `reviewsSummary` → zero-filled
 * - `page_sections[].component === "TourReviewsSection"`의 `props` 도 동일 처리
 *
 * 실 공개 리뷰는 런타임에 `assembleTourProductReviews` 가
 * Supabase `public.reviews` 에서 집계하여 주입. JSON은 빈 상태만 유지.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const productRoot = join(root, "components/product-tour-static");

const EMPTY_SUMMARY = {
  averageRating: 0,
  totalReviews: 0,
  ratingDistribution: [
    { stars: 5, count: 0, percentage: 0 },
    { stars: 4, count: 0, percentage: 0 },
    { stars: 3, count: 0, percentage: 0 },
    { stars: 2, count: 0, percentage: 0 },
    { stars: 1, count: 0, percentage: 0 },
  ],
  highlights: [],
};

function listProductJsonFiles() {
  const slugs = readdirSync(productRoot).filter((d) => {
    const p = join(productRoot, d);
    return statSync(p).isDirectory() && !d.startsWith("_") && d !== "catalog";
  });
  const files = [];
  for (const slug of slugs) {
    const slugDir = join(productRoot, slug);
    for (const f of readdirSync(slugDir)) {
      if (!f.endsWith(".json")) continue;
      if (!f.startsWith(`${slug}.`)) continue;
      files.push(join(slugDir, f));
    }
  }
  return files;
}

function purge(json) {
  let touched = false;
  if (Array.isArray(json.guestReviews) && json.guestReviews.length > 0) {
    json.guestReviews = [];
    touched = true;
  } else if (!("guestReviews" in json)) {
    json.guestReviews = [];
    touched = true;
  }

  if (
    !json.reviewsSummary ||
    typeof json.reviewsSummary !== "object" ||
    (typeof json.reviewsSummary.totalReviews === "number" && json.reviewsSummary.totalReviews !== 0)
  ) {
    json.reviewsSummary = JSON.parse(JSON.stringify(EMPTY_SUMMARY));
    touched = true;
  }

  if (Array.isArray(json.page_sections)) {
    for (const section of json.page_sections) {
      if (section && section.component === "TourReviewsSection" && section.props && typeof section.props === "object") {
        if (Array.isArray(section.props.guestReviews) && section.props.guestReviews.length > 0) {
          section.props.guestReviews = [];
          touched = true;
        }
        if (
          section.props.reviewsSummary &&
          typeof section.props.reviewsSummary === "object" &&
          typeof section.props.reviewsSummary.totalReviews === "number" &&
          section.props.reviewsSummary.totalReviews !== 0
        ) {
          section.props.reviewsSummary = JSON.parse(JSON.stringify(EMPTY_SUMMARY));
          touched = true;
        }
      }
    }
  }

  return touched;
}

function main() {
  const files = listProductJsonFiles();
  let changed = 0;
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    let doc;
    try {
      doc = JSON.parse(raw);
    } catch (e) {
      console.warn(`[skip] ${file}: ${e.message}`);
      continue;
    }
    const dirty = purge(doc);
    if (dirty) {
      writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
      console.log(`[purged] ${file}`);
      changed++;
    } else {
      console.log(`[ok]     ${file}`);
    }
  }
  console.log(`\n${changed} file(s) purged.`);
}

main();
