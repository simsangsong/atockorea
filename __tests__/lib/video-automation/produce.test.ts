import { buildRenderArgs, kenBurnsFilter, kenBurnsVariant } from '@/lib/video-automation/produce/ffmpegGraph';
import { isGeneratedImage, planSceneImages } from '@/lib/video-automation/produce/ingest';
import { computeProductionTimeline, DEFAULT_MIN_SCENE_SECONDS } from '@/lib/video-automation/produce/timeline';
import { estimateSpeechSeconds } from '@/lib/video-automation/produce/tts';
import type { VideoLocalizedPoiContent } from '@/lib/video-automation/types';

describe('production timeline', () => {
  it('adapts scene durations to narration and offsets by crossfade overlap', () => {
    const timeline = computeProductionTimeline({ narrationSeconds: [2, 3, 8, 7, 5, 4] });
    expect(timeline.scenes[0].duration).toBe(DEFAULT_MIN_SCENE_SECONDS[0]);
    expect(timeline.scenes[2].duration).toBeCloseTo(8.7, 3);
    expect(timeline.scenes[0].start).toBe(0);
    // start_1 = d0 - transition = 3 - 0.5
    expect(timeline.scenes[1].start).toBeCloseTo(2.5, 3);
    const sum = timeline.scenes.reduce((acc, scene) => acc + scene.duration, 0);
    expect(timeline.total).toBeCloseTo(sum - 5 * timeline.transition, 3);
    // Subtitles start when the incoming fade has settled.
    expect(timeline.scenes[1].subtitleStart).toBeCloseTo(timeline.scenes[1].start + timeline.transition, 3);
    expect(timeline.scenes.at(-1)?.subtitleEnd).toBeCloseTo(timeline.total, 3);
  });

  it('caps runaway narrations at the max scene length', () => {
    const timeline = computeProductionTimeline({ narrationSeconds: [40] });
    expect(timeline.scenes[0].duration).toBe(14);
  });
});

