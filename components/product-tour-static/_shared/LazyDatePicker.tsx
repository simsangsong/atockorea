"use client";

/**
 * Thin re-export wrapper around `react-datepicker` so it can be dynamically
 * imported from the booking surfaces (TourDesktopBookingCard,
 * TourStickyBookingBar).
 *
 * next/dynamic's generic resolves cleanly when the loaded module's default is
 * a non-generic component. `react-datepicker`'s default export is a generic
 * class, so passing it through next/dynamic directly produces a
 * "Promise<typeof import(...)>" type mismatch. Casting to ComponentType<any>
 * here collapses the type into a shape next/dynamic can consume — props are
 * still type-checked at the call site by react-datepicker's IntelliSense
 * because callers spread known DatePickerProps onto the dynamic component.
 */
import type { ComponentType } from "react";
import DatePicker from "react-datepicker";

/**
 * The subset of `react-datepicker`'s props that the booking surfaces actually
 * use. Listing them explicitly preserves call-site IntelliSense (so onChange
 * etc. stay strongly typed) without having to drag in the library's deeply
 * generic prop type, which is what caused the next/dynamic mismatch.
 */
export type LazyDatePickerProps = {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  inline?: boolean;
  monthsShown?: number;
  calendarClassName?: string;
  locale?: unknown;
  dayClassName?: (date: Date) => string;
};

const LazyDatePicker = DatePicker as unknown as ComponentType<LazyDatePickerProps>;

export default LazyDatePicker;
