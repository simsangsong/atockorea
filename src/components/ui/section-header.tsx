"use client";

import { type ReactNode, type HTMLAttributes } from "react";
import { clsx } from "clsx";

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Optional action (e.g. "Edit" link). Not hover-only on mobile. */
  action?: ReactNode;
  subtitle?: string;
}

/**
 * Section heading with optional action and subtitle.
 * Use for page sections (e.g. "Recommended for you", "Booking timeline").
 */
export function SectionHeader({
  title,
  action,
  subtitle,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-baseline justify-between gap-2",
        className
      )}
      {...props}
    >
      <div>
        <h2 className="text-xl font-semibold text-gray-900 md:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
