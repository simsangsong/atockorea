"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import { analytics, type HomeMatchPreviewPhase } from "@/src/design/analytics";

const BestMatchPreview = dynamic(
  () =>
    import("@/components/home/v2/sections/best-match-preview").then(
      (mod) => mod.BestMatchPreview,
    ),
  { ssr: false },
);

export function DeferredBestMatchPreview() {
  const { phase } = useHomeV2Match();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastFiredPhaseRef = useRef<HomeMatchPreviewPhase | null>(null);

  useEffect(() => {
    if (phase === "idle") return;
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (lastFiredPhaseRef.current === phase) return;
        lastFiredPhaseRef.current = phase;
        analytics.homeMatchPreviewVisible({ phase });
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [phase]);

  if (phase === "idle") return null;

  return (
    <div ref={wrapperRef} data-home-match-preview>
      <BestMatchPreview />
    </div>
  );
}
