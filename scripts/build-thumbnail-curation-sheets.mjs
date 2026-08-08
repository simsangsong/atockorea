#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = path.join(REPO, "output", "tour-thumbnail-upgrade-2026-08-08");
const INDEX_PATH = path.join(OUTPUT_DIR, "local-image-index.json");

const GROUPS = {
  "busan-gyeongju": [
    ["Gamcheon", ["/경상/감천문화마을/", "/modified/감천문화마을/"]],
    ["Busan Tower", ["/경상/부산타워/", "/modified/부산타워/"]],
    ["Songdo Coast", ["/경상/송도해수욕장/", "/modified/송도해수욕장/"]],
    ["Sky Capsule", ["/경상/해운대 블루라인파크/", "/modified/해운대 블루라인파크/"]],
    ["Taejongdae", ["/경상/태종대/", "/modified/태종대/"]],
    ["Gyeongju Woljeong", ["/경상/경주 월정교/", "/경상/첨성대/", "/modified/첨성대/"]],
  ],
  "seoul-suwon": [
    ["Gyeongbokgung", ["/서울/경복궁/", "/modified/경복궁/"]],
    ["Nami", ["/강원/남이섬/", "/modified/남이섬/"]],
    ["Folk Village", ["/경기/한국민속촌/", "/modified/한국민속촌/"]],
    ["Gwangmyeong Cave", ["/경기/광명동굴/", "/modified/광명동굴/"]],
    ["Waujeongsa", ["/경기/와우정사/", "/modified/와우정사/"]],
    ["Starfield Library", ["/서울/스타필드 도서관/", "/modified/스타필드 도서관/"]],
  ],
  jeju: [
    ["Jeongbang Falls", ["/정방폭포/", "/modified/정방폭포/"]],
    ["Jusangjeolli", ["/주상절리/", "/modified/주상절리/"]],
    ["Osulloc", ["/오설록티뮤지엄/", "/오늘은 녹차한잔/", "/modified/오늘은 녹차한잔/"]],
    ["Seongsan", ["/성산일출봉/", "/modified/성산일출봉/"]],
    ["Haenyeo", ["/해녀박물관/", "/해녀", "/haenyeo"]],
    ["Hallasan Snow", ["/한라산 설경/", "/한라산 중산간 설경/", "/어승생악/겨울/"]],
  ],
};

function normalize(value) {
  return String(value).normalize("NFKC").toLowerCase().replaceAll("\\", "/");
}

function score(file) {
  const normalized = normalize(file.path);
  let value = Math.min(20, file.megapixels * 2);
  value += Math.max(0, 10 - Math.abs(file.aspect - 1.194) * 5);
  if (normalized.includes("/_보정본/")) value += 20;
  if (normalized.includes("/modified/")) value += 12;
  if (normalized.includes("/한국여행사진_통합/")) value += 8;
  if (/워터마크|watermark|스크린샷|screenshot|자료\(/.test(normalized)) value -= 50;
  return value;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function buildSheet(name, rows, files) {
  const cols = 5;
  const cellWidth = 320;
  const imageHeight = 205;
  const labelHeight = 64;
  const cellHeight = imageHeight + labelHeight;
  const composites = [];
  const manifest = {};

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const [label, patterns] = rows[rowIndex];
    const candidates = files
      .filter((file) => {
        const normalized = normalize(file.path);
        return patterns.some((pattern) => normalized.includes(normalize(pattern)));
      })
      .filter((file) => !file.error && file.width >= 1000 && file.height >= 650)
      .map((file) => ({ ...file, curationScore: score(file) }))
      .sort((a, b) => b.curationScore - a.curationScore || b.megapixels - a.megapixels)
      .slice(0, cols);
    manifest[label] = candidates;

    for (let col = 0; col < candidates.length; col += 1) {
      const candidate = candidates[col];
      try {
        const image = await sharp(candidate.path)
          .rotate()
          .resize(cellWidth, imageHeight, { fit: "cover", position: "centre" })
          .jpeg({ quality: 84 })
          .toBuffer();
        const fileLabel = `${col + 1}. ${path.basename(candidate.path).slice(0, 38)}`;
        const svg = Buffer.from(
          `<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">` +
            `<rect width="100%" height="100%" fill="#fff"/>` +
            `<text x="10" y="23" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">${escapeXml(label)}</text>` +
            `<text x="10" y="47" font-family="Arial, sans-serif" font-size="12" fill="#475569">${escapeXml(fileLabel)}</text>` +
          `</svg>`,
        );
        const cell = await sharp({
          create: { width: cellWidth, height: cellHeight, channels: 4, background: "#fff" },
        })
          .composite([{ input: image, left: 0, top: 0 }, { input: svg, left: 0, top: imageHeight }])
          .png()
          .toBuffer();
        composites.push({ input: cell, left: col * cellWidth, top: rowIndex * cellHeight });
      } catch {
        // Keep processing the remaining readable candidates.
      }
    }
  }

  const outputPath = path.join(OUTPUT_DIR, `curation-${name}.jpg`);
  await sharp({
    create: { width: cols * cellWidth, height: rows.length * cellHeight, channels: 4, background: "#e2e8f0" },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(outputPath);
  await fs.writeFile(path.join(OUTPUT_DIR, `curation-${name}.json`), JSON.stringify(manifest, null, 2));
  return outputPath;
}

async function main() {
  const index = JSON.parse(await fs.readFile(INDEX_PATH, "utf8"));
  const outputs = [];
  for (const [name, rows] of Object.entries(GROUPS)) {
    outputs.push(await buildSheet(name, rows, index.files));
  }
  console.log(outputs.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
