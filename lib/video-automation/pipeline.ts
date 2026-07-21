import { createHash } from 'node:crypto';
import {
  DEFAULT_VIDEO_LANGUAGE_CODES,
  type VideoLanguageCode,
  videoLanguageProfile,
} from '@/lib/video-automation/languages';
import type {
  AppVideoCardPayload,
  FacebookPublicationPayload,
  LanguageOutputPaths,
  VideoAsset,
  VideoAssetManifest,
  VideoLocalizedPoiContent,
  VideoPoiSource,
  VideoQcReport,
  VideoScript,
  VideoScriptScene,
  VideoStoryboard,
  VideoStoryboardScene,
} from '@/lib/video-automation/types';

const TIMELINE = [
  { start: 0, end: 3, layout: 'hero_intro', template: 'Hero intro', visualIntent: 'Hook shot and POI name' },
  { start: 3, end: 12, layout: 'poi_title', template: 'POI title', visualIntent: 'Core identity' },
  { start: 12, end: 28, layout: 'culture_card', template: 'History or culture card', visualIntent: 'Verified background' },
  { start: 28, end: 43, layout: 'must_see', template: 'Must-see highlight', visualIntent: 'Main viewing point' },
  { start: 43, end: 53, layout: 'visit_tip', template: 'Visit tip', visualIntent: 'Practical or experience tip' },
  { start: 53, end: 60, layout: 'smartguide_cta', template: 'Smart Guide message', visualIntent: 'ATOCKOREA CTA' },
] as const;

const CTA_BY_LANGUAGE: Record<VideoLanguageCode, string> = {
  en: 'Open ATOCKOREA Smart Guide for maps, captions, and local tips at the spot.',
  'zh-Hant': '開啟 ATOCKOREA 智慧導覽，查看地圖、字幕與現場提示。',
  ja: 'ATOCKOREAスマートガイドで地図、字幕、現地ヒントを確認してください。',
  es: 'Abre ATOCKOREA Smart Guide para ver mapas, subtitulos y consejos en el lugar.',
};

const HOOK_BY_LANGUAGE: Record<VideoLanguageCode, (name: string) => string> = {
  en: (name) => `${name} in 60 seconds.`,
  'zh-Hant': (name) => `用 60 秒認識 ${name}。`,
  ja: (name) => `${name}を60秒で案内します。`,
  es: (name) => `${name} en 60 segundos.`,
};

const TITLE_SUFFIX_BY_LANGUAGE: Record<VideoLanguageCode, string> = {
  en: '1-minute smart guide',
  'zh-Hant': '1 分鐘智慧導覽',
  ja: '1分スマートガイド',
  es: 'Guia inteligente de 1 minuto',
};

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(value: string, fallback: string): string {
  const clean = cleanText(value);
  if (!clean) return fallback;
  // CJK terminators (。！？) end a sentence with no trailing space; Latin ones need a following space or end-of-string.
  const match = clean.match(/^(.{12,220}?(?:[.!?](?=\s|$)|[。！？]))/);
  return (match?.[1] ?? clean.slice(0, 220)).trim();
}

function pickContent(source: VideoPoiSource, language: VideoLanguageCode): VideoLocalizedPoiContent {
  const direct = source.localized[language];
  if (direct) return direct;
  const english = source.localized.en;
  if (english) return { ...english, language, sourceLocale: videoLanguageProfile(language).sourceLocale };
  return {
    language,
    sourceLocale: videoLanguageProfile(language).sourceLocale,
    name: source.canonicalName,
    highlights: [],
    sourceFactIds: source.sourcePaths.map((path) => `source:${path}`),
  };
}

function assetIdFor(poiId: string, uri: string, index: number): string {
  const hash = createHash('sha1').update(uri).digest('hex').slice(0, 10);
  return `${poiId}-asset-${index + 1}-${hash}`;
}

export function buildVideoJobKey(input: {
  poiId: string;
  version: number;
  targetLanguages?: VideoLanguageCode[];
  brandProfile?: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        poiId: input.poiId,
        version: input.version,
        targetLanguages: input.targetLanguages ?? DEFAULT_VIDEO_LANGUAGE_CODES,
        brandProfile: input.brandProfile ?? 'atockorea-default',
      }),
    )
    .digest('hex')
    .slice(0, 20);
}

