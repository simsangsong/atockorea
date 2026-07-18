/**
 * Regenerates raster app icons from `app/icon.svg` (same mark as the header logo).
 * Run after editing the SVG: `node scripts/sync-app-icons-from-svg.js`
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'app', 'icon.svg');

/**
 * Pack PNG frames into a .ico container (PNG-in-ICO, supported everywhere
 * that matters incl. Google's favicon fetcher). Kept dependency-free.
 */
function packIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);
  const entries = [];
  let offset = 6 + 16 * count;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

async function main() {
  const svg = fs.readFileSync(svgPath);
  fs.copyFileSync(svgPath, path.join(root, 'public', 'brand-mark.svg'));
  await sharp(svg).resize(32, 32).png().toFile(path.join(root, 'app', 'icon.png'));
  await sharp(svg).resize(180, 180).png().toFile(path.join(root, 'app', 'apple-icon.png'));

  // favicon.ico too — this being left out of the sync is exactly how the
  // pre-rebrand round mark survived in browser tabs + Google Search
  // (2026-07-18 fix): /favicon.ico wins over the <link> icons in many places.
  const frames = [];
  for (const size of [16, 32, 48]) {
    frames.push({ size, buf: await sharp(svg).resize(size, size).png().toBuffer() });
  }
  fs.writeFileSync(path.join(root, 'app', 'favicon.ico'), packIco(frames));
  console.log(
    'Updated public/brand-mark.svg, app/icon.png (32×32), app/apple-icon.png (180×180), app/favicon.ico (16/32/48) from app/icon.svg',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
