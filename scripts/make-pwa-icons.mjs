/**
 * R5 (docs/ops-staff-design-unification-master-plan-2026-07-27.md §D-2) —
 * PWA icon set: BLACK ground + the brand mark alone, no wordmark.
 *
 * The old set packed the circular emblem (ring + mark + "AtoC Korea"
 * lettering) into 192px; on a home screen it read as a coal lump — the mark
 * was ~20% of the tile and the text was illegible. Owner call: black logo
 * only.
 *
 * Geometry:
 *   - regular icons: mark spans 58% of the tile, centred.
 *   - maskable icons: mark spans 44% — inside the 80% safe circle Android
 *     crops to, so no launcher shape ever clips it.
 *   - apple-touch-icon: iOS applies its own rounded mask over an opaque
 *     square, so it uses the regular geometry on the same black ground.
 *
 * Run: node scripts/make-pwa-icons.mjs   (writes public/pwa/*.png)
 * Deps: sharp (already used by the photo pipeline).
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';

const OUT = path.join(process.cwd(), 'public', 'pwa');
mkdirSync(OUT, { recursive: true });

const BLACK = '#0b0b0c';

/** The AtoC mark: rounded square + peak, drawn in white on transparent. */
function markSvg(size) {
  const s = size;
  const stroke = s * 0.052;
  const box = s * 0.86;
  const off = (s - box) / 2;
  const r = box * 0.23;
  // Peak sits inside the box, sized off the box so both scale together.
  const x1 = off + box * 0.24;
  const x2 = off + box * 0.5;
  const x3 = off + box * 0.76;
  const yBase = off + box * 0.735;
  const yPeak = off + box * 0.3;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none">
       <rect x="${off}" y="${off}" width="${box}" height="${box}" rx="${r}"
             stroke="#ffffff" stroke-width="${stroke}"/>
       <path d="M${x1} ${yBase} L${x2} ${yPeak} L${x3} ${yBase}"
             stroke="#ffffff" stroke-width="${stroke * 1.5}"
             stroke-linecap="round" stroke-linejoin="round"/>
     </svg>`,
  );
}

async function render(file, size, markRatio) {
  const mark = Math.round(size * markRatio);
  const overlay = await sharp(markSvg(mark)).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BLACK },
  })
    .composite([{ input: overlay, gravity: 'centre' }])
    .png()
    .toFile(path.join(OUT, file));
  console.log('wrote', file, `${size}px mark=${Math.round(markRatio * 100)}%`);
}

await render('icon-192.png', 192, 0.58);
await render('icon-512.png', 512, 0.58);
await render('maskable-192.png', 192, 0.44);
await render('maskable-512.png', 512, 0.44);
await render('apple-touch-icon.png', 180, 0.58);
console.log('PWA icons regenerated (black ground, mark only).');
