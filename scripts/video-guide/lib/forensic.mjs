/**
 * Invisible ownership mark — the part that still works after someone re-uploads.
 *
 * The visible notice deters; it does not survive a crop or a blur. This does the
 * evidential job instead: a fixed, key-derived, **low-frequency** luma pattern
 * added to every frame at ±2/255.
 *
 * Why low-frequency and not LSB/steganography: a re-encode is a low-pass filter
 * with a quantiser behind it. Anything hidden in the fine detail is exactly what
 * YouTube's encoder throws away first. A coarse pattern — a 24×14 grid smoothly
 * upscaled — lives in the frequencies a codec must preserve to keep the picture
 * looking right, so it rides through re-encoding, rescaling and moderate crops.
 *
 * Detection is correlation, not extraction: average many frames (the content
 * averages toward flat, the fixed pattern accumulates), high-pass out the scene,
 * downsample to the grid, and correlate against the key's pattern. A match on a
 * suspect file plus the signed manifest (`stamp.mjs`) is the evidence pair —
 * the manifest proves what we published and when, the correlation proves their
 * copy came from ours.
 *
 * 🔴 Honest limits, so nobody over-claims in a dispute: it survives re-encode,
 * rescale and letterboxing; it degrades under heavy crop (the grid shifts) and
 * dies under mirroring unless the detector is told to try the flip. It is
 * corroboration, not a signature — the manifest hash is the primary proof.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sharp } from './deps.mjs';

export const GRID = { w: 24, h: 14 };
export const AMPLITUDE = 2;          // out of 255 — invisible on this footage

/** Deterministic ±1 grid from a key. Same key, same pattern, forever. */
export function patternFor(key) {
  const need = GRID.w * GRID.h;
  const bytes = [];
  let round = 0;
  while (bytes.length < need) {
    bytes.push(...crypto.createHash('sha256').update(`${key}#${round++}`).digest());
  }
  return bytes.slice(0, need).map((b) => (b & 1 ? 1 : -1));
}

/**
 * 🔴 The mark ALTERNATES SIGN every frame, and that is the whole trick.
 *
 * A static pattern at ±2/255 is undetectable in practice: at grid resolution the
 * scene's own structure swings ±40 levels (bright sky at the top, dark road at
 * the bottom) and never averages away, so the correlation is swamped — measured,
 * marked and unmarked clips both scored ≈ -0.04.
 *
 * Flipping the sign each frame moves the mark into the temporal domain, where
 * the scene is not. Summing frames with alternating signs, Σ(-1)ⁿ·fₙ, cancels
 * anything that persists (the whole picture) and accumulates anything that flips
 * with it (only our pattern). Motion and grain contribute noise that falls as
 * 1/√N; the mark grows linearly with N.
 *
 * Two PNGs, +A and −A, played as a 2-frame loop against the master.
 */
export async function writePatternPng(key, outFile, w, h, sign = +1) {
  const cells = patternFor(key);
  const raw = Buffer.from(cells.map((v) => 128 + sign * v * AMPLITUDE));
  await sharp(raw, { raw: { width: GRID.w, height: GRID.h, channels: 1 } })
    .resize(w, h, { kernel: 'cubic' })
    .toColourspace('b-w')
    .png()
    .toFile(outFile);
  return outFile;
}

/**
 * Half-period, in frames, of the sign flip.
 *
 * 🔴 Flipping every frame is the most detectable and the most expensive: it
 * denies the codec temporal prediction on every single frame and the encode
 * exploded past 500 Mbps. Flipping twice a second keeps the temporal signature
 * that makes detection possible while costing the encoder two transitions a
 * second instead of thirty.
 */
export const HALF_PERIOD = 15;   // frames at 30fps → 0.5s per phase

/**
 * The mark as a one-second video: HALF_PERIOD frames of +A then HALF_PERIOD of
 * −A, looped against the master with `-stream_loop`.
 *
 * ⚠ Build it as a VIDEO, never as an `-i mark_%d.png -stream_loop -1` image
 * sequence: that combination ignores `-shortest` and encodes until it is killed
 * (measured — a 20s clip produced a 1.3 GB truncated file).
 */
