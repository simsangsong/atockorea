"use client";

import dynamic from "next/dynamic";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";

const BestMatchPreview = dynamic(
  () =>
    import("@/components/home/v2/sections/best-match-preview").then(
      (mod) => mod.BestMatchPreview,
    ),
  { ssr: false },
);

export function DeferredBestMatchPreview() {
  const { phase } = useHomeV2Match();

  if (phase === "idle") return null;

  return <BestMatchPreview />;
}