export function buildAssetManifest(
  source: VideoPoiSource,
  options?: { version?: number; targetLanguages?: VideoLanguageCode[] },
): VideoAssetManifest {
  const version = options?.version ?? 1;
  const targetLanguages = options?.targetLanguages ?? [...DEFAULT_VIDEO_LANGUAGE_CODES];
  const uris = new Set<string>();
  for (const content of Object.values(source.localized)) {
    if (content?.image) uris.add(content.image);
  }

  const assets: VideoAsset[] = [...uris].map((uri, index) => ({
    assetId: assetIdFor(source.poiId, uri, index),
    poiId: source.poiId,
    kind: 'image',
    uri,
    fileType: uri.split('?')[0]?.split('.').pop()?.toLowerCase() || 'image',
    source: source.tourSlug ? `tour-static:${source.tourSlug}` : 'poi_kb',
    licenseStatus: 'unknown',
    reviewStatus: 'pending',
    publishable: false,
    notes: ['License must be confirmed before automatic publishing.'],
  }));

  return {
    poiId: source.poiId,
    version,
    targetLanguages,
    assets,
    sourceVideoStatus: 'source_pending',
    warnings: [
      'Original video sources are pending; scene analysis is a placeholder until source clips are attached.',
      ...(assets.length === 0 ? ['No POI images were found for this pilot source.'] : []),
    ],
    jobKey: buildVideoJobKey({ poiId: source.poiId, version, targetLanguages }),
  };
}

export function publishableAssets(manifest: VideoAssetManifest): VideoAsset[] {
  return manifest.assets.filter((asset) => asset.publishable && asset.licenseStatus === 'cleared');
}

export function buildVideoScript(source: VideoPoiSource, language: VideoLanguageCode): VideoScript {
  const content = pickContent(source, language);
  const name = content.name || source.canonicalName;
  const facts = content.sourceFactIds.length > 0 ? content.sourceFactIds : source.sourcePaths.map((path) => `source:${path}`);
  const highlights = content.highlights.map(cleanText).filter(Boolean);
  const smartNotes = content.smartNotes ?? {};
  const visitBasics = content.visitBasics ?? {};

  const identity = firstSentence(content.category || content.description || '', `${name} is one of Korea's memorable travel stops.`);
  const background = firstSentence(content.description || highlights[0] || '', identity);
  const mustSee = cleanText(highlights[0] || smartNotes.photo || background);
  const tip = cleanText(smartNotes.tip || visitBasics.walking || smartNotes.facilities || mustSee);
  const cta = CTA_BY_LANGUAGE[language];

  const narration = [
    HOOK_BY_LANGUAGE[language](name),
    identity,
    background,
    mustSee,
    tip,
    cta,
  ];

  const scenes: VideoScriptScene[] = TIMELINE.map((slot, index) => ({
    sceneId: `scene-${String(index + 1).padStart(3, '0')}`,
    start: slot.start,
    end: slot.end,
    template: slot.template,
    visualIntent: slot.visualIntent,
    narration: firstSentence(narration[index] ?? name, name),
    screenText: index === 0 ? name : index === 5 ? 'ATOCKOREA Smart Guide' : firstSentence(narration[index] ?? name, name),
    assetCandidates: [],
    sourceFactIds: facts.slice(0, 4),
  }));

  return {
    poiId: source.poiId,
    duration: 60,
    language,
    sourceLocale: content.sourceLocale,
    scenes,
  };
}

export function buildStoryboard(script: VideoScript, manifest: VideoAssetManifest): VideoStoryboard {
  const imageCandidates = manifest.assets.filter((asset) => asset.kind === 'image').map((asset) => asset.assetId);
  const scenes: VideoStoryboardScene[] = script.scenes.map((scene, index) => {
    const slot = TIMELINE[index];
    return {
      ...scene,
      layout: slot.layout,
      assetCandidates: imageCandidates,
      overlays: [
        { type: index === 0 ? 'title' : 'subtitle', text: scene.screenText },
        ...(index === 5 ? [{ type: 'logo' as const, text: 'ATOCKOREA' }, { type: 'cta' as const, text: scene.narration }] : []),
      ],
      renderNotes:
        manifest.sourceVideoStatus === 'source_pending'
          ? ['Use POI image pan/zoom placeholder until original video sources are attached.']
          : ['Use selected source clip and preserve 9:16 safe area.'],
    };
  });

  return {
    poiId: script.poiId,
    language: script.language,
    duration: script.duration,
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    scenes,
  };
}

