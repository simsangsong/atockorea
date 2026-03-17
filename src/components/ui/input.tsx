"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "min-h-touch w-full rounded-design-sm border bg-white px-3 py-2.5 text-base text-gray-900",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-0 focus:border-brand-blue",
            "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
            error
              ? "border-status-error focus:ring-status-error"
              : "border-gray-300",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-status-error" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
