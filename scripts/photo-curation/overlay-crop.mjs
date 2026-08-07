/**
 * Several otherwise-good frames in the library are phone screenshots taken from a photo
 * viewer, so a Google Lens button is burned into the bottom-left corner. Cropping past it
 * rescues the photo; shipping it as-is puts a UI chrome button on a product card.
 *
 * The button is a flat, near-circular dark disc with a bright glyph inside. That is a
 * narrow enough signature to find without false-firing on dark night photography: a night
 * sky is large and irregular, a button is small, round, and holds a bright mark.
 */

import sharp from "sharp";

const DARK = 105; // disc luminance ceiling
const GLYPH = 170; // glyph luminance floor

/**
 * @param {string} file
 * @returns {Promise<{ left:number, top:number, width:number, height:number, reason:string } | null>}
 *   A crop rect in full-resolution pixels, or null when the frame is clean.
 */
export async function detectOverlayCrop(file) {
  const meta = await sharp(file).metadata();
  // `.rotate()` applies the EXIF orientation, so the pipeline below sees swapped
  // dimensions for portrait-tagged frames. Measure in post-rotation space or every
  // crop rect lands outside the image.
  const rotated = (meta.orientation || 1) >= 5;
  const W = (rotated ? meta.height : meta.width) || 0;
  const H = (rotated ? meta.width : meta.height) || 0;
  if (!W || !H) return null;

  // Region of interest: bottom-left corner, where the button always sits.
  const rw = Math.max(1, Math.round(W * 0.3));
  const rh = Math.max(1, Math.round(H * 0.38));
  const rx = 0;
  const ry = H - rh;

  const SCAN_W = 160;
  const scanH = Math.max(1, Math.round((rh / rw) * SCAN_W));
  const { data } = await sharp(file)
    .rotate()
    .extract({ left: rx, top: ry, width: rw, height: rh })
    .resize(SCAN_W, scanH, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = SCAN_W * scanH;
  const seen = new Int8Array(n);
  let best = null;

  for (let start = 0; start < n; start += 1) {
    if (seen[start] || data[start] >= DARK) continue;
    // Flood fill this dark blob.
    const stack = [start];
    seen[start] = 1;
    let area = 0;
    let minX = SCAN_W;
    let maxX = -1;
    let minY = scanH;
    let maxY = -1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % SCAN_W;
      const y = (p - x) / SCAN_W;
      area += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && !seen[p - 1] && data[p - 1] < DARK) (seen[p - 1] = 1), stack.push(p - 1);
      if (x < SCAN_W - 1 && !seen[p + 1] && data[p + 1] < DARK)
        (seen[p + 1] = 1), stack.push(p + 1);
      if (y > 0 && !seen[p - SCAN_W] && data[p - SCAN_W] < DARK)
        (seen[p - SCAN_W] = 1), stack.push(p - SCAN_W);
      if (y < scanH - 1 && !seen[p + SCAN_W] && data[p + SCAN_W] < DARK)
        (seen[p + SCAN_W] = 1), stack.push(p + SCAN_W);
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (bw < 8 || bh < 8) continue;
    if (area < n * 0.002 || area > n * 0.14) continue;
    const aspect = bw / bh;
    if (aspect < 0.7 || aspect > 1.45) continue;
    const fill = area / (bw * bh);
    if (fill < 0.5 || fill > 0.96) continue;

    // The button always sits in the same corner. Dark rocks and shadows do not respect
    // that, and this single constraint kills most of the false positives.
    const cxFrac = (rx + ((minX + maxX) / 2) * (rw / SCAN_W)) / W;
    const cyFrac = (ry + ((minY + maxY) / 2) * (rh / scanH)) / H;
    if (cxFrac < 0.01 || cxFrac > 0.17) continue;
    if (cyFrac < 0.75 || cyFrac > 0.995) continue;

    // A button carries a bright glyph; a dark rock or shadow does not.
    let bright = 0;
    let cells = 0;
    let sum = 0;
    let sumSq = 0;
    let discCells = 0;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const v = data[y * SCAN_W + x];
        cells += 1;
        if (v > GLYPH) bright += 1;
        if (v < DARK) {
          discCells += 1;
          sum += v;
          sumSq += v * v;
        }
      }
    }
    const brightRatio = cells ? bright / cells : 0;
    if (brightRatio < 0.008 || brightRatio > 0.45) continue;

    // The disc is a flat fill. Photographic darks are textured.
    const mean = sum / discCells;
    const sd = Math.sqrt(Math.max(0, sumSq / discCells - mean * mean));
    if (sd > 42) continue;

    if (!best || area > best.area) best = { area, minX, maxX, minY, maxY };
  }

  if (!best) return null;

  // Back to full-resolution coordinates.
  const sx = rw / SCAN_W;
  const sy = rh / scanH;
  const right = rx + Math.ceil((best.maxX + 1) * sx);
  const top = ry + Math.floor(best.minY * sy);

  const leftCut = right + Math.round(W * 0.015);
  if (leftCut < W * 0.24) {
    return { left: leftCut, top: 0, width: W - leftCut, height: H, reason: "lens-button-left" };
  }
  const bottomKeep = top - Math.round(H * 0.015);
  if (bottomKeep > H * 0.74) {
    return { left: 0, top: 0, width: W, height: bottomKeep, reason: "lens-button-bottom" };
  }
  return { left: 0, top: 0, width: W, height: H, reason: "lens-button-uncroppable" };
}
