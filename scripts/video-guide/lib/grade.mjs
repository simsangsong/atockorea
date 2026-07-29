/**
 * The colour chain, shared by every surface that shows a frame.
 *
 * build.mjs grades the master with this; poster.mjs must run the same chain on
 * its re-extracted frame or the poster ships with a different look than the
 * video it advertises. One definition, or they drift.
 */
/**
 * The blurred margin fill behind the 16:9 band.
 *
 * 🔴 Blur at a quarter resolution and scale the result up — a heavy gaussian
 * has no detail left to lose, so the two are visually identical, but the full-
 * resolution version costs sixteen times the pixels. `gblur=sigma=44` on
 * 1080×1920 for every frame did not merely run slow: a 17-second beat sat for
 * 45 minutes at 2.5% CPU with 1.4 GB resident, starved rather than working.
 * Sigma scales with the resolution, hence 44 → 11.
 */
export const BLUR_FILL = (w, h) =>
  `scale=-2:${Math.round(h / 4)},crop=${Math.round(w / 4)}:${Math.round(h / 4)},`
  + `gblur=sigma=11,eq=brightness=-0.22:saturation=0.6,scale=${w}:${h}:flags=bicubic`;

export function gradeChain(spec) {
  return (Array.isArray(spec.grade) ? spec.grade.join(',') : spec.grade) ?? [
    // The phone's wide lens bows every railing and the horizon; straighten it
    // first, then trim the black corners the correction leaves behind.
    'lenscorrection=k1=-0.13:k2=0.008:i=bilinear',
    'crop=iw*0.93:ih*0.93',
    'eq=saturation=1.15:gamma=1.02',
    // Split tone through the curves rather than colorbalance: a cool lift in
    // the shadows and warmth pulled into the highlights, plus the contrast S.
    "curves=r='0/0.012 0.25/0.238 0.5/0.512 0.75/0.780 1/0.996'"
    + ":g='0/0.006 0.25/0.232 0.5/0.502 0.75/0.766 1/1'"
    + ":b='0/0.030 0.25/0.252 0.5/0.492 0.75/0.735 1/0.972'",
    'unsharp=5:5:0.48:5:5:0.0',
    'noise=alls=5:allf=t+u',          // fine grain, kills the digital flatness
    'vignette=a=PI/6.5',              // lighter than v1 — the corners were heavy
  ].join(',');
}
