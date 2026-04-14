/**
 * Regenerates raster app icons from `app/icon.svg` (same mark as the header logo).
 * Run after editing the SVG: `node scripts/sync-app-icons-from-svg.js`
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'app', 'icon.svg');

async function main() {
  const svg = fs.readFileSync(svgPath);
  fs.copyFileSync(svgPath, path.join(root, 'public', 'brand-mark.svg'));
  await sharp(svg).resize(32, 32).png().toFile(path.join(root, 'app', 'icon.png'));
  await sharp(svg).resize(180, 180).png().toFile(path.join(root, 'app', 'apple-icon.png'));
  console.log('Updated public/brand-mark.svg, app/icon.png (32×32), app/apple-icon.png (180×180) from app/icon.svg');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
