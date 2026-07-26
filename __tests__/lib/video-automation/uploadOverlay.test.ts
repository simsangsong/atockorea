/**
 * @jest-environment node
 *
 * Subtitle-overlay upload contract: an overlay run uploads its ONE shared
 * neutral render exactly once, uploads a VTT per language, and stamps
 * subtitle_url on every poi_videos row (still pending_review — VP-D10 holds).
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { uploadProducedRun, type UploadDbClient } from '@/lib/video-automation/upload.server';

interface StoredUpload {
  bucketPath: string;
  contentType: string;
}

function fakeSupabase() {
  const uploads: StoredUpload[] = [];
  const upserts: Array<Record<string, unknown>> = [];
  const client: UploadDbClient = {
    from: () => ({
      upsert: async (row: Record<string, unknown>) => {
        upserts.push(row);
        return { error: null };
      },
    }),
    storage: {
      listBuckets: async () => ({ data: [{ name: 'tour-videos' }] }),
      createBucket: async () => ({ error: null }),
      from: () => ({
        upload: async (objectPath: string, _body: Buffer, options: Record<string, unknown>) => {
          uploads.push({ bucketPath: objectPath, contentType: String(options.contentType) });
          return { error: null };
        },
        getPublicUrl: (objectPath: string) => ({ data: { publicUrl: `https://cdn/${objectPath}` } }),
      }),
    },
  };
  return { client, uploads, upserts };
}

function writeOverlayRun(root: string): string {
  const runDir = path.join(root, '.tmp', 'video-automation', 'seongsan_ilchulbong', 'prod-v1-abc123');
  mkdirSync(path.join(runDir, 'renders'), { recursive: true });
  mkdirSync(path.join(runDir, 'subtitles'), { recursive: true });
  writeFileSync(path.join(runDir, 'renders', 'seongsan_ilchulbong-neutral.mp4'), Buffer.from('mp4-bytes'));
  writeFileSync(path.join(runDir, 'subtitles', 'en.vtt'), 'WEBVTT\n');
  writeFileSync(path.join(runDir, 'subtitles', 'ja.vtt'), 'WEBVTT\n\n1\n');
  writeFileSync(
    path.join(runDir, 'qc-production.json'),
    JSON.stringify({ poiId: 'seongsan_ilchulbong', version: 1, status: 'passed', checks: [] }),
  );
  writeFileSync(
    path.join(runDir, 'run-summary.json'),
    JSON.stringify({
      poiId: 'seongsan_ilchulbong',
      poster: null,
      renderMode: 'neutral-overlay',
      languages: [
        {
          language: 'en',
          renderPath: path.join(runDir, 'renders', 'seongsan_ilchulbong-neutral.mp4'),
          totalSeconds: 42,
          vttPath: path.join(runDir, 'subtitles', 'en.vtt'),
        },
        {
          language: 'ja',
          renderPath: path.join(runDir, 'renders', 'seongsan_ilchulbong-neutral.mp4'),
          totalSeconds: 42,
          vttPath: path.join(runDir, 'subtitles', 'ja.vtt'),
        },
      ],
    }),
  );
  return runDir;
}

describe('uploadProducedRun — subtitle-overlay runs', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'overlay-upload-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('uploads the shared render once, a VTT per language, and stamps subtitle_url', async () => {
    const runDir = writeOverlayRun(root);
    const { client, uploads, upserts } = fakeSupabase();

    const result = await uploadProducedRun(client, { root, runDir, allowWarnings: false });

    const mp4Uploads = uploads.filter((u) => u.bucketPath.endsWith('.mp4'));
    const vttUploads = uploads.filter((u) => u.bucketPath.endsWith('.vtt'));
    expect(mp4Uploads).toHaveLength(1); // shared neutral render — bytes go up once
    expect(mp4Uploads[0].bucketPath).toContain('/neutral-');
    expect(vttUploads).toHaveLength(2);
    expect(vttUploads.every((u) => u.contentType === 'text/vtt')).toBe(true);

    expect(upserts).toHaveLength(2);
    for (const row of upserts) {
      expect(row.status).toBe('pending_review'); // VP-D10 unchanged
      expect(String(row.video_url)).toContain('neutral-'); // both rows share the render
      expect(String(row.subtitle_url)).toMatch(/\.vtt$/);
    }
    expect(result.uploaded.map((u) => u.language).sort()).toEqual(['en', 'ja']);
  });

  it('fails loudly when an overlay run is missing its VTT', async () => {
    const runDir = writeOverlayRun(root);
    rmSync(path.join(runDir, 'subtitles', 'ja.vtt'));
    const { client } = fakeSupabase();
    await expect(uploadProducedRun(client, { root, runDir, allowWarnings: false })).rejects.toThrow(/Subtitles missing/);
  });
});
