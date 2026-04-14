import type { TourDetailViewModel } from '@/src/types/tours';
import type { SmallGroupDetailContent, SmallGroupResolvedEditorial } from './smallGroupDetailContent';

export type HeroDecisionStripFactKey = 'walk' | 'rain' | 'fit' | 'pickup' | 'value' | 'route';

export interface HeroDecisionStripFact {
  key: HeroDecisionStripFactKey;
  value: string;
}

const MAX_LEN = 56;
const HALF = 30;

function snapshotValue(content: SmallGroupDetailContent, id: string): string {
  return content.quickSnapshot.find((r) => r.id === id)?.value?.trim() ?? '';
}

function practicalBody(content: SmallGroupDetailContent, id: string): string {
  return content.practicalBlocks.find((b) => b.id === id)?.body?.trim() ?? '';
}

function trimFact(s: string, max: number = MAX_LEN): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function firstChunk(body: string, sep: string): string {
  const t = body.trim();
  if (!t) return '';
  const i = t.indexOf(sep);
  return (i === -1 ? t : t.slice(0, i)).trim();
}

/**
 * Compact facts for the hero-adjacent decision strip (snapshot + practicals + editorial).
 */
export function buildHeroDecisionStripFacts(
  content: SmallGroupDetailContent,
  ed: SmallGroupResolvedEditorial,
  tour: Pick<TourDetailViewModel, 'difficulty' | 'pickup'>,
): HeroDecisionStripFact[] {
  const out: HeroDecisionStripFact[] = [];

  const walkRaw = snapshotValue(content, 'walkingLevel') || (tour.difficulty ?? '').trim();
  const walk = trimFact(walkRaw);
  if (walk) out.push({ key: 'walk', value: walk });

  const rain = trimFact(snapshotValue(content, 'rainSafety'));
  if (rain) out.push({ key: 'rain', value: rain });

  const fam = snapshotValue(content, 'familyFit');
  const sen = snapshotValue(content, 'seniorFit');
  let fitLine = '';
  if (fam && sen) {
    fitLine = `${trimFact(fam, HALF)} · ${trimFact(sen, HALF)}`;
  } else {
    fitLine = fam || sen;
  }
  fitLine = trimFact(fitLine);
  if (fitLine) out.push({ key: 'fit', value: fitLine });

  const pickupLabel = (tour.pickup?.areaLabel ?? '').trim();
  const pickupFromPractical = firstChunk(practicalBody(content, 'pickupDrop'), '.');
  const pickup = trimFact(pickupLabel || pickupFromPractical);
  if (pickup) out.push({ key: 'pickup', value: pickup });

  const inc = practicalBody(content, 'included');
  const ninc =
    practicalBody(content, 'notIncluded') ||
    practicalBody(content, 'not_included') ||
    practicalBody(content, 'extras');
  let valueLine = '';
  if (inc && ninc) {
    const i0 = firstChunk(inc, '·') || trimFact(inc, 28);
    const n0 = firstChunk(ninc, '·') || trimFact(ninc, 22);
    valueLine = trimFact(`${i0} · Not: ${n0}`, MAX_LEN);
  } else {
    valueLine = trimFact(inc || ninc);
  }
  if (valueLine) out.push({ key: 'value', value: valueLine });

  const routeRaw = (ed.routePreviewLine ?? '').trim() || snapshotValue(content, 'scenicIntensity');
  const route = trimFact(routeRaw);
  if (route) out.push({ key: 'route', value: route });

  return out.slice(0, 6);
}
