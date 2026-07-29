/**
 * Close-up framing, with the one rule that matters: the crop window ALWAYS
 * contains the subject.
 *
 * v4 sized the zoom to the subject, which produced a window smaller than the
 * subject itself — the Bodhidharma statue is 800px tall and the window was 496px,
 * so at every instant a third of him was off-screen no matter where it travelled.
 * "Reveal top-left to bottom-right" has to mean drifting inside the freedom that
 * is left over after the subject is safely framed, not panning past him.
 *
 * Shared by build.mjs (to render) and validate.mjs (to refuse to render).
 */
export const SRC_W = 1920, SRC_H = 1080;
const MARGIN = 0.08;      // subject keeps at least this much breathing room

export function framing(focus, opt = {}) {
  const [fx, fy, fw, fh] = focus;
  const need = 1 + MARGIN * 2;
  const maxZoom = opt.maxZoom ?? 2.4;
  const zoom = Math.min(maxZoom, Math.max(1.10,
    Math.min(SRC_W / (fw * need), SRC_H / (fh * need))));

  const cw = SRC_W / zoom, ch = SRC_H / zoom;
  const mx = fw * MARGIN, my = fh * MARGIN;

  // the window's top-left may sit anywhere that still swallows the subject
  const xLo = Math.max(0, fx + fw + mx - cw);
  const xHi = Math.min(SRC_W - cw, fx - mx);
  const yLo = Math.max(0, fy + fh + my - ch);
  const yHi = Math.min(SRC_H - ch, fy - my);

  // no freedom left => hold still rather than crop the subject
  const x0 = xLo <= xHi ? xLo : Math.max(0, Math.min(SRC_W - cw, fx + fw / 2 - cw / 2));
  const x1 = xLo <= xHi ? xHi : x0;
  const y0 = yLo <= yHi ? yLo : Math.max(0, Math.min(SRC_H - ch, fy + fh / 2 - ch / 2));
  const y1 = yLo <= yHi ? yHi : y0;

  return {
    zoom, cw: Math.round(cw / 2) * 2, ch: Math.round(ch / 2) * 2,
    // start high-left on the subject, finish low-right — the drift the client liked
    start: { x: x0, y: y0 }, end: { x: x1, y: y1 },
    travel: Math.hypot(x1 - x0, y1 - y0),
  };
}

/** True when the window at (x,y) fully contains the subject. */
export function contains(focus, f, x, y) {
  const [fx, fy, fw, fh] = focus;
  return x <= fx + 0.5 && y <= fy + 0.5 && x + f.cw >= fx + fw - 0.5 && y + f.ch >= fy + fh - 0.5;
}
