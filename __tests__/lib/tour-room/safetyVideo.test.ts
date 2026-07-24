/**
 * The 30-second safety film — the VTT track path (plan §5.6 / §5.7).
 *
 * The MP4 does not exist yet (a human deliverable). Everything that makes it
 * playable the moment it lands DOES, and is asserted here:
 *   ① the 10-locale script is complete and the generated WebVTT parses;
 *   ② the committed public/ tracks match the script (no silent drift);
 *   ③ the track list, the `default` selection, and the metadata contract;
 *   ④ the server fetch stays behind the approval gate and fails open to null.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  SAFETY_SCRIPT_CUES,
  SAFETY_SCRIPT_LOCALES,
  SAFETY_VIDEO_DURATION_SECONDS,
  buildSafetyVtt,
  safetyVideoMetadata,
  safetyVttTime,
} from '@/lib/video-automation/safetyScript';
import {
  SAFETY_SUBTITLE_LOCALES,
  SAFETY_SUBTITLE_TRACKS,
  SAFETY_VIDEO_LANGUAGE,
  SAFETY_VIDEO_POI_KEY,
  defaultSafetySubtitleLocale,
  isSafetyVideoMeta,
  matchSafetySubtitleLocale,
} from '@/lib/tour-room/safetyVideo';
import { fetchSafetyVideoCard } from '@/lib/tour-room/safetyVideo.server';

describe('the 10-locale script', () => {
  it('covers all 10 languages in every cue', () => {
    expect(SAFETY_SCRIPT_LOCALES).toHaveLength(10);
    for (const cue of SAFETY_SCRIPT_CUES) {
      for (const locale of SAFETY_SCRIPT_LOCALES) {
        expect(typeof cue.text[locale]).toBe('string');
        expect(cue.text[locale].trim()).not.toBe('');
      }
    }
  });

  it('is a contiguous 30 seconds with no gaps or overlaps', () => {
    let cursor = 0;
    for (const cue of SAFETY_SCRIPT_CUES) {
      expect(cue.start).toBe(cursor);
      expect(cue.end).toBeGreaterThan(cue.start);
      cursor = cue.end;
    }
    expect(cursor).toBe(SAFETY_VIDEO_DURATION_SECONDS);
  });

  it('states the three obligations and nothing promotional', () => {
    const en = SAFETY_SCRIPT_CUES.map((c) => c.text.en).join('\n');
    expect(en).toMatch(/seatbelts on/i);
    expect(en).toMatch(/no smoking/i);
    expect(en).toMatch(/don't talk to the driver/i);
    expect(en).not.toMatch(/amazing|unforgettable|best tour/i);
  });

  it('formats WebVTT timestamps', () => {
    expect(safetyVttTime(0)).toBe('00:00:00.000');
    expect(safetyVttTime(3)).toBe('00:00:03.000');
    expect(safetyVttTime(90.5)).toBe('00:01:30.500');
  });

  it('builds a parseable WebVTT document per locale', () => {
    for (const locale of SAFETY_SCRIPT_LOCALES) {
      const vtt = buildSafetyVtt(locale);
      expect(vtt.startsWith('WEBVTT\n')).toBe(true);
      expect(vtt).toContain('00:00:00.000 --> 00:00:03.000');
      expect((vtt.match(/-->/g) ?? []).length).toBe(SAFETY_SCRIPT_CUES.length);
      expect(vtt).not.toContain('undefined');
    }
  });

  it('emits the chapter sidecar the producer works from', () => {
    const meta = safetyVideoMetadata();
    expect(meta).toMatchObject({ duration: 30, audio: 'silent', resolution: { width: 1080, height: 1920 } });
    expect(meta.locales).toHaveLength(10);
    expect(meta.chapters.map((c) => c.id)).toEqual(SAFETY_SCRIPT_CUES.map((c) => c.id));
  });
});

describe('the committed public/ tracks', () => {
  const base = path.join(process.cwd(), 'public', 'videos', 'safety-intro-30s');

  it('exist and match the script byte-for-byte (npm run safety:vtt is not stale)', () => {
    for (const locale of SAFETY_SCRIPT_LOCALES) {
      const file = path.join(base, 'subtitles', `${locale}.vtt`);
      expect(readFileSync(file, 'utf8')).toBe(buildSafetyVtt(locale));
    }
  });

  it('are exactly the files the track list points at', () => {
    for (const track of SAFETY_SUBTITLE_TRACKS) {
      expect(track.src).toBe(`/videos/safety-intro-30s/subtitles/${track.srclang}.vtt`);
      expect(() => readFileSync(path.join(process.cwd(), 'public', track.src), 'utf8')).not.toThrow();
    }
  });
});

describe('track selection', () => {
  it('ships one track per language, each labelled in its own language', () => {
    expect(SAFETY_SUBTITLE_TRACKS).toHaveLength(SAFETY_SUBTITLE_LOCALES.length);
    expect(SAFETY_SUBTITLE_TRACKS.find((t) => t.srclang === 'ko')!.label).toBe('한국어');
    expect(SAFETY_SUBTITLE_TRACKS.find((t) => t.srclang === 'de')!.label).toBe('Deutsch');
  });

  it('maps a raw chat locale onto a shipped track', () => {
    expect(matchSafetySubtitleLocale('de')).toBe('de');
    expect(matchSafetySubtitleLocale('de-AT')).toBe('de');
    expect(matchSafetySubtitleLocale('fr_CA')).toBe('fr');
    expect(matchSafetySubtitleLocale('zh-TW')).toBe('zh-TW');
    expect(matchSafetySubtitleLocale('zh_Hant')).toBe('zh-TW');
    expect(matchSafetySubtitleLocale('zh-HK')).toBe('zh-TW');
    expect(matchSafetySubtitleLocale('zh')).toBe('zh-CN');
    expect(matchSafetySubtitleLocale('zh-CN')).toBe('zh-CN');
    expect(matchSafetySubtitleLocale('pt-BR')).toBeNull();
    expect(matchSafetySubtitleLocale(null)).toBeNull();
  });

  it("defaults to the viewer's own language, then the room locale, then English", () => {
    // The bridge knows this guest writes German even though the room is English.
    expect(defaultSafetySubtitleLocale('en', 'de')).toBe('de');
    expect(defaultSafetySubtitleLocale('ja', null)).toBe('ja');
    expect(defaultSafetySubtitleLocale('zh', null)).toBe('zh-CN');
    // A language we do not ship falls back rather than picking nothing.
    expect(defaultSafetySubtitleLocale('ko', 'pt-BR')).toBe('ko');
    expect(defaultSafetySubtitleLocale('en', 'pt-BR')).toBe('en');
  });

  it('recognises a real metadata blob and rejects an empty one', () => {
    expect(isSafetyVideoMeta({ video_url: 'https://cdn/a.mp4', tracks: [] })).toBe(true);
    expect(isSafetyVideoMeta({ video_url: '' })).toBe(false);
    expect(isSafetyVideoMeta(null)).toBe(false);
    expect(isSafetyVideoMeta({ urls: { en: 'x' } })).toBe(false);
  });
});

describe('fetchSafetyVideoCard — the approval gate', () => {
  function db(rows: unknown, throws = false) {
    const filters: Array<[string, unknown]> = [];
    const client = {
      filters,
      from() {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = (col: string, value: unknown) => {
          filters.push([col, value]);
          return chain;
        };
        chain.order = () => chain;
        chain.limit = () => chain;
        chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          throws ? Promise.reject(new Error('boom')).then(res, rej) : Promise.resolve({ data: rows }).then(res, rej);
        return chain;
      },
    };
    return client;
  }

  it('serves only approved safety rows (kind + sentinel + language + status)', async () => {
    const client = db([{ video_url: 'https://cdn/safety.mp4', poster_url: 'p.jpg', duration_seconds: '30' }]);
    const card = await fetchSafetyVideoCard(client);
    expect(card).toEqual({
      video_url: 'https://cdn/safety.mp4',
      poster_url: 'p.jpg',
      duration_seconds: 30,
      tracks: [...SAFETY_SUBTITLE_TRACKS],
    });
    expect(client.filters).toEqual([
      ['kind', 'safety'],
      ['poi_key', SAFETY_VIDEO_POI_KEY],
      ['language', SAFETY_VIDEO_LANGUAGE],
      ['status', 'approved'],
    ]);
  });

  it('returns null when nothing is approved (today) — no placeholder', async () => {
    await expect(fetchSafetyVideoCard(db([]))).resolves.toBeNull();
    await expect(fetchSafetyVideoCard(db([{ video_url: '' }]))).resolves.toBeNull();
  });

  it('fails open to null when the query blows up', async () => {
    await expect(fetchSafetyVideoCard(db(null, true))).resolves.toBeNull();
  });
});
