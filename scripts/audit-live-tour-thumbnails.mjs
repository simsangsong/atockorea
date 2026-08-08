#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = path.join(REPO, "output", "tour-thumbnail-upgrade-2026-08-08");
const STATIC_DIR = path.join(REPO, "components", "product-tour-static");
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".avif",
]);

const PRODUCTS = [
  {
    slug: "jeju-grand-highlights-loop",
    label: "Jeju Grand Highlights",
    region: "jeju",
    keywords: ["hallasan", "한라산", "jusangjeolli", "주상절리", "jeongbang", "정방폭포", "jeju", "제주"],
  },
  {
    slug: "jeju-cruise-shore-excursion-small-group-tour",
    label: "Jeju Cruise Small Group",
    region: "jeju",
    keywords: ["seongsan", "성산", "ilchulbong", "일출봉", "cruise", "크루즈", "harbor", "항구", "jeju", "제주"],
  },
  {
    slug: "busan-small-group-sightseeing-tour-cruise-passengers",
    label: "Busan Cruise Small Group",
    region: "busan",
    keywords: ["gamcheon", "감천", "busan port", "부산항", "cruise", "크루즈", "harbor", "항구", "busan", "부산"],
  },
  {
    slug: "busan-top-attractions-day-tour",
    label: "Busan Top Attractions",
    region: "busan",
    keywords: ["haedong", "yonggungsa", "해동용궁사", "busan", "부산", "temple", "사찰"],
  },
  {
    slug: "southwest-hallasan-osulloc-aewol",
    label: "Jeju Southwest",
    region: "jeju",
    keywords: ["osulloc", "오설록", "tea", "녹차", "aewol", "애월", "hallasan", "한라산", "jeju", "제주"],
  },
  {
    slug: "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip",
    label: "Seoraksan Naksansa",
    region: "seoul",
    keywords: ["naksansa", "낙산사", "naksan", "낙산", "seoraksan", "설악산", "yangyang", "양양"],
  },
  {
    slug: "seoul-seoraksan-nami-island-morning-calm-day-tour",
    label: "Seoraksan Nami Morning Calm",
    region: "seoul",
    keywords: ["seoraksan", "설악산", "nami", "남이섬", "morning calm", "아침고요", "autumn", "단풍"],
  },
  {
    slug: "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour",
    label: "Winter Seoraksan Nami Eobi",
    region: "seoul",
    keywords: ["eobi", "어비", "ice", "얼음", "winter", "겨울", "snow", "설경", "seoraksan", "설악산", "nami", "남이섬"],
  },
  {
    slug: "busan-cruise-shore-excursion-bus-tour",
    label: "Busan Cruise Bus",
    region: "busan",
    keywords: ["busan port", "부산항", "cruise", "크루즈", "taejongdae", "태종대", "harbor", "항구", "busan", "부산"],
  },
  {
    slug: "busan-private-car-charter-cruise-shore",
    label: "Busan Private Cruise Charter",
    region: "busan",
    keywords: ["busan", "부산", "cruise", "크루즈", "carnival", "카니발", "van", "차량", "taejongdae", "태종대"],
  },
  {
    slug: "incheon-seoul-private-car-shore-excursion-cruise",
    label: "Incheon Seoul Private Charter",
    region: "seoul",
    keywords: ["incheon", "인천", "gyeongbokgung", "경복궁", "seoul", "서울", "carnival", "카니발", "van", "차량", "cruise", "크루즈"],
  },
  {
    slug: "busan-small-group-yonggungsa-skycapsule-gamcheon-tour",
    label: "Busan Sky Capsule Small Group",
    region: "busan",
    keywords: ["sky capsule", "스카이캡슐", "cheongsapo", "청사포", "blueline", "블루라인", "haeundae", "해운대", "busan", "부산"],
  },
  {
    slug: "busan-private-car-charter-city-tour",
    label: "Busan Private City Charter",
    region: "busan",
    keywords: ["gwangalli", "광안리", "marine city", "마린시티", "busan", "부산", "carnival", "카니발", "van", "차량"],
  },
  {
    slug: "jeju-island-private-car-charter-tour",
    label: "Jeju Private Charter",
    region: "jeju",
    keywords: ["jeju", "제주", "carnival", "카니발", "van", "차량", "coast", "해안"],
  },
  {
    slug: "seoul-suburbs-private-chartered-car-10hr",
    label: "Seoul Private Charter",
    region: "seoul",
    keywords: ["seoul", "서울", "han river", "한강", "namsan", "남산", "carnival", "카니발", "van", "차량", "night", "야경"],
  },
  {
    slug: "from-busan-gyeongju-ancient-capital-day-tour",
    label: "Busan to Gyeongju",
    region: "busan",
    keywords: ["gyeongju", "경주", "woljeonggyo", "월정교", "cheomseongdae", "첨성대", "bulguksa", "불국사", "daereungwon", "대릉원"],
  },
  {
    slug: "jeju-eastern-unesco-spots-day-tour",
    label: "Jeju East UNESCO",
    region: "jeju",
    keywords: ["seongsan", "성산", "ilchulbong", "일출봉", "haenyeo", "해녀", "east jeju", "제주동부", "unesco", "유네스코"],
  },
  {
    slug: "jeju-southern-top-unesco-spots-tour",
    label: "Jeju South Seogwipo",
    region: "jeju",
    keywords: ["jeongbang", "정방폭포", "seogwipo", "서귀포", "jusangjeolli", "주상절리", "south jeju", "제주남부"],
  },
  {
    slug: "seoul-suwon-hwaseong-folk-village-starfield-library",
    label: "Suwon Folk Village",
    region: "seoul",
    keywords: ["folk village", "민속촌", "hanbok", "한복", "suwon", "수원", "yongin", "용인"],
  },
  {
    slug: "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
    label: "Suwon Gwangmyeong Cave",
    region: "seoul",
    keywords: ["gwangmyeong", "광명", "cave", "동굴", "starfield", "스타필드", "suwon", "수원"],
  },
  {
    slug: "seoul-suwon-hwaseong-waujeongsa-starfield",
    label: "Suwon Waujeongsa",
    region: "seoul",
    keywords: ["waujeongsa", "와우정사", "buddha", "불상", "temple", "사찰", "suwon", "수원", "yongin", "용인"],
  },
];

