#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(scriptDir, "..");
const publicDir = path.join(repo, "public");
const outputDir = path.join(publicDir, "images", "tours", "catalog-thumbnails");
const reportDir = path.join(repo, "output", "tour-thumbnail-upgrade-2026-08-08");

const selections = [
  {
    slug: "jeju-grand-highlights-loop",
    source: "public/images/tours/jusangjeolli/kakaotalk-20260510-230028438-12.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "Aerial Jusangjeolli makes the island-scale loop feel immediate and premium.",
  },
  {
    slug: "jeju-cruise-shore-excursion-small-group-tour",
    source: "public/images/tours/seongsan-ilchulbong/01-kakaotalk-20260510-230028438-06.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "The classic Seongsan view is legible at card size and anchors the cruise route.",
  },
  {
    slug: "busan-small-group-sightseeing-tour-cruise-passengers",
    source: "public/images/tours/busan-tower/01-kakaotalk-20260510-230009595.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "Busan Tower at blue hour separates this city highlights card from the coast tours.",
  },
  {
    slug: "busan-top-attractions-day-tour",
    source: "public/images/tours/haedong-yonggungsa/haedong-yonggungsa-sunset-cliff.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "Haedong Yonggungsa is the tour's strongest destination signal.",
  },
  {
    slug: "southwest-hallasan-osulloc-aewol",
    source: "public/images/tours/osulloc-tea/01-chatgpt-image-2026-5-11-12-23-19.webp",
    focal: "attention",
    treatment: "local-ai-source",
    rationale: "Graphic tea rows distinguish the southwest route from the full-island Jeju cards.",
  },
  {
    slug: "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip",
    source: "public/images/tours/naksansa-temple/naksansa-uisangdae-pavilion.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "The ocean pavilion communicates temple and coast in one frame.",
  },
  {
    slug: "seoul-seoraksan-nami-island-morning-calm-day-tour",
    source: "public/images/tours/seoraksan-national-park/photo-001.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "Autumn Seoraksan provides the strongest seasonal nature promise.",
  },
  {
    slug: "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour",
    source: "assets/tour-thumbnails/ai-sources/seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour.png",
    focal: "attention",
    treatment: "new-ai-source",
    rationale: "A realistic Eobi ice wall fixes the previous non-winter mismatch.",
  },
  {
    slug: "busan-cruise-shore-excursion-bus-tour",
    source: "public/images/tours/songdo-beach/01-chatgpt-image-2026-5-10-12-32-12.webp",
    focal: "attention",
    treatment: "local-ai-source",
    rationale: "Bright Songdo coastline is more compelling than the previous memorial flags.",
  },
  {
    slug: "busan-private-car-charter-cruise-shore",
    source: "assets/tour-thumbnails/ai-sources/busan-private-car-charter-cruise-shore.png",
    focal: "attention",
    treatment: "new-ai-source",
    rationale: "The cruise ship and private pickup service are readable in the same frame.",
  },
  {
    slug: "incheon-seoul-private-car-shore-excursion-cruise",
    source: "public/images/tours/gyeongbokgung/01-chatgpt-image-2026-5-11-12-21-39.webp",
    focal: "attention",
    treatment: "local-ai-source",
    rationale: "Gyeongbokgung is the clearest aspirational Seoul destination for shore guests.",
  },
  {
    slug: "busan-small-group-yonggungsa-skycapsule-gamcheon-tour",
    source: "public/images/tours/cheongsapo-blue-line/04-chatgpt-image-2026-5-10-12-53-23.webp",
    focal: "attention",
    treatment: "local-ai-source",
    rationale: "Colorful Sky Capsules create a distinct, high-recognition Busan card.",
  },
  {
    slug: "busan-private-car-charter-city-tour",
    source: "assets/tour-thumbnails/ai-sources/busan-private-car-charter-city-tour.png",
    focal: "attention",
    treatment: "new-ai-source",
    rationale: "The private vehicle and Gwangan Bridge communicate both service and place.",
  },
  {
    slug: "jeju-island-private-car-charter-tour",
    source: "public/images/tours/jeju-private/jeju-private-thumbnail-carnival-coast.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "The existing coast-and-vehicle composition already expresses private Jeju travel well.",
  },
  {
    slug: "seoul-suburbs-private-chartered-car-10hr",
    source: "public/images/tours/seoul-private-charter/seoul-private-carnival-han-river-night.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "The night vehicle scene retains the strongest premium charter identity.",
  },
  {
    slug: "from-busan-gyeongju-ancient-capital-day-tour",
    source: "public/images/tours/woljeonggyo/02-kakaotalk-20260509-231543723-07.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "Illuminated Woljeonggyo accurately replaces the former bamboo mismatch.",
  },
  {
    slug: "jeju-eastern-unesco-spots-day-tour",
    source: "public/images/tours/seongsan-ilchulbong/seongsan-haenyeo-show-ai.webp",
    focal: "attention",
    treatment: "local-ai-source",
    rationale: "Seongsan and the haenyeo experience communicate two eastern-route signatures.",
  },
  {
    slug: "jeju-southern-top-unesco-spots-tour",
    source: "public/images/tours/jeongbang-falls/kakaotalk-20260510-230028438-16.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "A clean panoramic Jeongbang view reads better than the previous crowded crop.",
  },
  {
    slug: "seoul-suwon-hwaseong-folk-village-starfield-library",
    source: "public/images/tours/korean-folk-village/02-kakaotalk-20260509-223603273-13.webp",
    focal: "attention",
    treatment: "local-photo",
    rationale: "A real folk performance gives this Suwon variant a unique cultural promise.",
  },
  {
    slug: "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
    source: "public/images/tours/gwangmyeong-cave/02-chatgpt-image-2026-5-10-12-03-15.webp",
    focal: "attention",
    treatment: "local-ai-source",
    rationale: "The luminous cave installation differentiates this itinerary at a glance.",
  },
  {
    slug: "seoul-suwon-hwaseong-waujeongsa-starfield",
    source: "public/images/tours/waujeongsa/05-chatgpt-image-2026-5-10-12-07-11.webp",
    focal: "attention",
    treatment: "local-ai-source",
    rationale: "The outdoor Buddha and mountain setting accurately identify Waujeongsa.",
  },
];

