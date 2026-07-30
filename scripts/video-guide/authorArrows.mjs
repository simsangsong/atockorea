/**
 * Turn a measured route into arrow geometry.
 *
 * Nobody picks coordinates by hand any more. `routeAfter()` says where the walk
 * actually goes; this converts that into a ground-plane path under the same
 * grammar v1 validated: straight segments only, one sharp corner at the point
 * the route actually breaks, and never a curve.
 */
export const SRC_W = 1920, SRC_H = 1080;

// The arrow stops well short of the horizon. v1 ran the tip up to the heading
// point itself, which sits on the horizon line and made the arrow read as
// floating rather than lying on the ground.
const REACH = 0.72;

/**
 * @param {object} route  result of routeAfter()
 * @param {object} [opt]  { steps:boolean, thickness:number }
 * @returns {object|null} arrow spec in SOURCE pixel coordinates, or null when the
 *                        footage does not justify drawing one
 */
export function authorArrow(route, opt = {}) {
  if (!route || route.kind === 'unknown') return null;

  const horizon = Math.min(SRC_H * 0.75, Math.max(SRC_H * 0.30, route.y));
  const endY = SRC_H - REACH * (SRC_H - horizon);
  const start = { x: SRC_W / 2, y: SRC_H - 6 };
  const t = opt.thickness ?? 1;

  if (opt.steps) {
    // Stairs that bend still bend: the plates follow the corner rather than
    // marching in a straight line past the turn.
    const turning = route.kind === 'left' || route.kind === 'right';
    const f = turning ? Math.min(0.7, Math.max(0.3, route.cornerAt ?? 0.4)) : 0.5;
    const xPre = turning ? (route.pts?.[0]?.x ?? start.x) : (start.x + route.x) / 2;
    const mid = { x: start.x + (xPre - start.x) * f, y: start.y + (endY - start.y) * f };
    return {
      mode: 'steps',
      points: [start, mid, { x: route.x, y: endY }],
      width: [230 * t, 62 * t],
      steps: opt.stepCount ?? 7,
      perspective: 0.86,
      derivedFrom: route.kind,
    };
  }

  if (route.kind === 'straight' || route.kind === 'trailing') {
    return {
      mode: 'ribbon',
      points: [
        start,
        { x: start.x + (route.x - start.x) * 0.55, y: start.y + (endY - start.y) * 0.55 },
        { x: route.x, y: endY },
      ],
      width: [128 * t, 22 * t],
      headLen: 62,
      chevronSpacing: 128,
      derivedFrom: route.kind,
    };
  }

  // A real break. The corner goes where the heading actually started to move,
  // and the leg after it is mostly lateral so the turn is unmistakable.
  const xPre = route.pts?.[0]?.x ?? start.x;
  const f = Math.min(0.78, Math.max(0.35, route.cornerAt ?? 0.5));
  const corner = {
    x: start.x + (xPre - start.x) * f,
    y: start.y + (endY - start.y) * f,
  };
  return {
    mode: 'ribbon',
    points: [
      start,
      corner,
      { x: route.x, y: corner.y - (start.y - endY) * 0.14 },
    ],
    width: [128 * t, 20 * t],
    headLen: 56,
    chevronSpacing: 140,
    derivedFrom: route.kind,
    corner: f,
  };
}