export async function writePatternLoop(key, dir, w, h, fps = 30) {
  const plus = path.join(dir, 'mark_p.png'), minus = path.join(dir, 'mark_m.png');
  await writePatternPng(key, plus, w, h, +1);
  await writePatternPng(key, minus, w, h, -1);
  const loop = path.join(dir, 'mark_loop.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error',
    '-loop', '1', '-t', String(HALF_PERIOD / fps), '-i', plus,
    '-loop', '1', '-t', String(HALF_PERIOD / fps), '-i', minus,
    '-filter_complex', `[0:v]fps=${fps},format=gray[a];[1:v]fps=${fps},format=gray[b];[a][b]concat=n=2:v=1:a=0[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '0', '-pix_fmt', 'gray', loop],
    { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`mark loop failed: ${r.stderr?.slice(0, 300)}`);
  return loop;
}

/**
 * Correlate a suspect video against a key.
 *
 * Pulls frames at grid resolution and forms the alternating sum. Frame parity
 * can be shifted by a re-encode that drops or duplicates a frame, so both
 * phases are tried and the stronger is reported; the sign of the score is not
 * evidence, only its magnitude.
 *
 * Returns { score, frames }. On a 336-cell grid, |score| ≥ 0.25 over 100+
 * frames is far outside chance; the unmarked control sits near 0.02.
 */
export async function detect(file, key, { frames = 240, flip = false, crop = 1 } = {}) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file,
    '-vf', [
      flip ? 'hflip' : 'null',
      // A thief who crops shifts the grid off our cells. Undoing a candidate
      // crop before sampling is what lets the correlation line up again —
      // measured, a 12% crop drops the score to the noise floor without this.
      crop < 1 ? `crop=iw*${crop}:ih*${crop},scale=1920:1080` : 'null',
      'format=gray',
      `scale=${GRID.w}:${GRID.h}:flags=area`,
    ].join(','),
    '-frames:v', String(frames), '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 1 << 26, encoding: 'buffer' });
  const buf = r.stdout;
  const cell = GRID.w * GRID.h;
  const n = buf ? Math.floor(buf.length / cell) : 0;
  if (n < 8) return { score: 0, frames: n, why: 'not enough frames' };

  const pat = patternFor(key);
  // 🔴 Phase is recovered per WINDOW, not once for the whole file. A global
  // phase looks right and is not: source timing wanders (29.97 vs 30, a dropped
  // frame in a re-encode) so the square wave slips, and over 600 frames the
  // correlation cancels itself — measured, the same marked clip scored 4.8σ on
  // 240 frames and -1.1σ on 620. Windows short enough that drift cannot
  // accumulate inside one, magnitudes averaged across them.
  const period = HALF_PERIOD * 2;
  const WIN = 180;
  const wins = [];
  for (let w = 0; w + period * 2 <= n; w += WIN) {
    const len = Math.min(WIN, n - w);
    let best = 0;
    for (let phase = 0; phase < period; phase++) {
      const acc = new Array(cell).fill(0);
      for (let f = 0; f < len; f++) {
        const s2 = (((f + phase) % period) < HALF_PERIOD) ? 1 : -1;
        for (let i = 0; i < cell; i++) acc[i] += s2 * buf[(w + f) * cell + i];
      }
      const mean = acc.reduce((x, y) => x + y, 0) / cell;
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < cell; i++) {
        const d = acc[i] - mean;
        dot += d * pat[i]; na += d * d; nb += pat[i] * pat[i];
      }
      const sc = na && nb ? dot / Math.sqrt(na * nb) : 0;
      if (Math.abs(sc) > Math.abs(best)) best = sc;
    }
    wins.push(Math.abs(best));
  }
  if (!wins.length) return { score: 0, frames: n, why: 'too short' };
  const score = wins.reduce((x, y) => x + y, 0) / wins.length;
  return { score: +score.toFixed(4), frames: n, windows: wins.length };
}

export const keyFor = (spec, copyId = 'master') =>
  `atoc|${spec.slug}|${spec.poiKey ?? ''}|${copyId}`;

export const fingerprint = (key) =>
  crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);

/**
 * The detector to call in anger.
 *
 * Sweeps the transforms a re-poster actually applies (mirror, centre crop) and
 * takes the strongest hit — but a raw max over eight combinations is NOT a
 * verdict. 🔴 Sweeping inflates the noise floor by multiple comparison: an
 * UNMARKED clip scored 0.12 that way, right next to the 0.21 of a genuinely
 * marked-and-re-encoded one. A fixed threshold on that number would have
 * produced a confident false accusation.
 *
 * So the floor is measured per file instead of assumed: the same sweep is run
 * with several decoy keys, and the real key has to stand clear of that
 * distribution. `margin` is how many standard deviations above the decoys the
 * true key lands, which is the number worth putting in front of a lawyer.
 */
export async function detectBest(file, key, opts = {}) {
  const crops = [1, 0.94, 0.88, 0.82];
  const sweep = async (k) => {
    let best = { score: 0, frames: 0, flip: false, crop: 1 };
    for (const flip of [false, true]) {
      for (const crop of crops) {
        const r = await detect(file, k, { ...opts, flip, crop });
        if (Math.abs(r.score) > Math.abs(best.score)) best = { ...r, flip, crop };
      }
    }
    return best;
  };

  const hit = await sweep(key);
  const decoys = [];
  for (let i = 0; i < 6; i++) decoys.push(Math.abs((await sweep(`decoy|${i}|${key}`)).score));
  const mean = decoys.reduce((a, b) => a + b, 0) / decoys.length;
  const sd = Math.sqrt(decoys.reduce((a, b) => a + (b - mean) ** 2, 0) / decoys.length) || 1e-6;
  const margin = (Math.abs(hit.score) - mean) / sd;

  return {
    ...hit,
    floor: +mean.toFixed(4),
    margin: +margin.toFixed(2),
    verdict: margin >= 4 ? 'match' : margin >= 2.5 ? 'weak' : 'none',
  };
}
