/**
 * Deterministic zero-result recovery ladder for get_poi_candidates.
 * Relaxes only soft filters in a fixed order; never drops explicit hard constraints.
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import { getPoiCandidates, type LeanPoiCandidate } from '@/lib/itinerary/reco/get-poi-candidates';
import type { FilterStrictness } from '@/lib/itinerary/reco/slot-inference';

export type RecoveryStageName =
  | 'base'
  | 'drop_soft_priorities'
  | 'loosen_soft_walking'
  | 'combined_drop_soft_and_moderate_walk'
  | 'expand_soft_region'
  | 'loosen_hard_region_walk_to_moderate'
  | 'loosen_hard_region_walk_to_hard'
  | 'loosen_hard_region_walk_unbounded'
  | 'safe_broad_pool';

export type CandidatePoolRecoveryResult = {
  candidates: LeanPoiCandidate[];
  recoveryStage: RecoveryStageName | null;
  zeroResultStages: RecoveryStageName[];
  finalSlots: ParsedRequestSlots;
};

function cloneSlots(s: ParsedRequestSlots): ParsedRequestSlots {
  return {
    regionPreference: s.regionPreference,
    subregionPreference: s.subregionPreference,
    withSeniors: s.withSeniors,
    withChildren: s.withChildren,
    firstVisit: s.firstVisit,
    maxWalkingLevel: s.maxWalkingLevel,
    needIndoorIfRain: s.needIndoorIfRain,
    rainAware: s.rainAware,
    photoPriority: s.photoPriority,
    hiddenGemPriority: s.hiddenGemPriority,
    iconicPriority: s.iconicPriority,
    naturePriority: s.naturePriority,
    culturePriority: s.culturePriority,
    foodPriority: s.foodPriority,
    cafePriority: s.cafePriority,
    shoppingPriority: s.shoppingPriority,
  };
}

function zeroSoftPrioritySlots(s: ParsedRequestSlots): ParsedRequestSlots {
  return {
    ...cloneSlots(s),
    hiddenGemPriority: 0,
    iconicPriority: 0,
    naturePriority: 0,
    culturePriority: 0,
    foodPriority: 0,
    cafePriority: 0,
    shoppingPriority: 0,
  };
}

function buildSafeBroadSlots(params: {
  base: ParsedRequestSlots;
  regionStrictness: FilterStrictness;
  explicitNeedIndoorFromUi: boolean;
}): ParsedRequestSlots {
  const { base, regionStrictness, explicitNeedIndoorFromUi } = params;
  const regionOk = regionStrictness === 'soft';
  return {
    ...cloneSlots(base),
    regionPreference: regionOk ? null : base.regionPreference,
    subregionPreference: regionOk ? null : base.subregionPreference,
    maxWalkingLevel: null,
    hiddenGemPriority: 0,
    iconicPriority: 0,
    naturePriority: 0,
    culturePriority: 0,
    foodPriority: 0,
    cafePriority: 0,
    shoppingPriority: 0,
    needIndoorIfRain: explicitNeedIndoorFromUi ? base.needIndoorIfRain : false,
    rainAware: base.rainAware,
  };
}

/**
 * Runs getPoiCandidates with progressively relaxed slot copies until rows are returned
 * or the ladder is exhausted.
 */
export async function fetchCandidatesWithRecovery(params: {
  baseSlots: ParsedRequestSlots;
  walkingStrictness: FilterStrictness;
  regionStrictness: FilterStrictness;
  explicitNeedIndoorFromUi: boolean;
  limit: number;
}): Promise<CandidatePoolRecoveryResult> {
  const {
    baseSlots,
    walkingStrictness,
    regionStrictness,
    explicitNeedIndoorFromUi,
    limit,
  } = params;

  const attempts: Array<{ stage: RecoveryStageName; slots: ParsedRequestSlots }> = [];

  attempts.push({ stage: 'base', slots: cloneSlots(baseSlots) });

  attempts.push({
    stage: 'drop_soft_priorities',
    slots: zeroSoftPrioritySlots(baseSlots),
  });

  if (walkingStrictness === 'soft' && baseSlots.maxWalkingLevel === 'easy') {
    attempts.push({
      stage: 'loosen_soft_walking',
      slots: {
        ...cloneSlots(baseSlots),
        maxWalkingLevel: 'moderate',
      },
    });
    attempts.push({
      stage: 'combined_drop_soft_and_moderate_walk',
      slots: {
        ...zeroSoftPrioritySlots(baseSlots),
        maxWalkingLevel: 'moderate',
      },
    });
  }

  if (regionStrictness === 'soft' && baseSlots.regionPreference != null) {
    attempts.push({
      stage: 'expand_soft_region',
      slots: {
        ...cloneSlots(baseSlots),
        regionPreference: null,
        subregionPreference: null,
      },
    });
  }

  if (regionStrictness === 'hard' && baseSlots.regionPreference != null) {
    if (walkingStrictness === 'soft' && baseSlots.maxWalkingLevel === 'easy') {
      attempts.push({
        stage: 'loosen_hard_region_walk_to_moderate',
        slots: {
          ...cloneSlots(baseSlots),
          maxWalkingLevel: 'moderate',
        },
      });
    }
    if (walkingStrictness === 'soft' && baseSlots.maxWalkingLevel === 'moderate') {
      attempts.push({
        stage: 'loosen_hard_region_walk_to_hard',
        slots: {
          ...cloneSlots(baseSlots),
          maxWalkingLevel: 'hard',
        },
      });
    }
    if (walkingStrictness === 'soft') {
      attempts.push({
        stage: 'loosen_hard_region_walk_unbounded',
        slots: {
          ...cloneSlots(baseSlots),
          maxWalkingLevel: null,
        },
      });
    }
  }

  attempts.push({
    stage: 'safe_broad_pool',
    slots: buildSafeBroadSlots({
      base: baseSlots,
      regionStrictness,
      explicitNeedIndoorFromUi,
    }),
  });

  const zeroResultStages: RecoveryStageName[] = [];

  for (const { stage, slots } of attempts) {
    const rows = await getPoiCandidates(slots, limit);
    if (rows.length > 0) {
      return {
        candidates: rows,
        recoveryStage: stage,
        zeroResultStages,
        finalSlots: slots,
      };
    }
    zeroResultStages.push(stage);
  }

  return {
    candidates: [],
    recoveryStage: null,
    zeroResultStages,
    finalSlots: cloneSlots(baseSlots),
  };
}
