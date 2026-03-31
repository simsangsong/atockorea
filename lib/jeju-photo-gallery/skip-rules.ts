/**
 * Skip / exclusion rules for Jeju photo backfill (Udo, Samseonghyeol, env lists).
 * No Tour API calls — pure matching only.
 */

/** Default Tour API content_id exclusions (see project audit / `data/output/jeju-*.json`). */
export const DEFAULT_SKIP_CONTENT_IDS = [
  { contentId: '127336', contentTypeId: 12, reason: 'Udo (우도)' },
  { contentId: '127744', contentTypeId: 12, reason: 'Samseonghyeol (제주 삼성혈)' },
] as const;

/**
 * Title normalization aligned with `scripts/import-jeju-photo-gallery.ts` `normalizeTitle`
 * for stable matching of skip lists.
 */
export function normalizeTitleForPhotoSkip(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\s+/g, '')
    .replace(/[()（）\[\]·\-_,.]/g, '')
    .replace(/^제주(특별자치도|도)?/u, '')
    .trim();
}

function parseCsv(raw: string): string[] {
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export type SkipPoiToken =
  | { kind: 'db_id'; id: number }
  | { kind: 'content'; contentId: string; contentTypeId: number };

/**
 * Parses `JEJU_PHOTO_GALLERY_SKIP_POI_IDS`:
 * - `id:12345` / `db:12345` → database PK on `jeju_kor_tourapi_places.id`
 * - `content:127336` / `c:127336` → Tour `content_id` (default type 12)
 * - `127336@12` → content_id @ content_type_id
 * - bare digits `127336` → treated as Tour `content_id` with type `defaultContentTypeId` (12)
 */
export function parseSkipPoiIdTokens(
  csv: string,
  defaultContentTypeId = 12,
): SkipPoiToken[] {
  const out: SkipPoiToken[] = [];
  for (const part of parseCsv(csv)) {
    const lower = part.toLowerCase();
    if (lower.startsWith('id:') || lower.startsWith('db:')) {
      const n = parseInt(part.split(':')[1]?.trim() ?? '', 10);
      if (Number.isFinite(n)) out.push({ kind: 'db_id', id: n });
      continue;
    }
    const at = part.indexOf('@');
    if (at > 0) {
      const cid = part.slice(0, at).trim();
      const tid = parseInt(part.slice(at + 1).trim(), 10);
      if (cid && Number.isFinite(tid)) {
        out.push({ kind: 'content', contentId: cid, contentTypeId: tid });
      }
      continue;
    }
    if (lower.startsWith('content:') || lower.startsWith('c:')) {
      const cid = part.split(':')[1]?.trim() ?? '';
      if (cid) out.push({ kind: 'content', contentId: cid, contentTypeId: defaultContentTypeId });
      continue;
    }
    if (/^\d+$/.test(part)) {
      out.push({ kind: 'content', contentId: part, contentTypeId: defaultContentTypeId });
    }
  }
  return out;
}

export type PhotoBackfillSkipContext = {
  /** Normalized skip titles (from `JEJU_PHOTO_GALLERY_SKIP_TITLES`). */
  skipTitleNorms: Set<string>;
  /** Normalized skip aliases. */
  skipAliasNorms: Set<string>;
  /** Explicit content_id + type skips from env. */
  skipTokens: SkipPoiToken[];
  /** Include default Udo / Samseonghyeol exclusions. */
  useDefaultIslandExclusions: boolean;
};

export type PoiRowForSkipCheck = {
  id: number;
  content_id: string;
  content_type_id: number;
  title: string | null;
};

/**
 * Public slug for POI rows: Tour API `content_id` (table has no dedicated slug column).
 */
export function getPoiSlugLikeId(row: Pick<PoiRowForSkipCheck, 'content_id'>): string {
  return String(row.content_id).trim();
}

function matchesToken(row: PoiRowForSkipCheck, t: SkipPoiToken): boolean {
  if (t.kind === 'db_id') return row.id === t.id;
  return row.content_id === t.contentId && row.content_type_id === t.contentTypeId;
}

function matchesDefaultExclusion(row: PoiRowForSkipCheck): { skip: boolean; reason?: string } {
  for (const ex of DEFAULT_SKIP_CONTENT_IDS) {
    if (row.content_id === ex.contentId && row.content_type_id === ex.contentTypeId) {
      return { skip: true, reason: ex.reason };
    }
  }
  return { skip: false };
}

/**
 * Returns `{ skip, reason }` if this POI must be excluded from the ranked target pool.
 */
export function shouldSkipPoiForPhotoBackfill(
  row: PoiRowForSkipCheck,
  ctx: PhotoBackfillSkipContext,
): { skip: boolean; reason?: string } {
  if (ctx.useDefaultIslandExclusions) {
    const d = matchesDefaultExclusion(row);
    if (d.skip) return d;
  }
  for (const t of ctx.skipTokens) {
    if (matchesToken(row, t)) {
      return { skip: true, reason: `skip_poi_ids:${JSON.stringify(t)}` };
    }
  }
  const titleNorm = row.title ? normalizeTitleForPhotoSkip(row.title) : '';
  if (titleNorm) {
    if (ctx.skipTitleNorms.has(titleNorm)) {
      return { skip: true, reason: 'skip_title_exact' };
    }
    if (ctx.skipAliasNorms.has(titleNorm)) {
      return { skip: true, reason: 'skip_alias_exact' };
    }
  }
  return { skip: false };
}

export function buildPhotoBackfillSkipContext(
  skipTitlesCsv: string,
  skipAliasesCsv: string,
  skipPoiIdsCsv: string,
  useDefaultIslandExclusions = true,
): PhotoBackfillSkipContext {
  const skipTitleNorms = new Set(parseCsv(skipTitlesCsv).map(normalizeTitleForPhotoSkip));
  const skipAliasNorms = new Set(parseCsv(skipAliasesCsv).map(normalizeTitleForPhotoSkip));
  const skipTokens = parseSkipPoiIdTokens(skipPoiIdsCsv, 12);
  return {
    skipTitleNorms,
    skipAliasNorms,
    skipTokens,
    useDefaultIslandExclusions,
  };
}
