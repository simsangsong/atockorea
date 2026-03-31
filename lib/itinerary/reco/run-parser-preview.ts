/**
 * Parser preview — uses the same bundle as /api/itinerary/generate:
 * `buildFixedCandidatePool` → 4-stage parser + SQL lean candidates + persistence.
 */
import { buildFixedCandidatePool } from '@/lib/itinerary/reco/build-fixed-candidate-pool';
import type { ParserInput } from '@/lib/itinerary/reco/extract-parser-input';
import type { DeterministicParserResult } from '@/lib/itinerary/parser/types';
import type { LeanPoiCandidate } from '@/lib/itinerary/reco/get-poi-candidates';

export type ParserPreviewResult = {
  parsed: DeterministicParserResult;
  candidates: LeanPoiCandidate[];
  requestProfileId: string | null;
  parseLogId: string | null;
  persistenceError: string | null;
};

/**
 * Run parser preview aligned with production `buildFixedCandidatePool`.
 */
export async function runParserPreview(
  rawText: string,
  locale = 'ko',
  limit = 20,
  persist = true,
): Promise<ParserPreviewResult> {
  const parserInput: ParserInput = {
    rawText,
    locale,
    parserHints: {
      withSeniors: false,
      withChildren: false,
      needIndoorIfRain: false,
      indoorOutdoor: 'any',
      durationDays: 1,
      pickupArea: null,
      mustSeeKeywords: [],
    },
    legacyRequestSnapshot: { preview: true },
  };

  const pool = await buildFixedCandidatePool(parserInput, limit, persist);

  return {
    parsed: pool.parsed,
    candidates: pool.candidates,
    requestProfileId: pool.requestProfileId,
    parseLogId: pool.parseLogId,
    persistenceError: pool.persistenceError,
  };
}
