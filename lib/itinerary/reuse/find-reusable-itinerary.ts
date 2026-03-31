/**
 * Deterministic similarity scoring and DB lookup for itinerary reuse.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import type { JejuPoiRow } from '@/lib/itinerary/types';
import type { ReusableRequestSignature } from '@/lib/itinerary/reuse/request-signature';

export type StoredRunSignaturePayload = {
  signature?: ReusableRequestSignature;
  candidateContentIds?: string[];
  reuseSource?: string;
};

export type ReuseLookupResult = {
  accepted: boolean;
  source?: 'run' | 'template';
  runId?: string;
  templateId?: string;
  similarityScore: number;
  hardMatches: string[];
  hardFailures: string[];
  contentIdSequence: string[];
  routeSummary?: Record<string, unknown>;
};

function hardCompare(
  key: string,
  a: unknown,
  b: unknown,
  matches: string[],
  failures: string[],
): void {
  if (a == null || b == null) return;
  if (a === b) matches.push(key);
  else failures.push(key);
}

function exact(a: unknown, b: unknown, weight: number): number {
  return a != null && b != null && a === b ? weight : 0;
}

function exactBool(a: boolean, b: boolean, weight: number): number {
  return a === b ? weight : 0;
}

function nearInt(a: number | null, b: number | null, weight: number): number {
  if (a == null || b == null) return 0;
  const diff = Math.abs(a - b);
  if (diff === 0) return weight;
  if (diff === 1) return Math.max(1, weight - 2);
  return 0;
}

export function scoreReuseCandidate(
  current: ReusableRequestSignature,
  candidate: ReusableRequestSignature,
): { score: number; hardMatches: string[]; hardFailures: string[] } {
  const hardMatches: string[] = [];
  const hardFailures: string[] = [];

  hardCompare('dayCount', current.dayCount, candidate.dayCount, hardMatches, hardFailures);
  hardCompare('regionPreference', current.regionPreference, candidate.regionPreference, hardMatches, hardFailures);
  hardCompare('maxWalkingLevel', current.maxWalkingLevel, candidate.maxWalkingLevel, hardMatches, hardFailures);

  if (current.withSeniors && !candidate.withSeniors) hardFailures.push('withSeniors');
  else if (current.withSeniors === candidate.withSeniors) hardMatches.push('withSeniors');

  if (current.needIndoorIfRain && !candidate.needIndoorIfRain) hardFailures.push('needIndoorIfRain');
  else if (current.needIndoorIfRain === candidate.needIndoorIfRain) hardMatches.push('needIndoorIfRain');

  if (hardFailures.length) {
    return { score: -9999, hardMatches, hardFailures };
  }

  let score = 0;
  score += exact(current.subregionPreference, candidate.subregionPreference, 12);
  score += exact(current.startRegionGroup, candidate.startRegionGroup, 8);
  score += exact(current.endRegionGroup, candidate.endRegionGroup, 6);
  score += exactBool(current.includeReturnToEndLocation, candidate.includeReturnToEndLocation, 5);
  score += exactBool(current.withChildren, candidate.withChildren, 5);
  score += exactBool(current.quickPhotoMode, candidate.quickPhotoMode, 5);
  score += exactBool(current.firstVisit, candidate.firstVisit, 5);
  score += exactBool(current.rainAware, candidate.rainAware, 4);

  score += nearInt(current.iconicPriority, candidate.iconicPriority, 4);
  score += nearInt(current.hiddenGemPriority, candidate.hiddenGemPriority, 4);
  score += nearInt(current.naturePriority, candidate.naturePriority, 3);
  score += nearInt(current.culturePriority, candidate.culturePriority, 3);
  score += nearInt(current.foodPriority, candidate.foodPriority, 3);
  score += nearInt(current.cafePriority, candidate.cafePriority, 2);
  score += nearInt(current.shoppingPriority, candidate.shoppingPriority, 2);

  return { score, hardMatches, hardFailures };
}

function extractContentIdsFromFinalSequence(seq: unknown): string[] {
  if (!Array.isArray(seq)) return [];
  const out: string[] = [];
  for (const item of seq) {
    if (item && typeof item === 'object' && 'contentId' in item) {
      const cid = (item as { contentId?: unknown }).contentId;
      if (typeof cid === 'string' && cid) out.push(cid);
    }
  }
  return out;
}

function passesRainConstraint(
  contentIds: string[],
  byId: Map<string, JejuPoiRow>,
  parsed: ParsedRequestSlots,
): boolean {
  const needIndoor = parsed.needIndoorIfRain === true;
  if (!needIndoor) return true;
  for (const id of contentIds) {
    const row = byId.get(id);
    if (row && row.is_indoor === false) return false;
  }
  return true;
}

const MIN_REUSE_SCORE = 8;

export async function findReusableItinerary(args: {
  supabase: SupabaseClient<any, any, any>;
  signature: ReusableRequestSignature;
  candidateContentIds: string[];
  parsedSlots: ParsedRequestSlots;
  byId: Map<string, JejuPoiRow>;
}): Promise<ReuseLookupResult> {
  const pool = new Set(args.candidateContentIds.map((x) => String(x)));

  let best: ReuseLookupResult = {
    accepted: false,
    similarityScore: -1e9,
    hardMatches: [],
    hardFailures: [],
    contentIdSequence: [],
  };

  try {
    const { data: runs, error } = await args.supabase
      .from('itinerary_runs')
      .select('id, template_id, final_poi_sequence, route_summary, created_at')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error || !runs?.length) {
      return best;
    }

    for (const row of runs) {
      const summary = (row.route_summary ?? {}) as Record<string, unknown> & StoredRunSignaturePayload;
      const prevSig = summary.signature;
      if (!prevSig) continue;

      const scored = scoreReuseCandidate(args.signature, prevSig);
      if (scored.score < MIN_REUSE_SCORE || scored.hardFailures.length) continue;

      const seq = extractContentIdsFromFinalSequence(row.final_poi_sequence);
      if (seq.length === 0) continue;

      const inPool = seq.every((id) => pool.has(String(id)));
      if (!inPool) continue;

      if (!passesRainConstraint(seq, args.byId, args.parsedSlots)) continue;

      if (scored.score > best.similarityScore) {
        best = {
          accepted: true,
          source: 'run',
          runId: String(row.id),
          templateId: row.template_id != null ? String(row.template_id) : undefined,
          similarityScore: scored.score,
          hardMatches: scored.hardMatches,
          hardFailures: scored.hardFailures,
          contentIdSequence: seq,
          routeSummary: summary,
        };
      }
    }

    const { data: templates } = await args.supabase
      .from('itinerary_templates')
      .select('id, poi_sequence, constraints_snapshot, usage_count, active')
      .eq('active', true)
      .order('usage_count', { ascending: false })
      .limit(15);

    if (templates?.length) {
      for (const t of templates) {
        const snap = (t.constraints_snapshot ?? {}) as StoredRunSignaturePayload;
        const prevSig = snap.signature;
        if (!prevSig) continue;
        const scored = scoreReuseCandidate(args.signature, prevSig);
        if (scored.score < MIN_REUSE_SCORE || scored.hardFailures.length) continue;
        const seq = extractContentIdsFromFinalSequence(t.poi_sequence);
        if (seq.length === 0 || !seq.every((id) => pool.has(String(id)))) continue;
        if (!passesRainConstraint(seq, args.byId, args.parsedSlots)) continue;
        if (scored.score > best.similarityScore) {
          best = {
            accepted: true,
            source: 'template',
            templateId: String(t.id),
            similarityScore: scored.score,
            hardMatches: scored.hardMatches,
            hardFailures: scored.hardFailures,
            contentIdSequence: seq,
            routeSummary: snap as Record<string, unknown>,
          };
        }
      }
    }
  } catch {
    return { accepted: false, similarityScore: -1e9, hardMatches: [], hardFailures: [], contentIdSequence: [] };
  }

  return best.accepted ? best : { ...best, accepted: false };
}