describe('ken burns and render graph', () => {
  it('cycles motion variants and emits zoompan at the target resolution', () => {
    expect(kenBurnsVariant(0)).toBe('zoom_in');
    expect(kenBurnsVariant(5)).toBe('zoom_out');
    const filter = kenBurnsFilter(0, 4, 30);
    expect(filter).toContain('zoompan=');
    expect(filter).toContain('s=1080x1920');
    expect(filter).toContain('d=120');
  });

  it('builds a full argv with xfade chain, delayed narration mix, and burned subtitles', () => {
    const timeline = computeProductionTimeline({ narrationSeconds: [2, 3, 8, 7, 5, 4] });
    const images = Array.from({ length: 6 }, (_, index) => `public/images/scene-${index}.webp`);
    const narrations = timeline.scenes.map((scene, index) => ({
      path: `.tmp/narration/scene-${index}.mp3`,
      delayMs: scene.narrationDelayMs,
    }));
    const args = buildRenderArgs({
      images,
      narrations,
      timeline,
      srtPath: '.tmp/subtitles/ja.srt',
      fontName: 'Yu Gothic UI',
      outputPath: '.tmp/renders/out.mp4',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(args.filter((arg) => arg === '-i')).toHaveLength(12);
    expect(graph.match(/xfade=/g)).toHaveLength(5);
    expect(graph).toContain(`offset=${timeline.scenes[1].start}`);
    expect(graph).toContain('amix=inputs=6');
    expect(graph).toContain("subtitles=.tmp/subtitles/ja.srt:force_style='FontName=Yu Gothic UI");
    expect(graph).toContain(`adelay=${timeline.scenes[3].narrationDelayMs}|`);
    expect(args.at(-1)).toBe('.tmp/renders/out.mp4');
  });

  it('mismatched scene counts fail loudly', () => {
    const timeline = computeProductionTimeline({ narrationSeconds: [2, 3] });
    expect(() =>
      buildRenderArgs({
        images: ['a.webp'],
        narrations: [
          { path: 'a.mp3', delayMs: 0 },
          { path: 'b.mp3', delayMs: 0 },
        ],
        timeline,
        fontName: 'Segoe UI',
        outputPath: 'out.mp4',
      }),
    ).toThrow('Scene image count');
  });
});

describe('scene image ingest', () => {
  const content: VideoLocalizedPoiContent = {
    language: 'en',
    sourceLocale: 'en',
    name: 'Jagalchi Market',
    highlights: [],
    sourceFactIds: [],
    images: [
      '/images/itinerary/jagalchi-harbor-sign.webp',
      '/images/tours/jagalchi-market/photo-001.webp',
      '/images/tours/jagalchi-market/jagalchi-seafood-collage-ai.webp',
      '/images/tours/jagalchi-market/missing.webp',
    ],
    imageCredits: [
      { url: '/images/itinerary/jagalchi-harbor-sign.webp', source: 'atoc-korea' },
      { url: '/images/tours/jagalchi-market/photo-001.webp', source: 'unsplash' },
    ],
  };

  it('flags generated imagery by basename marker', () => {
    expect(isGeneratedImage('/x/jagalchi-seafood-collage-ai.webp')).toBe(true);
    expect(isGeneratedImage('/x/ai-generated.webp')).toBe(true);
    expect(isGeneratedImage('/x/main-gate.webp')).toBe(false);
    expect(isGeneratedImage('/x/aichi-view.webp')).toBe(false);
  });

  it('excludes -ai and missing files, auto-clears atoc-korea, and prefers cleared images', () => {
    const plan = planSceneImages(content, 6, (uri) => !uri.includes('missing'));
    expect(plan.excludedAi).toEqual(['/images/tours/jagalchi-market/jagalchi-seafood-collage-ai.webp']);
    expect(plan.missing).toEqual(['/images/tours/jagalchi-market/missing.webp']);
    expect(plan.pool[0]).toBe('/images/itinerary/jagalchi-harbor-sign.webp');
    expect(plan.licenses['/images/itinerary/jagalchi-harbor-sign.webp'].status).toBe('cleared');
    expect(plan.licenses['/images/tours/jagalchi-market/photo-001.webp'].status).toBe('unknown');
    expect(plan.selected).toHaveLength(6);
    expect(plan.selected[2]).toBe(plan.pool[0]);
    expect(plan.warnings.some((warningText) => warningText.includes('unreviewed licenses'))).toBe(true);
  });

  it('demotes bulk photo-NNN images when at least 3 curated shots exist', () => {
    const curatedContent: VideoLocalizedPoiContent = {
      ...content,
      images: [
        '/images/itinerary/jagalchi-harbor-sign.webp',
        '/images/itinerary/jagalchi-market-interior.webp',
        '/images/itinerary/jagalchi-night-building.webp',
        '/images/tours/jagalchi-market/photo-001.webp',
      ],
    };
    const plan = planSceneImages(curatedContent, 6, () => true);
    expect(plan.demotedBulk).toEqual(['/images/tours/jagalchi-market/photo-001.webp']);
    expect(plan.pool).toHaveLength(3);
    expect(plan.selected.every((uri) => !uri.includes('photo-001'))).toBe(true);
    expect(plan.warnings.some((warningText) => warningText.includes('demoted'))).toBe(true);
  });

  it('returns an empty plan when no usable images remain', () => {
    const plan = planSceneImages({ ...content, images: undefined, imageCredits: undefined }, 6, () => false);
    expect(plan.selected).toEqual([]);
  });
});

describe('subtitle cue chunking', () => {
  const longJa =
    'ジャガルチ市場（자갈치시장） — 韓国最大の水産市場であり、釜山の十大名所のひとつ — 中区の南浦港ウォーターフロントに位置し、地下鉄1号線ジャガルチ駅または南浦駅から徒歩約7分。';

  it('splits long CJK narration into display-sized cues inside the scene window', () => {
    const { cuesForScene: build } = require('@/lib/video-automation/produce/subtitleCues');
    const cues = build(longJa, 'ja', 12, 28);
    expect(cues.length).toBeGreaterThan(2);
    expect(cues.every((cue: { text: string }) => cue.text.length <= 28)).toBe(true);
    expect(cues[0].start).toBe(12);
    expect(cues.at(-1).end).toBe(28);
    for (let index = 1; index < cues.length; index += 1) {
      expect(cues[index].start).toBeGreaterThanOrEqual(cues[index - 1].end);
    }
  });

  it('keeps short narration as a single cue and serializes VTT/SRT', () => {
    const { cuesForScene: build, cuesToVtt, cuesToSrt } = require('@/lib/video-automation/produce/subtitleCues');
    const cues = build('Jagalchi Market in 60 seconds.', 'en', 0, 3);
    expect(cues).toHaveLength(1);
    expect(cuesToVtt(cues)).toContain('WEBVTT');
    expect(cuesToVtt(cues)).toContain('00:00:00.000 --> 00:00:03.000');
    expect(cuesToSrt(cues)).toContain('00:00:00,000 --> 00:00:03,000');
  });
});

describe('speech estimation', () => {
  it('estimates CJK speech slower per character than Latin', () => {
    const latin = estimateSpeechSeconds('A sentence about the market with some length to it.', 'en');
    const cjk = estimateSpeechSeconds('市場は釜山の代表的な観光地です。地元の雰囲気があります。', 'ja');
    expect(latin).toBeGreaterThan(1.8);
    expect(cjk).toBeGreaterThan(latin);
    expect(estimateSpeechSeconds('', 'en')).toBe(1.8);
  });
});
