/**
 * Loads `match_tours` rows from Supabase exactly once per stress run.
 *
 * Reuses `lib/tour-match-v2/fetch-tours.ts`; this wrapper exists so that
 * the runner can swap in a static fixture later without changing call sites.
 */

import { createClient } from "@supabase/supabase-js";
import { fetchMatchTours } from "@/lib/tour-match-v2/fetch-tours";
import type { MatchTourRow } from "@/lib/tour-match-v2/types";

let _cache: MatchTourRow[] | null = null;

export async function loadAllTours(locale: string = "en"): Promise<MatchTourRow[]> {
  if (_cache) return _cache;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL + (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  _cache = await fetchMatchTours(sb, locale);
  return _cache;
}

export function clearTourCache(): void {
  _cache = null;
}
