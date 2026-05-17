"use client";

import dynamic from "next/dynamic";

/** Client-side dynamic wrapper for MatcherBottomSheet.
 *
 *  HomeV2Page is a server component which forbids `next/dynamic` + `ssr:false`,
 *  so this thin client shim does the lazy load. The sheet itself is a heavy
 *  framer-motion drag/AnimatePresence component that's a no-op for variant A /
 *  desktop / idle — lazy-mounting it keeps the home initial JS lean. */
const MatcherBottomSheet = dynamic(
  () =>
    import("@/components/home/v2/MatcherBottomSheet").then(
      (m) => m.MatcherBottomSheet,
    ),
  { ssr: false, loading: () => null },
);

export function MatcherBottomSheetLazy() {
  return <MatcherBottomSheet />;
}
