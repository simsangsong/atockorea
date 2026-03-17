"use client";

import { type HTMLAttributes } from "react";
import { clsx } from "clsx";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
}

const variantClasses = {
  default: "bg-brand-navy text-white",
  success: "bg-status-success text-white",
  warning: "bg-status-warning text-white",
  error: "bg-status-error text-white",
  info: "bg-status-info text-white",
  neutral: "bg-status-neutral text-brand-navy",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs rounded",
  md: "px-2.5 py-1 text-sm rounded-design-sm",
};

/**
 * Badge for tour type, status, or tags.
 * Status must not rely on color alone: pair with label text from COPY or status config.
 */
export function Badge({
  className,
  variant = "default",
  size = "md",
  ...props
}: BadgeProps) {
  return (
    <span
      role="status"
      className={clsx(
        "inline-flex items-center font-medium",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
