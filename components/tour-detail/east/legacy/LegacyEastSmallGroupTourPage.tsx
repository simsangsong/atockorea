'use client';

import SmallGroupTourDetailTemplateLegacy from '@/components/tour/small-group/SmallGroupTourDetailTemplateLegacy';
import type { SmallGroupTourDetailTemplateProps } from '@/components/tour/small-group/SmallGroupTourDetailTemplate';

/**
 * East Signature small-group detail — legacy (pre–v2) implementation.
 * Delegates to `SmallGroupTourDetailTemplateLegacy` without changing behavior.
 */
export default function LegacyEastSmallGroupTourPage(props: SmallGroupTourDetailTemplateProps) {
  return <SmallGroupTourDetailTemplateLegacy {...props} />;
}
