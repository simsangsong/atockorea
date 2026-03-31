"use client";

import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SectionShellProps = {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  /** Wider max-width (maps to .v0-section-shell--wide) */
  wide?: boolean;
} & Omit<HTMLAttributes<HTMLElement>, "as">;

/**
 * Centered column + horizontal padding aligned with V0 mobile stack. Style-only wrapper.
 */
export function SectionShell({
  as: Component = "section",
  children,
  className,
  wide = false,
  ...rest
}: SectionShellProps) {
  return (
    <Component
      className={cn("v0-section-shell", wide && "v0-section-shell--wide", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
