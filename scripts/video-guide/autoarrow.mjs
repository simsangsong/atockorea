#!/usr/bin/env node
/**
 * Write measured arrow geometry into the spec.
 *
 * This is the step that removes hand-placed coordinates from the workflow. Each
 * beat that draws a route arrow gets its heading measured from the footage that
 * follows, converted to a ground path, and written back. A beat may carry
 * `arrowOverride` when the instruction is something motion cannot express — the
 * one real case is "turn around and go back", where the camera never travels the
 * direction the guest needs to walk.
 *
 *   node scripts/video-guide/autoarrow.mjs docs/video-specs/<slug>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { routeAfter } from './heading.mjs';
import { authorArrow } from './authorArrows.mjs';

const specPath = process.argv[2];
if (!specPath) { console.error('usage: autoarrow.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const src = (id) => path.join(spec.sourceDir, spec.sources[id]);

for (const beat of spec.beats) {
  if (beat.kind !== 'arrow') continue;

  if (beat.arrowOverride) {
    beat.arrows = beat.arrowOverride;
    console.log(`${beat.id}  override   ${beat.arrows.map((a) => a.mode).join('+')}  ${beat.title}`);
    continue;
  }

  let route = routeAfter(src(beat.src), beat.at);

  // Body sway moves the measured heading by roughly ±100px, which is the same
  // size as the gentler turns on this route — so the estimator flip-flops on
  // them depending on how you average. Where the person who walked it has told
  // us the direction, that wins; the footage still supplies how far the turn
  // goes and where the corner sits. Measurement for magnitude, human for sense.
  if (beat.turn && route.pts?.length) {
    const xs = route.pts.map((p) => p.x);
    route = {
      ...route,
      kind: beat.turn,
      confirmedByHuman: true,
      x: Math.round(beat.turn === 'left' ? Math.min(...xs) : Math.max(...xs)),
      cornerAt: beat.turnAt ?? 0.35,
    };
  }

  const arrow = authorArrow(route, { steps: beat.stairs === true, stepCount: beat.stepCount });
  if (!arrow) {
    delete beat.arrows;
    console.log(`${beat.id}  NO ARROW   ${route.kind} — ${route.why ?? 'not a walk'}  ${beat.title}`);
    continue;
  }
  beat.arrows = [arrow];
  console.log(
    `${beat.id}  ${String(route.kind).padEnd(9)} delta=${String(route.delta ?? '-').padStart(6)} ` +
    `-> (${arrow.points[arrow.points.length - 1].x}, ${arrow.points[arrow.points.length - 1].y})` +
    `${arrow.corner ? ` corner@${(arrow.corner * 100).toFixed(0)}%` : ''}  ${beat.title}`
  );
}

fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
console.log('\nwritten:', specPath);
