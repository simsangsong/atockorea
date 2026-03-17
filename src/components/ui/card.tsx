"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "outline" | "muted";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClasses = {
  elevated: "bg-white border border-gray-200 shadow-design-md rounded-design-lg",
  outline: "bg-white border-2 border-gray-200 rounded-design-lg",
  muted: "bg-gray-50 border border-gray-100 rounded-design-lg",
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = "elevated",
      padding = "md",
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          variantClasses[variant],
          paddingClasses[padding],
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return <div className={clsx("mb-3", className)} {...props} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h3
      className={clsx("text-lg font-semibold text-gray-900", className)}
      {...props}
    />
  );
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, ...props }: CardContentProps) {
  return <div className={clsx("text-gray-600", className)} {...props} />;
}
