export { default as SmallGroupTourDetailTemplate } from './SmallGroupTourDetailTemplate';
export { default as SmallGroupTourDetailTemplateLegacy } from './SmallGroupTourDetailTemplateLegacy';
export {
  buildSmallGroupDetailContent,
  resolveEditorialPresentation,
  groupPracticalBlocksForUi,
  resolvePracticalBlockGroup,
  groupPracticalBlocksByAccordion,
  resolvePracticalAccordionKey,
} from './smallGroupDetailContent';
export type {
  SmallGroupPracticalGroupKey,
  SmallGroupPracticalAccordionKey,
  SmallGroupDetailContent,
  SmallGroupEditorialDetail,
  SmallGroupResolvedEditorial,
  SmallGroupPremiumBadge,
  SmallGroupSummaryFact,
  SmallGroupSnapshotRow,
  SmallGroupInsightCard,
  SmallGroupFaqItem,
  SmallGroupRouteStop,
  SmallGroupSeasonKey,
  SmallGroupSeasonalBlock,
  SmallGroupPracticalBlock,
  SmallGroupSupportItem,
  SmallGroupRelatedTourCard,
  SmallGroupAtAGlanceCard,
  SmallGroupAtAGlanceIconKey,
  SmallGroupFlowReasonIconKey,
  SmallGroupTemplateSectionChrome,
} from './smallGroupDetailContent';
export { mapTourToRouteStopCards } from './mapTourToRouteStops';
