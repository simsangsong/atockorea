/**
 * Reuse orchestration entry points. Primary orchestration lives in `app/api/itinerary/generate/route.ts`
 * (history lookup → materialize → validate → polish vs fresh compose).
 */
export { buildReusableRequestSignature, type ReusableRequestSignature } from '@/lib/itinerary/reuse/request-signature';
export {
  findReusableItinerary,
  scoreReuseCandidate,
  type ReuseLookupResult,
} from '@/lib/itinerary/reuse/find-reusable-itinerary';
export { buildDraftFromReuseSequence } from '@/lib/itinerary/reuse/build-draft-from-reuse';
