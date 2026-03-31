/**
 * Supabase upsert for jeju_kor_tourapi_places (service role). Chunked, env-gated.
 * Scoring columns (region_group, base_score, …) are not sent here; they are updated by
 * `npm run score:jeju:places` and are preserved on conflict merge for existing rows.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type JejuPlaceUpsertRow = {
  content_id: string;
  content_type_id: number;
  title: string | null;
  addr1: string | null;
  addr2: string | null;
  overview: string | null;
  first_image: string | null;
  first_image2: string | null;
  mapx: number | null;
  mapy: number | null;
  tel: string | null;
  homepage: string | null;
  readcount: number | null;
  list_rank: number | null;
  opening_hours_raw: string | null;
  admission_fee_raw: string | null;
  business_status_note: string | null;
  reservation_info: string | null;
  parking_info: string | null;
  rest_date: string | null;
  use_time_text: string | null;
  fee_text: string | null;
  intro_raw_json: Record<string, unknown> | null;
  detail_info_raw_json: Record<string, unknown> | null;
  source_api: string;
  fetched_at: string;
  sync_batch_id: string;
};

export type UpsertSummary = {
  chunks: number;
  successRows: number;
  failedRows: number;
  errors: string[];
};

function getChunkSize(): number {
  const raw = process.env.JEJU_UPSERT_CHUNK_SIZE?.trim();
  const n = raw ? parseInt(raw, 10) : 50;
  return Number.isFinite(n) && n > 0 ? Math.min(500, n) : 50;
}

export function createServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for upsert');
  }
  return createClient<any, any, any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function upsertJejuPlaces(rows: JejuPlaceUpsertRow[]): Promise<UpsertSummary> {
  const supabase = createServiceSupabase();
  const chunkSize = getChunkSize();
  const errors: string[] = [];
  let successRows = 0;
  let failedRows = 0;
  let chunks = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks += 1;
    const slice = rows.slice(i, i + chunkSize);
    const { error, data } = await supabase
      .from('jeju_kor_tourapi_places')
      .upsert(slice, {
        onConflict: 'content_id,content_type_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      failedRows += slice.length;
      errors.push(`chunk ${chunks}: ${error.message}`);
      console.error(`[Supabase] upsert chunk ${chunks} failed:`, error.message);
    } else {
      const n = Array.isArray(data) ? data.length : slice.length;
      successRows += n;
      console.log(`[Supabase] upsert chunk ${chunks}: ok (${n} rows)`);
    }
  }

  return { chunks, successRows, failedRows, errors };
}