const SCAN_ROOTS = [
  {
    root: "D:\\",
    excludes: ["!$RECYCLE.BIN/**", "!System Volume Information/**"],
  },
  {
    root: "C:\\Users\\sangsong",
    excludes: [
      "!AppData/**",
      "!**/node_modules/**",
      "!**/.git/**",
      "!**/.next/**",
      "!**/.cache/**",
      "!**/dist/**",
      "!**/build/**",
    ],
  },
];

function normalize(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replaceAll("\\", "/");
}

function collectImageStrings(value, out = new Set()) {
  if (typeof value === "string") {
    const clean = value.split(/[?#]/)[0];
    if (IMAGE_EXTENSIONS.has(path.extname(clean).toLowerCase())) out.add(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectImageStrings(item, out);
  }
  return out;
}

function resolveImageString(value) {
  if (!value || /^https?:/i.test(value)) return null;
  if (value.startsWith("/images/")) return path.join(REPO, "public", value.slice(1));
  return path.resolve(REPO, value);
}

function scanFiles() {
  const paths = new Set();
  const globs = [...IMAGE_EXTENSIONS].flatMap((ext) => [ext, ext.toUpperCase()]);
  for (const entry of SCAN_ROOTS) {
    const args = ["--files", entry.root];
    for (const ext of globs) args.push("-g", `*${ext}`);
    for (const exclude of entry.excludes) args.push("-g", exclude);
    const result = spawnSync("rg", args, {
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    for (const line of result.stdout.split(/\r?\n/)) {
      if (line.trim()) paths.add(path.resolve(line.trim()));
    }
  }
  return [...paths];
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function inspectFile(filePath) {
  try {
    const [stat, metadata] = await Promise.all([fs.stat(filePath), sharp(filePath).metadata()]);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    return {
      path: filePath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      width,
      height,
      megapixels: Number(((width * height) / 1_000_000).toFixed(2)),
      aspect: height > 0 ? Number((width / height).toFixed(4)) : 0,
      format: metadata.format ?? path.extname(filePath).slice(1).toLowerCase(),
    };
  } catch (error) {
    return { path: filePath, error: error instanceof Error ? error.message : String(error) };
  }
}

function scoreCandidate(file, product, authoredImages) {
  if (file.error || file.width < 1000 || file.height < 650 || file.size < 80_000) return -Infinity;
  const haystack = normalize(file.path);
  let score = 0;
  for (const keyword of product.keywords) {
    const needle = normalize(keyword);
    if (!needle) continue;
    if (haystack.includes(needle)) score += needle.length >= 5 ? 16 : 10;
  }
  if (authoredImages.has(normalize(file.path))) score += 50;
  if (/한국여행사진_통합|atoc photos|atoc-photos|public\/images\/tours/.test(haystack)) score += 8;
  if (/thumbnail|thumb|small|icon|logo|screenshot|스크린샷/.test(haystack)) score -= 12;
  if (/watermark|워터마크/.test(haystack)) score -= 18;
  score += Math.min(14, Math.log2(Math.max(1, file.megapixels)) * 4);
  score += Math.max(0, 8 - Math.abs(file.aspect - 1.194) * 5);
  return Number(score.toFixed(2));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function buildRegionSheet(region, products, shortlists) {
  const cellWidth = 360;
  const imageHeight = 210;
  const labelHeight = 68;
  const cols = 3;
  const rows = products.length;
  const composites = [];

  for (let row = 0; row < products.length; row += 1) {
    const product = products[row];
    const candidates = shortlists[product.slug].slice(0, cols);
    for (let col = 0; col < cols; col += 1) {
      const candidate = candidates[col];
      if (!candidate) continue;
      try {
        const image = await sharp(candidate.path)
          .rotate()
          .resize(cellWidth, imageHeight, { fit: "cover", position: "centre" })
          .jpeg({ quality: 82 })
          .toBuffer();
        const basename = path.basename(candidate.path).slice(0, 34);
        const label = Buffer.from(
          `<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">` +
            `<rect width="100%" height="100%" fill="#ffffff"/>` +
            `<text x="10" y="23" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#111827">${escapeXml(product.label)}</text>` +
            `<text x="10" y="46" font-family="Arial, sans-serif" font-size="12" fill="#475569">${escapeXml(`${col + 1}. ${basename}`)}</text>` +
            `<text x="300" y="46" font-family="Arial, sans-serif" font-size="12" fill="#0f766e">${candidate.score.toFixed(0)}</text>` +
          `</svg>`,
        );
        const cell = await sharp({
          create: { width: cellWidth, height: imageHeight + labelHeight, channels: 4, background: "#ffffff" },
        })
          .composite([{ input: image, left: 0, top: 0 }, { input: label, left: 0, top: imageHeight }])
          .png()
          .toBuffer();
        composites.push({ input: cell, left: col * cellWidth, top: row * (imageHeight + labelHeight) });
      } catch {
        // A failed preview does not invalidate the underlying shortlist entry.
      }
    }
  }

  const outputPath = path.join(OUTPUT_DIR, `candidate-sheet-${region}.jpg`);
  await sharp({
    create: {
      width: cols * cellWidth,
      height: rows * (imageHeight + labelHeight),
      channels: 4,
      background: "#e2e8f0",
    },
  })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toFile(outputPath);
  return outputPath;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const productData = {};
  const authoredByProduct = {};
  for (const product of PRODUCTS) {
    const jsonPath = path.join(STATIC_DIR, product.slug, `${product.slug}.en.json`);
    const data = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    const imageStrings = [...collectImageStrings(data)];
    const authoredPaths = imageStrings.map(resolveImageString).filter(Boolean);
    authoredByProduct[product.slug] = new Set(authoredPaths.map(normalize));
    productData[product.slug] = {
      title: data.catalog_card?.title ?? data.title ?? product.label,
      heroImage: data.catalog_card?.heroImage ?? data.hero?.imageUrl ?? null,
      thumbnail: data.catalog_card?.thumbnail ?? null,
      authoredImages: imageStrings,
    };
  }

  const files = scanFiles();
  const inspected = (await mapLimit(files, 24, inspectFile)).filter(Boolean);
  const usable = inspected.filter((file) => !file.error);
  const shortlists = {};
  for (const product of PRODUCTS) {
    shortlists[product.slug] = usable
      .map((file) => ({ ...file, score: scoreCandidate(file, product, authoredByProduct[product.slug]) }))
      .filter((file) => Number.isFinite(file.score) && file.score > 10)
      .sort((a, b) => b.score - a.score || b.megapixels - a.megapixels)
      .slice(0, 24);
  }

  const indexPath = path.join(OUTPUT_DIR, "local-image-index.json");
  const shortlistPath = path.join(OUTPUT_DIR, "candidate-shortlist.json");
  await fs.writeFile(indexPath, JSON.stringify({ scannedAt: new Date().toISOString(), roots: SCAN_ROOTS, files: inspected }, null, 2));
  await fs.writeFile(shortlistPath, JSON.stringify({ products: productData, shortlists }, null, 2));

  const sheets = [];
  for (const region of ["busan", "jeju", "seoul"]) {
    sheets.push(await buildRegionSheet(region, PRODUCTS.filter((product) => product.region === region), shortlists));
  }

  const report = [
    "# Live Tour Thumbnail Audit",
    "",
    `Scanned at: ${new Date().toISOString()}`,
    `Image files found: ${files.length}`,
    `Readable image files: ${usable.length}`,
    `Unreadable image files: ${inspected.length - usable.length}`,
    "",
    "## Products",
    "",
    ...PRODUCTS.map((product) => {
      const current = productData[product.slug];
      return `- ${product.label}: ${shortlists[product.slug].length} candidates; current ${current.thumbnail ?? current.heroImage ?? "none"}`;
    }),
    "",
    "## Artifacts",
    "",
    `- ${indexPath}`,
    `- ${shortlistPath}`,
    ...sheets.map((sheet) => `- ${sheet}`),
    "",
  ].join("\n");
  await fs.writeFile(path.join(OUTPUT_DIR, "audit-report.md"), report, "utf8");

  console.log(JSON.stringify({ files: files.length, readable: usable.length, indexPath, shortlistPath, sheets }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
