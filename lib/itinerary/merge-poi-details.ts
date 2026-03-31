import type { GeminiDraft } from './types';
import type { GeneratedItineraryResponse, JejuPoiRow } from './types';
import { extractItineraryPhotoGalleryItems } from './photo-gallery-from-poi';
import { dwellMinutesForStop } from './stop-metrics';

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function shortDesc(row: JejuPoiRow, locale: 'ko' | 'en'): string | null {
  const ko = str(row.admin_short_desc_ko);
  const en = str(row.admin_short_desc_en);
  if (locale === 'en' && en) return en;
  if (ko) return ko;
  if (en) return en;
  const ov = str(row.overview);
  if (!ov) return null;
  return ov.length > 160 ? `${ov.slice(0, 157)}…` : ov;
}

export function hydrateStops(
  draft: GeminiDraft,
  rowsByContentId: Map<string, JejuPoiRow>,
  locale: 'ko' | 'en',
): GeneratedItineraryResponse['stops'] {
  const sorted = [...draft.stops].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.map((s, i) => {
    const row = rowsByContentId.get(s.contentId);
    if (!row) {
      throw new Error(`hydrate: missing row for ${s.contentId}`);
    }
    const photoGallery = extractItineraryPhotoGalleryItems(row);
    /** Single representative URL for clients that only read `image`; full gallery stays in `photoGallery`. */
    const img =
      photoGallery[0]?.imageUrl ?? str(row.first_image) ?? str(row.first_image2);
    const duration = dwellMinutesForStop(s, row);
    return {
      contentId: s.contentId,
      contentTypeId: s.contentTypeId ?? row.content_type_id ?? 12,
      title: str(row.title) || 'Unknown',
      image: img,
      shortDescription: shortDesc(row, locale),
      overview: str(row.overview),
      reason: s.reason,
      plannedDurationMin: duration,
      sortOrder: i + 1,
      addr1: str(row.addr1),
      addr2: str(row.addr2),
      useTimeText: str(row.use_time_text),
      feeText: str(row.fee_text),
      parkingInfo: str(row.parking_info),
      reservationInfo: str(row.reservation_info),
      restDate: str(row.rest_date),
      tel: str(row.tel),
      homepage: str(row.homepage),
      mapx: toNum(row.mapx),
      mapy: toNum(row.mapy),
      adminNoteKo: str(row.admin_note_ko),
      adminNoteEn: str(row.admin_note_en),
      tags: Array.isArray(row.admin_tags) ? row.admin_tags : null,
      isIndoor: row.is_indoor ?? null,
      isOutdoor: row.is_outdoor ?? null,
      isFree: row.is_free ?? null,
      isPaid: row.is_paid ?? null,
      regionGroup: str(row.region_group),
      photoGallery,
    };
  });
}
