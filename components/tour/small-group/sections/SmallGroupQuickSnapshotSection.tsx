'use client';

import {
  Activity,
  Camera,
  CloudSun,
  Compass,
  Footprints,
  TreePine,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { SmallGroupAtAGlanceCard, SmallGroupAtAGlanceIconKey } from '../smallGroupDetailContent';
import SmallGroupSectionHeader from '../SmallGroupSectionHeader';

export interface SmallGroupQuickSnapshotSectionProps {
  cards: SmallGroupAtAGlanceCard[];
  /** Merged onto the outer `<section>` (e.g. intro-stack spacing). */
  sectionClassName?: string;
}

const GLANCE_ICONS: Record<SmallGroupAtAGlanceIconKey, LucideIcon> = {
  camera: Camera,
  compass: Compass,
  footprints: Footprints,
  cloudSun: CloudSun,
  users: Users,
  treePine: TreePine,
  activity: Activity,
};

function GlanceGlyph({
  iconKey,
  className,
}: {
  iconKey?: SmallGroupAtAGlanceIconKey;
  className?: string;
}) {
  const Icon = GLANCE_ICONS[iconKey ?? 'activity'];
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}

/**
 * (B) At a Glance — single framed product summary: hairline grid, scan-first type, no mini-tile chrome.
 */
export default function SmallGroupQuickSnapshotSection({
  cards,
  sectionClassName,
}: SmallGroupQuickSnapshotSectionProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <section
      className={twMerge(
        "sg-dp-intro-to-glance-rule bg-transparent font-sans antialiased [font-feature-settings:'kern'_1,'liga'_1] sg-dp-page-gutter",
        sectionClassName
      )}
      aria-labelledby="at-a-glance-heading"
    >
      <div className="sg-dp-page-column">
        <SmallGroupSectionHeader
          title="At a Glance"
          titleId="at-a-glance-heading"
          titleVariant="standard"
          spacing="compact"
          className="max-w-full"
        />

        <div className="sg-dp-glance-panel" role="list">
          <div className="sg-dp-glance-grid">
            {cards.map((item: SmallGroupAtAGlanceCard, index: number) => {
              const highlighted = index === 0;
              return (
                <div
                  key={item.id}
                  role="listitem"
                  title={item.detail}
                  className={[
                    'sg-dp-glance-cell',
                    highlighted ? 'sg-dp-glance-cell--lead' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className={highlighted ? 'sg-dp-glance-icon-slot--inverse' : 'sg-dp-glance-icon-slot'}>
                    <GlanceGlyph
                      iconKey={item.icon}
                      className={
                        highlighted
                          ? 'h-3.5 w-3.5 text-white/85'
                          : 'h-3.5 w-3.5 text-neutral-600'
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 pt-px">
                    <p
                      className={
                        highlighted
                          ? 'sg-dp-type-glance-dimension sg-dp-type-glance-dimension--inverse'
                          : 'sg-dp-type-glance-dimension'
                      }
                    >
                      {item.label}
                    </p>
                    <p
                      className={
                        highlighted
                          ? 'sg-dp-type-glance-stat sg-dp-type-glance-stat--inverse'
                          : 'sg-dp-type-glance-stat'
                      }
                    >
                      {item.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
