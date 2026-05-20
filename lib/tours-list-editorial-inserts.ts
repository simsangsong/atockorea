/**
 * Static content for the catalogue's Editorial Inserts (Phase 4.6). Three
 * rotating variants are dropped into the grid at slots 6 / 12 / 18 (B8) to break
 * the "24 identical cards" monotony with a curation signal.
 *
 * Each variant references i18n keys (resolved by the consumer with `t()`), so
 * copy stays 6-locale. A future curator-admin could make these dynamic; for now
 * they're a fixed editorial rotation.
 */

export type EditorialInsertVariant = 'editorPick' | 'seasonNote' | 'curatorCut';

export interface EditorialInsertContent {
  variant: EditorialInsertVariant;
  /** i18n key for the small uppercase eyebrow. */
  eyebrowKey: string;
  /** i18n key for the headline line. */
  titleKey: string;
  /** Optional CTA → builder. Only the editorPick variant carries it. */
  ctaKey?: string;
  ctaHref?: string;
}

export const EDITORIAL_INSERTS: readonly EditorialInsertContent[] = [
  {
    variant: 'editorPick',
    eyebrowKey: 'toursList.insertEditorPickEyebrow',
    titleKey: 'toursList.insertEditorPickTitle',
    ctaKey: 'toursList.insertBuilderCta',
    ctaHref: '/itinerary-builder',
  },
  {
    variant: 'seasonNote',
    eyebrowKey: 'toursList.insertSeasonEyebrow',
    titleKey: 'toursList.insertSeasonTitle',
  },
  {
    variant: 'curatorCut',
    eyebrowKey: 'toursList.insertCuratorEyebrow',
    titleKey: 'toursList.insertCuratorTitle',
  },
] as const;

/**
 * Card slots after which an insert appears (1-based count of rendered cards).
 * B8: every 6th slot. Returns the insert for a given slot, or null.
 */
export const EDITORIAL_INSERT_SLOTS = [6, 12, 18] as const;

export function insertForSlot(cardsRendered: number): EditorialInsertContent | null {
  const idx = EDITORIAL_INSERT_SLOTS.indexOf(cardsRendered as 6 | 12 | 18);
  if (idx === -1) return null;
  return EDITORIAL_INSERTS[idx % EDITORIAL_INSERTS.length];
}
