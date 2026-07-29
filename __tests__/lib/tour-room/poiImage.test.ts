/**
 * P7.1 — the photo candidate resolver, and the source gate that stops the
 * planner from going back to reading one column.
 *
 * 🔴 The source gate matters more than the unit tests here, because this
 * failure is SILENT. A planner that reads `default_image_url` directly renders
 * a swatch for the 63 POIs whose photo lives in `images` — and a swatch is a
 * legitimate state for the 49 POIs that genuinely have none, so nothing looks
 * broken. No exception, no console error, no failing assertion. The screen just
 * quietly stops being about places.
 *
 * That is the shape this repo has already been bitten by twice (the arrival
 * narration resolver ignoring `match_pois`; the room media exits forgetting to
 * sign). Both were fixed the same way: gate the SOURCE, not the behaviour,
 * because the defect is forgetting to write the call in the first place.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { poiHasImage, poiImageCandidates } from '@/lib/tour-room/poiImage';

describe('poiImageCandidates', () => {
  it('puts the curated default first, then images in stored order', () => {
    expect(
      poiImageCandidates({
        default_image_url: '/a.webp',
        images: ['/b.webp', '/c.webp'],
      }),
    ).toEqual(['/a.webp', '/b.webp', '/c.webp']);
  });

  it('falls back to images when there is no default', () => {
    expect(poiImageCandidates({ default_image_url: null, images: ['/b.webp'] })).toEqual(['/b.webp']);
  });

  /**
   * The measured reason this returns a LIST rather than one URL.
   * `sanbangsan_mountain` shipped images[0]=photo-002 (absent) with
   * images[1]=photo-001 (present); `hueree_natural_park` had a live file at
   * index 2. `default || images[0]` would have discarded both.
   */
  it('keeps later entries so a dead first image can be recovered', () => {
    const candidates = poiImageCandidates({
      default_image_url: null,
      images: ['/dead.webp', '/live.webp'],
    });
    expect(candidates).toEqual(['/dead.webp', '/live.webp']);
    expect(candidates.length).toBeGreaterThan(1);
  });

  it('de-duplicates so one dead URL is not retried twice', () => {
    expect(
      poiImageCandidates({ default_image_url: '/same.webp', images: ['/same.webp', '/other.webp'] }),
    ).toEqual(['/same.webp', '/other.webp']);
  });

  it('ignores blanks, whitespace and non-strings without throwing', () => {
    expect(
      poiImageCandidates({
        default_image_url: '   ',
        images: ['', '  /ok.webp  ', null as unknown as string, 7 as unknown as string],
      }),
    ).toEqual(['/ok.webp']);
  });

  it('is empty for null, undefined and photoless POIs', () => {
    expect(poiImageCandidates(null)).toEqual([]);
    expect(poiImageCandidates(undefined)).toEqual([]);
    expect(poiImageCandidates({ default_image_url: null, images: null })).toEqual([]);
    expect(poiHasImage({ default_image_url: null, images: [] })).toBe(false);
    expect(poiHasImage({ default_image_url: null, images: ['/x.webp'] })).toBe(true);
  });
});

describe('planner photo source gate', () => {
  const planner = readFileSync(
    path.join(process.cwd(), 'components', 'tour-mode', 'plan', 'PlanEditorClient.tsx'),
    'utf8',
  );

  it('never reads default_image_url for rendering — only declares it on the type', () => {
    const reads = planner
      .split('\n')
      .map((line, i) => ({ line: line.trim(), no: i + 1 }))
      .filter(({ line }) => line.includes('default_image_url'))
      // The interface field is the declaration, not a read.
      .filter(({ line }) => !/^default_image_url\s*:\s*string\s*\|\s*null;$/.test(line));

    expect(reads.map((r) => `${r.no}: ${r.line}`)).toEqual([]);
  });

  it('declares images on the picker POI type so the API field is not dropped again', () => {
    expect(planner).toMatch(/images\s*:\s*string\[\]\s*\|\s*null;/);
  });

  it('renders POI thumbnails through the shared component', () => {
    expect(planner).toContain("from '@/components/tour-mode/plan/PoiThumb'");
    expect(planner).toContain('<PoiThumb');
  });

  /**
   * The API is the other half of the wiring: the planner cannot read a field
   * the route does not select. This broke once already in the other direction
   * (route sent it, screen ignored it), so pin both ends.
   */
  it('the pois route still selects images', () => {
    const route = readFileSync(
      path.join(process.cwd(), 'app', 'api', 'itinerary-builder', 'pois', 'route.ts'),
      'utf8',
    );
    expect(route).toMatch(/\bimages\b/);
  });
});
