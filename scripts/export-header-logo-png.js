/**
 * Export the full HEADER logo lockup (brand mark + "AtoC Korea" wordmark) as a
 * transparent PNG. This is the compact lockup shown in the site header
 * (components/Header.tsx → <Logo compact />), not just the square mark
 * (that one is app/icon.svg → scripts/export-oauth-logo-png.js).
 *
 * Geometry is reproduced 1:1 from components/Logo.tsx (compact, default variant):
 *   icon 40-unit viewBox shown at 36px · AtoC 18px/600 · Korea 15px/400 ·
 *   flex gap 8px · AtoC|Korea gap 2px · Tailwind tracking preserved.
 *
 * The wordmark uses Inter (the site body font). Inter is not installed
 * system-wide, so we fetch the variable TTF once into an OS-temp cache and
 * point fontconfig (which libvips/sharp uses to resolve SVG <text>) at it.
 *
 * IMPORTANT — why we re-exec a child process: on Windows, libvips/fontconfig
 * only honours FONTCONFIG_FILE for variable-font *weight* selection when the
 * env var is present at process startup. Setting process.env in-process before
 * require('sharp') is too late — weight 600 still resolves to Inter but weight
 * 400 silently falls back to a serif. So the parent prepares the font + config,
 * then spawns a child with the env baked into its environment block.
 *
 * Output: public/atoc-header-logo.png   (transparent, trimmed, padded)
 *
 * Run: node scripts/export-header-logo-png.js
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'public', 'atoc-header-logo.png');
const slash = (s) => s.split(path.sep).join('/');

// ── Inter (variable) font cache + fontconfig wiring ────────────────────────
const fontDir = path.join(os.tmpdir(), 'atoc-inter-cache');
const fontFile = path.join(fontDir, 'Inter-Variable.ttf');
const confPath = path.join(fontDir, 'fonts.conf');
// Google Fonts upstream variable TTF (OFL). Single file carries all weights.
const INTER_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz,wght%5D.ttf';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const go = (u) => https.get(u, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return go(res.headers.location);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`GET ${u} → ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
    go(url);
  });
}

async function ensureFont() {
  fs.mkdirSync(path.join(fontDir, 'cache'), { recursive: true });
  if (!fs.existsSync(fontFile) || fs.statSync(fontFile).size < 1000) {
    console.log('  fetching Inter variable TTF …');
    await download(INTER_URL, fontFile);
  }
  // Our Inter dir + the platform's system font dirs (the latter give fontconfig
  // a sane fallback environment so generic family resolution stays healthy).
  const sysDirs = [
    'C:/Windows/Fonts',
    '/System/Library/Fonts', '/Library/Fonts', '/usr/share/fonts', '/usr/local/share/fonts',
  ].filter((d) => fs.existsSync(d));
  const dirEls = [slash(fontDir), ...sysDirs].map((d) => `  <dir>${d}</dir>`).join('\n');
  fs.writeFileSync(confPath, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
${dirEls}
  <cachedir>${slash(path.join(fontDir, 'cache'))}</cachedir>
</fontconfig>
`);
}

// ── Header lockup SVG, faithful to components/Logo.tsx (compact, default) ───
function buildSvg(scale) {
  const U = 40 / 36;               // header shows the 40-unit icon at 36px
  const GAP = 8 * U;               // flex gap-2 (8px)
  const TGAP = 2 * U;              // gap-0.5 between AtoC|Korea (2px)
  const A_SZ = 18 * U;             // AtoC font-size 18px
  const K_SZ = 15 * U;             // Korea font-size 15px
  const A_LS = -0.045 * 18 * U;    // AtoC tracking -0.045em
  const K_LS = -0.02 * 15 * U;     // Korea tracking -0.02em
  const TEXT_X = 40 + GAP;
  const BASELINE = 27.3;           // optical-centre the line against the 40-tall mark
  const VBW = 210, VBH = 40;       // generous width; trimmed away after raster

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VBW * scale}" height="${VBH * scale}" viewBox="0 0 ${VBW} ${VBH}" fill="none">
  <defs>
    <clipPath id="mc"><rect x="1" y="1" width="38" height="38" rx="9.5"/></clipPath>
    <linearGradient id="og" x1="6" y1="3" x2="36" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#283548"/><stop offset="42%" stop-color="#161E2A"/><stop offset="100%" stop-color="#0f141c"/>
    </linearGradient>
    <linearGradient id="lg" x1="10" y1="11" x2="30" y2="29" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(255,255,255,0.98)"/><stop offset="100%" stop-color="rgba(255,255,255,0.76)"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="38" height="38" rx="9.5" fill="url(#og)"/>
  <g clip-path="url(#mc)">
    <rect x="9.5" y="9.5" width="21" height="21" rx="4.85" fill="none" stroke="url(#lg)" stroke-width="0.92"/>
    <path d="M14.5 25.5 L20 16.2 L25.5 25.5" fill="none" stroke="url(#lg)" stroke-width="1.38" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="${TEXT_X.toFixed(3)}" y="${BASELINE}" font-family="Inter">
    <tspan font-size="${A_SZ.toFixed(3)}" font-weight="600" letter-spacing="${A_LS.toFixed(3)}" fill="#161E2A">AtoC</tspan>
    <tspan dx="${TGAP.toFixed(3)}" font-size="${K_SZ.toFixed(3)}" font-weight="400" letter-spacing="${K_LS.toFixed(3)}" fill="#3A4656">Korea</tspan>
  </text>
</svg>`;
}

// ── Child: env (FONTCONFIG_*) is already in the environment block here ──────
async function render() {
  const sharp = require('sharp');
  const scale = 6; // icon ≈ 240px tall → crisp ~880px-wide master
  const raster = await sharp(Buffer.from(buildSvg(scale))).png().toBuffer();
  const trimmed = await sharp(raster).trim().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const pad = Math.round(meta.height * 0.09);
  await sharp(trimmed)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  const out = await sharp(outPath).metadata();
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  → public/atoc-header-logo.png (${out.width}×${out.height}, transparent, ${kb} KB)`);
}

async function main() {
  if (process.argv.includes('--render')) return render();
  await ensureFont();
  // Re-exec with the fontconfig env present at startup (see header comment).
  execFileSync(process.execPath, [__filename, '--render'], {
    stdio: 'inherit',
    env: { ...process.env, FONTCONFIG_FILE: slash(confPath), FONTCONFIG_PATH: slash(fontDir) },
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