function outputPath(slug) {
  return path.join(outputDir, `${slug}-premium-v1.webp`);
}

async function renderThumbnail(item) {
  const sourcePath = path.join(repo, item.source);
  await fs.access(sourcePath);

  await sharp(sourcePath)
    .rotate()
    .flatten({ background: "#f5f5f3" })
    .resize(1600, 1340, {
      fit: "cover",
      position: item.focal,
      withoutEnlargement: false,
    })
    .modulate({ brightness: 1.01, saturation: 0.98 })
    .linear(1.025, -3)
    .sharpen({ sigma: 0.72 })
    .webp({ quality: 87, smartSubsample: true, effort: 5 })
    .toFile(outputPath(item.slug));

  const metadata = await sharp(outputPath(item.slug)).metadata();
  return {
    ...item,
    output: path.relative(repo, outputPath(item.slug)).replaceAll("\\", "/"),
    width: metadata.width,
    height: metadata.height,
  };
}

function labelSvg(label, width, height) {
  const safe = label.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#111827"/>
    <text x="16" y="25" fill="#ffffff" font-family="Arial, sans-serif" font-size="15">${safe}</text>
  </svg>`);
}

async function buildContactSheet(items) {
  const columns = 3;
  const tileWidth = 400;
  const imageHeight = 335;
  const labelHeight = 42;
  const rows = Math.ceil(items.length / columns);
  const composites = [];

  for (const [index, item] of items.entries()) {
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * (imageHeight + labelHeight);
    const image = await sharp(outputPath(item.slug))
      .resize(tileWidth, imageHeight, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
    composites.push({ input: image, left, top });
    composites.push({
      input: labelSvg(`${index + 1}. ${item.slug}`, tileWidth, labelHeight),
      left,
      top: top + imageHeight,
    });
  }

  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * (imageHeight + labelHeight),
      channels: 3,
      background: "#e5e7eb",
    },
  })
    .composite(composites)
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toFile(path.join(reportDir, "final-21-thumbnail-contact-sheet.jpg"));
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(reportDir, { recursive: true });

  const rendered = [];
  for (const item of selections) {
    rendered.push(await renderThumbnail(item));
    console.log(`[thumbnail] rendered ${item.slug}`);
  }

  await buildContactSheet(rendered);
  await fs.writeFile(
    path.join(reportDir, "final-thumbnail-selection-manifest.json"),
    `${JSON.stringify(rendered, null, 2)}\n`,
    "utf8",
  );
  console.log(`[thumbnail] rendered ${rendered.length} masters at 1600x1340`);
}

main().catch((error) => {
  console.error("[thumbnail] failed", error);
  process.exitCode = 1;
});
