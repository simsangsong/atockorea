/**
 * The colour chain, shared by every surface that shows a frame.
 *
 * build.mjs grades the master with this; poster.mjs must run the same chain on
 * its re-extracted frame or the poster ships with a different look than the
 * video it advertises. One definition, or they drift.
 */
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
