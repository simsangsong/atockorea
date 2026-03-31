"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type HomeLandingSectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

/**
 * Consistent horizontal padding + vertical rhythm for homepage sections (mobile + bottom-nav safe spacing).
 */
export function HomeLandingSection({
  children,
  className,
  id,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
}: HomeLandingSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className={cn(
        "w-full px-3 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6 md:pb-12 lg:px-8",
        className,
      )}
    >
      {children}
    </section>
  );
}