export function buildAppVideoCardPayload(input: {
  source: VideoPoiSource;
  version?: number;
  posterPath?: string | null;
  languageOutputs: LanguageOutputPaths[];
}): AppVideoCardPayload {
  const version = input.version ?? 1;
  return {
    type: 'poi_video',
    poiId: input.source.poiId,
    title: `${input.source.canonicalName} ${TITLE_SUFFIX_BY_LANGUAGE.en}`,
    posterUrl: input.posterPath ?? null,
    duration: 60,
    version,
    status: input.languageOutputs.some((output) => output.mp4Path) ? 'awaiting_publish_approval' : 'awaiting_media_source',
    defaultLanguage: 'en',
    languages: input.languageOutputs.map((output) => {
      const profile = videoLanguageProfile(output.language);
      return {
        language: output.language,
        roomLocale: profile.roomLocale,
        streamUrl: null,
        fallbackUrl: output.mp4Path,
        captionUrl: output.vttPath,
        narrationAudioUrl: output.narrationAudioPath,
      };
    }),
    analyticsEvents: [
      'card_shown',
      'preview_started',
      'video_started',
      '25_percent',
      '50_percent',
      '75_percent',
      'completed',
      'dismissed',
      'replayed',
    ],
  };
}

export function buildFacebookPublicationPayload(input: {
  source: VideoPoiSource;
  manifest: VideoAssetManifest;
  version?: number;
  posterPath?: string | null;
  videoPath?: string | null;
}): FacebookPublicationPayload {
  const version = input.version ?? 1;
  return {
    target: 'facebook',
    mode: 'dry_run',
    poiId: input.source.poiId,
    version,
    duplicateKey: `${input.source.poiId}:facebook:v${version}:${input.manifest.jobKey}`,
    title: `${input.source.canonicalName} | ATOCKOREA 1-minute guide`,
    description: `A 1-minute smart guide for ${input.source.canonicalName}. Draft payload only; native upload requires admin approval and Meta credentials.`,
    hashtags: ['#ATOCKOREA', '#KoreaTravel', '#SmartGuide', `#${input.source.poiId.replace(/[^a-z0-9]/gi, '')}`],
    coverImagePath: input.posterPath ?? null,
    videoPath: input.videoPath ?? null,
    requiresApproval: true,
    nativeUpload: true,
    notes: [
      'Do not publish to a production Facebook Page without explicit admin approval.',
      'Use native Facebook video upload, not a shared Cloudinary link.',
      input.manifest.sourceVideoStatus === 'source_pending'
        ? 'Original video sources are pending; this payload is not publishable yet.'
        : 'Confirm license and QC status before upload.',
    ],
  };
}

export function buildQcReport(input: {
  source: VideoPoiSource;
  manifest: VideoAssetManifest;
  scripts: VideoScript[];
  languageOutputs: LanguageOutputPaths[];
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  version?: number;
}): VideoQcReport {
  const checks: VideoQcReport['checks'] = [];
  const add = (name: string, status: 'passed' | 'warning' | 'failed', detail: string) => {
    checks.push({ name, status, detail });
  };

  add(
    'target_languages',
    input.scripts.length > 0 && input.scripts.length === input.manifest.targetLanguages.length ? 'passed' : 'failed',
    `${input.scripts.length}/${input.manifest.targetLanguages.length} language scripts generated`,
  );
  add('source_video', input.manifest.sourceVideoStatus === 'provided' ? 'passed' : 'warning', input.manifest.sourceVideoStatus);
  add('asset_license', publishableAssets(input.manifest).length > 0 ? 'passed' : 'warning', 'No assets are auto-publishable until license review is approved.');
  add('subtitles', input.languageOutputs.every((output) => output.vttPath && output.srtPath) ? 'passed' : 'failed', 'WebVTT and SRT paths created for each language.');
  add('narration_audio', input.languageOutputs.every((output) => output.narrationAudioPath) ? 'passed' : 'warning', 'Mock narration WAV files are placeholders for provider TTS.');
  add('ffmpeg', input.ffmpegAvailable ? 'passed' : 'warning', input.ffmpegAvailable ? 'ffmpeg available' : 'ffmpeg missing; MP4 render skipped.');
  add('ffprobe', input.ffprobeAvailable ? 'passed' : 'warning', input.ffprobeAvailable ? 'ffprobe available' : 'ffprobe missing; media probing skipped.');
  add(
    'mp4_render',
    input.languageOutputs.some((output) => output.mp4Path) ? 'passed' : 'warning',
    input.languageOutputs.some((output) => output.mp4Path)
      ? 'Placeholder MP4 files rendered.'
      : 'Rendered MP4 requires ffmpeg and source media.',
  );

  const failed = checks.some((check) => check.status === 'failed');
  const warning = checks.some((check) => check.status === 'warning');
  return {
    poiId: input.source.poiId,
    version: input.version ?? 1,
    status: failed ? 'failed' : warning ? 'warning' : 'passed',
    checks,
  };
}
