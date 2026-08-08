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

const DEFAULT_GRADE = {
  brightness: 1.015,
  saturation: 0.95,
  contrast: 1.025,
  offset: -2,
  warmGlow: 0.105,
  coolShade: 0.07,
  vignette: 0.15,
  bottomVeil: 0.075,
  grain: 3,
};

const GRADE_OVERRIDES = {
  "busan-small-group-sightseeing-tour-cruise-passengers": {
    brightness: 1.075,
    saturation: 0.88,
    contrast: 1.03,
    offset: 0,
    warmGlow: 0.125,
    vignette: 0.12,
  },
  "from-busan-gyeongju-ancient-capital-day-tour": {
    brightness: 1.045,
    saturation: 0.88,
    contrast: 1.03,
    offset: -1,
    warmGlow: 0.12,
  },
  "jeju-eastern-unesco-spots-day-tour": {
    brightness: 1.12,
    saturation: 0.9,
    contrast: 1.02,
    offset: 1,
    vignette: 0.1,
  },
  "seoul-suburbs-private-chartered-car-10hr": {
    brightness: 1.16,
    saturation: 0.86,
    contrast: 1.03,
    offset: 3,
    warmGlow: 0.14,
    vignette: 0.1,
    bottomVeil: 0.045,
  },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": {
    brightness: 1.09,
    saturation: 0.9,
    contrast: 1.025,
    offset: 1,
    warmGlow: 0.075,
    coolShade: 0.1,
    vignette: 0.11,
  },
  "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour": {
    brightness: 0.995,
    saturation: 0.84,
    contrast: 1.02,
    offset: -2,
    warmGlow: 0.12,
    coolShade: 0.08,
    vignette: 0.11,
  },
  "busan-private-car-charter-cruise-shore": {
    brightness: 1,
    saturation: 0.88,
    contrast: 1.025,
    offset: -3,
    warmGlow: 0.115,
    vignette: 0.12,
  },
  "busan-private-car-charter-city-tour": {
    brightness: 1.005,
    saturation: 0.86,
    contrast: 1.025,
    offset: -3,
    warmGlow: 0.085,
    coolShade: 0.065,
    vignette: 0.13,
  },
};

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
    source: "assets/tour-thumbnails/ai-retouched/seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour-editorial-v2.png",
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
    source: "assets/tour-thumbnails/ai-retouched/busan-private-car-charter-cruise-shore-editorial-v2.png",
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
    source: "assets/tour-thumbnails/ai-retouched/busan-private-car-charter-city-tour-editorial-v2.png",
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
  return path.join(outputDir, `${slug}-premium-v2.webp`);
}

function gradeFor(slug) {
  return { ...DEFAULT_GRADE, ...(GRADE_OVERRIDES[slug] ?? {}) };
}

function editorialOverlaySvg(width, height, grade) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="warm" cx="16%" cy="5%" r="74%">
        <stop offset="0%" stop-color="#ffe4bd" stop-opacity="${grade.warmGlow}"/>
        <stop offset="58%" stop-color="#ffe4bd" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="cool" x1="0" y1="0" x2="1" y2="1">
        <stop offset="48%" stop-color="#0a2b38" stop-opacity="0"/>
        <stop offset="100%" stop-color="#0a2b38" stop-opacity="${grade.coolShade}"/>
      </linearGradient>
      <radialGradient id="vignette" cx="50%" cy="44%" r="72%">
        <stop offset="55%" stop-color="#02070a" stop-opacity="0"/>
        <stop offset="100%" stop-color="#02070a" stop-opacity="${grade.vignette}"/>
      </radialGradient>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="66%" stop-color="#061015" stop-opacity="0"/>
        <stop offset="100%" stop-color="#061015" stop-opacity="${grade.bottomVeil}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#warm)"/>
    <rect width="100%" height="100%" fill="url(#cool)"/>
    <rect width="100%" height="100%" fill="url(#vignette)"/>
    <rect width="100%" height="100%" fill="url(#veil)"/>
  </svg>`);
}

function filmGrain(width, height, alpha) {
  const pixels = Buffer.allocUnsafe(width * height * 4);
  let state = 0x4a6f7921;
  for (let i = 0; i < pixels.length; i += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const value = 104 + ((state >>> 24) % 49);
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
    pixels[i + 3] = alpha;
  }
  return pixels;
}

const MASTER_WIDTH = 1600;
const MASTER_HEIGHT = 1340;
const MASTER_GRAIN = filmGrain(MASTER_WIDTH, MASTER_HEIGHT, DEFAULT_GRADE.grain);

async function renderThumbnail(item) {
  const sourcePath = path.join(repo, item.source);
  await fs.access(sourcePath);
  const grade = gradeFor(item.slug);

  const graded = await sharp(sourcePath)
    .rotate()
    .flatten({ background: "#f5f5f3" })
    .resize(MASTER_WIDTH, MASTER_HEIGHT, {
      fit: "cover",
      position: item.focal,
      withoutEnlargement: false,
    })
    .modulate({ brightness: grade.brightness, saturation: grade.saturation })
    .linear(grade.contrast, grade.offset)
    .sharpen({ sigma: 0.58 })
    .toBuffer();

  await sharp(graded)
    .composite([
      { input: editorialOverlaySvg(MASTER_WIDTH, MASTER_HEIGHT, grade), blend: "over" },
      {
        input: MASTER_GRAIN,
        raw: { width: MASTER_WIDTH, height: MASTER_HEIGHT, channels: 4 },
        blend: "soft-light",
      },
    ])
    .webp({ quality: 89, smartSubsample: true, effort: 5 })
    .toFile(outputPath(item.slug));

  const metadata = await sharp(outputPath(item.slug)).metadata();
  return {
    ...item,
    output: path.relative(repo, outputPath(item.slug)).replaceAll("\\", "/"),
    width: metadata.width,
    height: metadata.height,
    grade,
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
    .toFile(path.join(reportDir, "final-21-thumbnail-contact-sheet-v2.jpg"));
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
    path.join(reportDir, "final-thumbnail-selection-manifest-v2.json"),
    `${JSON.stringify(rendered, null, 2)}\n`,
    "utf8",
  );
  console.log(`[thumbnail] rendered ${rendered.length} masters at 1600x1340`);
}

main().catch((error) => {
  console.error("[thumbnail] failed", error);
  process.exitCode = 1;
});
