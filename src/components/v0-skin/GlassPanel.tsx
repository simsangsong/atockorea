"use client";

import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GlassPanelVariant = "default" | "soft" | "tight";

export type GlassPanelProps = {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  variant?: GlassPanelVariant;
} & Omit<HTMLAttributes<HTMLElement>, "as">;

const variantClass: Record<GlassPanelVariant, string> = {
  default: "v0-glass-panel",
  soft: "v0-glass-panel--soft",
  tight: "v0-glass-panel v0-glass-panel--tight",
};

/**
 * Frosted glass surface — presentation only. Compose with existing content; no state.
 */
export function GlassPanel({
  as: Component = "div",
  children,
  className,
  variant = "default",
  ...rest
}: GlassPanelProps) {
  return (
    <Component className={cn(variantClass[variant], className)} {...rest}>
      {children}
    </Component>
  );
}
