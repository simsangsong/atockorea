"use client";

import { type ReactNode } from "react";
import { clsx } from "clsx";
import { useI18n } from "@/lib/i18n";
import { getBookingStatusConfig } from "@/src/design/status";
import type { BookingStatus } from "@/src/types/booking";

export interface StatusBannerProps {
  /** Server-driven status. Label comes from design/status (COPY). */
  status: BookingStatus;
  /** Optional additional content below the label */
  children?: ReactNode;
  className?: string;
}

const toneClasses: Record<string, string> = {
  success: "bg-status-success/10 text-gray-900 border-status-success/30",
  warning: "bg-status-warning/10 text-gray-900 border-status-warning/30",
  error: "bg-status-error/10 text-gray-900 border-status-error/30",
  info: "bg-status-info/10 text-gray-900 border-status-info/30",
  neutral: "bg-gray-100 text-gray-900 border-gray-200",
};

/**
 * Banner for booking status. Uses centralized status config (labels from COPY).
 * Status is server-driven; do not derive status in the client.
 */
export function StatusBanner({ status, children, className }: StatusBannerProps) {
  const { locale } = useI18n();
  const bookingStatusConfig = getBookingStatusConfig(locale);
  const config = bookingStatusConfig[status];
  const tone = config?.tone ?? "neutral";
  const label = config?.label ?? status;

  return (
    <div
      role="status"
      aria-label={label}
      className={clsx(
        "rounded-design-md border px-4 py-3",
        toneClasses[tone] ?? toneClasses.neutral,
        className
      )}
    >
      <span className="font-semibold">{label}</span>
      {children ? <div className="mt-2 text-sm">{children}</div> : null}
    </div>
  );
}
