"use client";

import { forwardRef, type InputHTMLAttributes, useState } from "react";
import { clsx } from "clsx";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
  onClear?: () => void;
  /** Accessible label for clear button */
  clearButtonLabel?: string;
}

const inputBaseClasses =
  "min-h-touch w-full rounded-design-sm border bg-white px-3 py-2.5 pr-10 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-0 focus:border-brand-blue disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed border-gray-300";

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      value,
      onClear,
      clearButtonLabel = "Clear search",
      id,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState("");
    const isControlled = value !== undefined;
    const currentValue = isControlled ? String(value ?? "") : internalValue;
    const showClear = currentValue.length > 0;
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const handleClear = () => {
      if (!isControlled) setInternalValue("");
      onClear?.();
    };

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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="search"
            role="searchbox"
            autoComplete="off"
            value={isControlled ? value : internalValue}
            onChange={(e) => {
              if (!isControlled) setInternalValue(e.target.value);
              props.onChange?.(e);
            }}
            className={clsx(
              inputBaseClasses,
              error && "border-status-error focus:ring-status-error",
              className
            )}
            aria-label={label ?? "Search"}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />
          {showClear ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 min-h-touch min-w-touch flex items-center justify-center rounded text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-0"
              aria-label={clearButtonLabel}
            >
              <span className="text-lg leading-none" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
        </div>
        {error ? (
          <p id={inputId ? `${inputId}-error` : undefined} className="mt-1.5 text-sm text-status-error" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={inputId ? `${inputId}-hint` : undefined} className="mt-1.5 text-sm text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
