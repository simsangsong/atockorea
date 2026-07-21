import {
  DEFAULT_VIDEO_LANGUAGE_CODES,
  VIDEO_TARGET_LANGUAGES,
} from '@/lib/video-automation/languages';
import {
  buildAppVideoCardPayload,
  buildAssetManifest,
  buildFacebookPublicationPayload,
  buildQcReport,
  buildStoryboard,
  buildVideoScript,
  publishableAssets,
} from '@/lib/video-automation/pipeline';
import { buildSrt, buildWebVtt } from '@/lib/video-automation/subtitles';
import type { LanguageOutputPaths, VideoPoiSource } from '@/lib/video-automation/types';

const source: VideoPoiSource = {
  poiId: 'gyeongbokgung_palace',
  canonicalName: 'Gyeongbokgung Palace',
  tourSlug: 'from-incheon-seoul-day-tour-cruise-guests',
  sourcePaths: ['components/product-tour-static/example/example.en.json'],
  localized: {
    en: {
      language: 'en',
      sourceLocale: 'en',
      name: 'Gyeongbokgung Palace',
      category: 'Joseon royal palace in central Seoul.',
      description: 'Gyeongbokgung Palace is a major royal palace and a central Seoul landmark. It is known for broad courtyards and palace gates.',
      image: '/images/tours/gyeongbokgung/example.webp',
      highlights: ['See the main gate and palace courtyards.', 'Watch for seasonal palace views.'],
      smartNotes: { tip: 'Use the Smart Guide card for current hours instead of baking them into video.' },
      sourceFactIds: ['file:example.en.json', 'source:official'],
    },
    'zh-Hant': {
      language: 'zh-Hant',
      sourceLocale: 'zh-TW',
      name: 'Gyeongbokgung Palace',
      description: 'Localized Traditional Chinese source.',
      highlights: ['Localized highlight.'],
      sourceFactIds: ['file:example.zh-TW.json'],
    },
    ja: {
      language: 'ja',
      sourceLocale: 'ja',
      name: 'Gyeongbokgung Palace',
      description: 'Localized Japanese source.',
      highlights: ['Localized highlight.'],
      sourceFactIds: ['file:example.ja.json'],
    },
    es: {
      language: 'es',
      sourceLocale: 'es',
      name: 'Gyeongbokgung Palace',
      description: 'Fuente localizada en espanol.',
      highlights: ['Patios del palacio.'],
      sourceFactIds: ['file:example.es.json'],
    },
  },
};

describe('video automation pipeline', () => {
  it('defaults to the four requested subtitle and narration languages', () => {
    expect(DEFAULT_VIDEO_LANGUAGE_CODES).toEqual(['en', 'zh-Hant', 'ja', 'es']);
    expect(VIDEO_TARGET_LANGUAGES.map((language) => language.sourceLocale)).toEqual(['en', 'zh-TW', 'ja', 'es']);
  });

  it('builds a structured 60-second script with fact references', () => {
    const script = buildVideoScript(source, 'en');
    expect(script.duration).toBe(60);
    expect(script.scenes).toHaveLength(6);
    expect(script.scenes[0]).toMatchObject({ start: 0, end: 3, template: 'Hero intro' });
    expect(script.scenes.at(-1)).toMatchObject({ start: 53, end: 60 });
    expect(script.scenes.every((scene) => scene.sourceFactIds.length > 0)).toBe(true);
  });

  it('creates WebVTT, SRT, and storyboard scene contracts', () => {
    const manifest = buildAssetManifest(source);
    const script = buildVideoScript(source, 'en');
    const storyboard = buildStoryboard(script, manifest);
    expect(buildWebVtt(script)).toContain('WEBVTT');
    expect(buildWebVtt(script)).toContain('00:00:00.000 --> 00:00:03.000');
    expect(buildSrt(script)).toContain('00:00:00,000 --> 00:00:03,000');
    expect(storyboard.resolution).toEqual({ width: 1080, height: 1920 });
    expect(storyboard.scenes[0].assetCandidates).toHaveLength(1);
  });

  it('does not auto-publish assets whose license has not been cleared', () => {
    const manifest = buildAssetManifest(source);
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0].licenseStatus).toBe('unknown');
    expect(publishableAssets(manifest)).toEqual([]);
  });

  it('splits CJK sentences without requiring trailing whitespace', () => {
    const cjkSource: VideoPoiSource = {
      ...source,
      localized: {
        ...source.localized,
        ja: {
          language: 'ja',
          sourceLocale: 'ja',
          name: '景福宮',
          description:
            '景福宮は朝鮮王朝の正宮であり、ソウル中心部を代表するランドマークです。広い中庭と壮大な門で知られ、四季折々の風景が楽しめます。守門将交代式は多くの旅行者に人気があります。',
          highlights: ['ハイライト。'],
          sourceFactIds: ['file:example.ja.json'],
        },
      },
    };
    const script = buildVideoScript(cjkSource, 'ja');
    const backgroundScene = script.scenes[2];
    expect(backgroundScene.narration.endsWith('です。')).toBe(true);
    expect(backgroundScene.narration.length).toBeLessThan(60);
  });

  it('passes the target_languages QC check when languages are overridden', () => {
    const manifest = buildAssetManifest(source, { targetLanguages: ['en'] });
    const outputs: LanguageOutputPaths[] = [
      {
        language: 'en',
        narrationTextPath: '.tmp/en.txt',
        narrationAudioPath: '.tmp/en.wav',
        vttPath: '.tmp/en.vtt',
        srtPath: '.tmp/en.srt',
        mp4Path: null,
        renderStatus: 'blocked_by_missing_ffmpeg',
      },
    ];
    const qc = buildQcReport({
      source,
      manifest,
      scripts: [buildVideoScript(source, 'en')],
      languageOutputs: outputs,
      ffmpegAvailable: false,
      ffprobeAvailable: false,
    });
    const languageCheck = qc.checks.find((check) => check.name === 'target_languages');
    expect(languageCheck?.status).toBe('passed');
    expect(qc.status).toBe('warning');
  });

  it('builds app and Facebook dry-run payloads for all language variants', () => {
    const manifest = buildAssetManifest(source);
    const outputs: LanguageOutputPaths[] = DEFAULT_VIDEO_LANGUAGE_CODES.map((language) => ({
      language,
      narrationTextPath: `.tmp/${language}.txt`,
      narrationAudioPath: `.tmp/${language}.wav`,
      vttPath: `.tmp/${language}.vtt`,
      srtPath: `.tmp/${language}.srt`,
      mp4Path: null,
      renderStatus: 'blocked_by_missing_ffmpeg',
    }));
    const card = buildAppVideoCardPayload({ source, posterPath: '.tmp/poster.png', languageOutputs: outputs });
    const facebook = buildFacebookPublicationPayload({ source, manifest, posterPath: '.tmp/poster.png' });
    const qc = buildQcReport({
      source,
      manifest,
      scripts: DEFAULT_VIDEO_LANGUAGE_CODES.map((language) => buildVideoScript(source, language)),
      languageOutputs: outputs,
      ffmpegAvailable: false,
      ffprobeAvailable: false,
    });

    expect(card.languages.map((language) => language.language)).toEqual(['en', 'zh-Hant', 'ja', 'es']);
    expect(card.status).toBe('awaiting_media_source');
    expect(facebook.mode).toBe('dry_run');
    expect(facebook.requiresApproval).toBe(true);
    expect(qc.status).toBe('warning');
  });
});
