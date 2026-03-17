"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

const variantClasses = {
  primary:
    "bg-brand-blue text-white hover:opacity-95 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
  secondary:
    "bg-brand-navy text-white hover:opacity-95 focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2",
  outline:
    "border-2 border-brand-blue text-brand-blue bg-transparent hover:bg-brand-blue/5 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
  ghost:
    "text-brand-navy hover:bg-status-neutral/50 focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2",
};

const sizeClasses = {
  sm: "min-h-touch px-3 py-2 text-sm rounded-design-sm",
  md: "min-h-touch px-4 py-3 text-base rounded-design-sm",
  lg: "min-h-[48px] px-6 py-3 text-base rounded-design-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={clsx(
          "inline-flex items-center justify-center font-semibold transition-all duration-motion-fast transition-timing-motion-ease disabled:opacity-50 disabled:cursor-not-allowed",
          "focus:outline-none",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
