"use client";

// Auto page_view tracker (analytics master plan §16 follow-up).
//
// Mounted once at the root layout. Watches the App Router pathname + query
// string and fires `analytics.pageView({ pathname })` on every route change
// (and once on initial mount). Without this every funnel that begins with
// `page_view` (matcher / featured / idle / destinations / tour-mode) would
// stay at step 1 = 0 because nothing else in the codebase calls
// `analytics.pageView()`.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analytics } from "@/src/design/analytics";

export function AnalyticsPageViewTracker() {
  const pathname = usePathname();
  const previousKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // Key the dedupe on pathname only — we don't want every UTM-tagged param
    // change to refire page_view (those land as context on the same event).
    if (previousKeyRef.current === pathname) return;
    previousKeyRef.current = pathname;
    analytics.pageView();
    // pathname is intentionally the only dep so SDK query/UTM changes don't
    // double-fire. searchParams is read but not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
