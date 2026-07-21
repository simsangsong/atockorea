export interface ProductionSceneTiming {
  index: number;
  /** Full scene duration including crossfade overlap on both sides. */
  duration: number;
  /** Time in the final video at which this scene's segment begins (xfade offset). */
  start: number;
  /** Time at which the incoming crossfade has finished and the scene is fully visible. */
  solidStart: number;
  narrationDelayMs: number;
  subtitleStart: number;
  subtitleEnd: number;
}

export interface ProductionTimeline {
  fps: number;
  transition: number;
  total: number;
  scenes: ProductionSceneTiming[];
}

/** Per-scene floors for the 6-slot brand template (hero, title, culture, must-see, tip, CTA). */
export const DEFAULT_MIN_SCENE_SECONDS = [3, 4, 6, 6, 5, 6];

const MAX_SCENE_SECONDS = 14;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Adaptive timeline (VP-D5): scene length follows narration length instead of a
 * fixed 60s grid. Crossfade overlap is subtracted from the running offset so the
 * computed starts line up with ffmpeg xfade offsets.
 */
export function computeProductionTimeline(input: {
  narrationSeconds: number[];
  minSeconds?: number[];
  transition?: number;
  narrationPad?: number;
  fps?: number;
}): ProductionTimeline {
  const transition = input.transition ?? 0.5;
  const narrationPad = input.narrationPad ?? 0.7;
  const fps = input.fps ?? 30;
  const count = input.narrationSeconds.length;
  if (count === 0) throw new Error('computeProductionTimeline requires at least one scene');

  const durations = input.narrationSeconds.map((narration, index) => {
    const floor = input.minSeconds?.[index] ?? DEFAULT_MIN_SCENE_SECONDS[index] ?? 4;
    return round3(Math.min(MAX_SCENE_SECONDS, Math.max(floor, narration + narrationPad)));
  });

  const starts: number[] = [];
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    starts.push(round3(sum - index * transition));
    sum += durations[index];
  }
  const total = round3(sum - (count - 1) * transition);

  const solidStarts = starts.map((start, index) => round3(start + (index > 0 ? transition : 0)));

  const scenes: ProductionSceneTiming[] = durations.map((duration, index) => {
    const subtitleEnd = index < count - 1 ? round3(solidStarts[index + 1] - 0.05) : total;
    return {
      index,
      duration,
      start: starts[index],
      solidStart: solidStarts[index],
      narrationDelayMs: Math.round((solidStarts[index] + 0.25) * 1000),
      subtitleStart: solidStarts[index],
      subtitleEnd,
    };
  });

  return { fps, transition, total, scenes };
}
