import type { SmallGroupFaqItem } from '@/components/tour/small-group/smallGroupDetailContent';
import type { V0EastFaqItemModel } from './v0-ui-types';

/** Maps legacy FAQ items to v0 questions section shape (rank preserved for sorting in UI). */
export function legacyFaqsToV0EastFaqItems(items: SmallGroupFaqItem[]): V0EastFaqItemModel[] {
  return items.map((item) => ({
    question: item.question,
    answer: item.answer,
    decisionRank: item.decisionRank,
  }));
}
