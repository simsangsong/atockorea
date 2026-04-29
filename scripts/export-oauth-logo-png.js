/**
 * Export the header brand mark as PNG for Google OAuth Consent Screen.
 *
 * Output:
 *   public/atoc-oauth-logo-1024.png  (1024×1024, high quality — recommended for Google)
 *   public/atoc-oauth-logo-240.png   ( 240×240, smaller alt for various uses)
 *
 * Google OAuth requires:
 *   - Square image
 *   - PNG / JPG / BMP
 *   - 120×120 px minimum (we output 1024 for crispness on hi-DPI)
 *   - Under 1 MB
 *
 * Run: node scripts/export-oauth-logo-png.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'app', 'icon.svg');
const outDir = path.join(root, 'public');

async function main() {
  const svg = fs.readFileSync(svgPath);

  // Wrap the 40×40 SVG with a slight padding so the mark doesn't touch the
  // edges when used as a profile-style logo. We do this by rasterizing to
  // a smaller canvas inside a larger transparent square.
  const sizes = [
    { px: 1024, name: 'atoc-oauth-logo-1024.png' },
    { px: 240, name: 'atoc-oauth-logo-240.png' },
  ];

  for (const { px, name } of sizes) {
    const outPath = path.join(outDir, name);
    // Render SVG at full target size — the mark already fills its viewBox
    // edge-to-edge with appropriate inset, so no extra padding needed.
    await sharp(svg, { density: 300 })
      .resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, quality: 100 })
      .toFile(outPath);
    const stat = fs.statSync(outPath);
    console.log(`  → ${name} (${px}×${px}, ${(stat.size / 1024).toFixed(1)} KB)`);
  }
  console.log(`\nUpload public/atoc-oauth-logo-1024.png to Google OAuth Consent Screen → Branding → App logo`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
