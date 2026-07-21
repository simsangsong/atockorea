import type { VideoLanguageCode } from '@/lib/video-automation/languages';
import type { ProductionTimeline } from '@/lib/video-automation/produce/timeline';

export type KenBurnsVariant = 'zoom_in' | 'zoom_out' | 'pan_right' | 'pan_left';

const KEN_BURNS_ORDER: KenBurnsVariant[] = ['zoom_in', 'zoom_out', 'pan_right', 'pan_left'];

/** Windows system fonts with full glyph coverage per subtitle language (VP-D7). */
export const SUBTITLE_FONT_BY_LANGUAGE: Record<VideoLanguageCode, string> = {
  en: 'Segoe UI',
  es: 'Segoe UI',
  ja: 'Yu Gothic UI',
  'zh-Hant': 'Microsoft JhengHei',
};

export function kenBurnsVariant(index: number): KenBurnsVariant {
  return KEN_BURNS_ORDER[index % KEN_BURNS_ORDER.length];
}

/**
 * Single-image Ken Burns chain: oversample to 2x target, then let zoompan
 * animate over the still. Alternating variants keep consecutive scenes from
 * feeling repetitive.
 */
export function kenBurnsFilter(index: number, durationSeconds: number, fps: number): string {
  const frames = Math.max(1, Math.round(durationSeconds * fps));
  const variant = kenBurnsVariant(index);
  const centerX = "'(iw-iw/zoom)/2'";
  const centerY = "'(ih-ih/zoom)/2'";
  let zoomExpr: string;
  let xExpr = centerX;
  const yExpr = centerY;
  if (variant === 'zoom_in') {
    zoomExpr = `'1+0.10*on/${frames}'`;
  } else if (variant === 'zoom_out') {
    zoomExpr = `'1.10-0.10*on/${frames}'`;
  } else if (variant === 'pan_right') {
    zoomExpr = "'1.08'";
    xExpr = `'(iw-iw/zoom)*on/${frames}'`;
  } else {
    zoomExpr = "'1.08'";
    xExpr = `'(iw-iw/zoom)*(1-on/${frames})'`;
  }
  return [
    'scale=2160:3840:force_original_aspect_ratio=increase',
    'crop=2160:3840',
    `zoompan=z=${zoomExpr}:x=${xExpr}:y=${yExpr}:d=${frames}:s=1080x1920:fps=${fps}`,
    'setsar=1',
    'format=yuv420p',
  ].join(',');
}

export function subtitleForceStyle(fontName: string): string {
  return [
    `FontName=${fontName}`,
    'FontSize=13',
    'PrimaryColour=&HFFFFFF',
    'OutlineColour=&H66000000',
    'BorderStyle=1',
    'Outline=1.4',
    'Shadow=0.8',
    'Alignment=2',
    'MarginV=42',
    'WrapStyle=0',
  ].join(',');
}

export interface RenderArgsInput {
  /** One image path per scene, relative to the ffmpeg cwd, forward slashes. */
  images: string[];
  /** One narration audio per scene, delays from the production timeline. */
  narrations: Array<{ path: string; delayMs: number }>;
  timeline: ProductionTimeline;
  /** Relative SRT path to burn in; omit for a clean (soft-sub only) render. */
  srtPath?: string;
  fontName: string;
  outputPath: string;
}

/**
 * Builds the full ffmpeg argv for one language render: per-scene Ken Burns →
 * xfade chain at timeline offsets → delayed narration mix + loudnorm →
 * optional subtitle burn-in.
 */
export function buildRenderArgs(input: RenderArgsInput): string[] {
  const { images, narrations, timeline } = input;
  if (images.length !== timeline.scenes.length) {
    throw new Error(`Scene image count ${images.length} does not match timeline scenes ${timeline.scenes.length}`);
  }
  if (narrations.length !== timeline.scenes.length) {
    throw new Error(`Narration count ${narrations.length} does not match timeline scenes ${timeline.scenes.length}`);
  }

  const args: string[] = ['-y'];
  for (const image of images) args.push('-i', image);
  for (const narration of narrations) args.push('-i', narration.path);

  const filters: string[] = [];
  timeline.scenes.forEach((scene, index) => {
    filters.push(`[${index}:v]${kenBurnsFilter(index, scene.duration, timeline.fps)}[v${index}]`);
  });

  let current = 'v0';
  for (let index = 1; index < images.length; index += 1) {
    const next = `x${index}`;
    filters.push(
      `[${current}][v${index}]xfade=transition=fade:duration=${timeline.transition}:offset=${timeline.scenes[index].start}[${next}]`,
    );
    current = next;
  }

  const fadeOutStart = Math.max(0, timeline.total - 0.5);
  const videoTail = input.srtPath
    ? `subtitles=${input.srtPath.replace(/\\/g, '/')}:force_style='${subtitleForceStyle(input.fontName)}'`
    : 'null';
  filters.push(`[${current}]fade=t=in:st=0:d=0.4,fade=t=out:st=${fadeOutStart}:d=0.5,${videoTail}[vout]`);

  narrations.forEach((narration, index) => {
    filters.push(`[${images.length + index}:a]adelay=${narration.delayMs}|${narration.delayMs}[a${index}]`);
  });
  const mixInputs = narrations.map((_, index) => `[a${index}]`).join('');
  filters.push(`${mixInputs}amix=inputs=${narrations.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[aout]`);

  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-r',
    String(timeline.fps),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-t',
    timeline.total.toFixed(3),
    input.outputPath,
  );
  return args;
}
