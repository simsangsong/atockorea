'use client';

import { twMerge } from 'tailwind-merge';

export interface SmallGroupSectionHeaderProps {
  /** Small caps label above the title */
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  /** For `aria-labelledby` on parent section */
  titleId?: string;
  /** Use `div` when nested inside a `<button>` (e.g. accordion trigger). */
  as?: 'header' | 'div';
  /**
   * `feature` — main narrative anchor (Why route, Book with confidence).
   * `standard` — secondary story / spec (At a Glance, Seasonal).
   * `support` — utility module (Practical, FAQ) when used via shared header.
   */
  titleVariant?: 'feature' | 'standard' | 'support';
  /** `lead` — section subtitle (default). `quiet` — lighter body line under a standard-tier title. */
  descriptionVariant?: 'lead' | 'quiet';
  /** Vertical space below header block. */
  spacing?: 'default' | 'compact' | 'tight';
}

/**
 * Shared editorial section title rhythm (Apple-like hierarchy).
 */
export default function SmallGroupSectionHeader({
  eyebrow,
  title,
  description,
  className = '',
  titleId,
  as: Wrapper = 'header',
  titleVariant = 'feature',
  descriptionVariant = 'lead',
  spacing = 'default',
}: SmallGroupSectionHeaderProps) {
  const titleClass =
    titleVariant === 'support'
      ? 'sg-dp-type-section-heading-support m-0 max-w-[min(100%,34rem)] text-pretty antialiased [font-feature-settings:"kern"_1,"liga"_1] sm:max-w-[38rem]'
      : titleVariant === 'standard'
        ? 'sg-dp-type-section-title-secondary m-0 max-w-[min(100%,32rem)] text-pretty antialiased [font-feature-settings:"kern"_1,"liga"_1] sm:max-w-[36rem]'
        : 'sg-dp-type-section-title m-0 max-w-[min(100%,32rem)] antialiased [font-feature-settings:"kern"_1,"liga"_1] sm:max-w-[36rem] sm:text-pretty';

  const descClass =
    descriptionVariant === 'quiet'
      ? 'sg-dp-type-body sg-dp-type-body-quiet m-0 mt-2 max-w-prose text-pretty sm:mt-2.5'
      : 'sg-dp-type-section-desc max-w-prose';

  const spacingClass =
    spacing === 'compact'
      ? 'mb-3 sm:mb-4 max-w-2xl'
      : spacing === 'tight'
        ? 'mb-2.5 sm:mb-3 max-w-2xl'
        : 'mb-4 sm:mb-5 max-w-2xl';

  return (
    <Wrapper className={twMerge(spacingClass, className)}>
      {eyebrow ? (
        <p className="sg-dp-type-section-eyebrow mb-1 max-w-prose antialiased sm:mb-1.5">{eyebrow}</p>
      ) : null}
      <h2 id={titleId} className={titleClass}>
        {title}
      </h2>
      {description ? <p className={descClass}>{description}</p> : null}
    </Wrapper>
  );
}
