"use client";

import { useState } from "react";
import { CheckCircle, Users, Route, ChevronDown, Clock3, Mountain, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

/**
 * `bookingTrustItems[].icon` → Lucide. East/Southwest: check-circle, route, users.
 * Jeju Grand Highlights: clock-3, mountain, users.
 */
const TRUST_ICONS = {
  "check-circle": CheckCircle,
  route: Route,
  users: Users,
  "clock-3": Clock3,
  mountain: Mountain,
} as const;

const DEFAULT_TRUST_ICON = CheckCircle;

export type TourBookingSupportSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "bookingTrustItems" | "bookingSupportSteps" | "sectionUi"
>;

export function TourBookingSupportSection({ bookingTrustItems, bookingSupportSteps, sectionUi }: TourBookingSupportSectionProps) {
  /** Flow is core content; open by default so travelers see the sequence without an extra click. */
  const [showTimeline, setShowTimeline] = useState(true);
  const trustItems = bookingTrustItems ?? [];
  const supportSteps = bookingSupportSteps ?? [];
  const hasSupportSteps = supportSteps.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.bookingSupportTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.bookingSupportSubtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {trustItems.map((item) => {
          const Icon =
            TRUST_ICONS[item.icon as keyof typeof TRUST_ICONS] ?? DEFAULT_TRUST_ICON;
          return (
            <div
              key={item.title}
              className="text-center card-utility p-4 transition-all duration-200 hover:shadow-premium hover:border-border"
            >
              <div className={cn("w-9 h-9 mx-auto mb-2 rounded-lg flex items-center justify-center", item.iconBg)}>
                <Icon className={cn("h-4 w-4", item.iconColor)} />
              </div>
              <h3 className="text-xs font-semibold text-foreground">{item.title}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          );
        })}
      </div>

      {hasSupportSteps ? (
        <div className="card-premium overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/20 transition-colors"
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground">{sectionUi.bookingAfterTitle}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{sectionUi.bookingAfterSubtitle}</p>
            </div>
            <div
              className={cn(
                "flex-shrink-0 p-1.5 rounded-full transition-all duration-200",
                showTimeline ? "bg-primary/10 rotate-180" : "bg-muted/60",
              )}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-colors", showTimeline ? "text-primary" : "text-muted-foreground")}
              />
            </div>
          </button>

          <div className={cn("grid transition-all duration-300 ease-out", showTimeline ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <div className="border-t border-border/60 p-5 md:p-6">
                {/* Mobile: vertical flowchart with spine */}
                <div className="md:hidden">
                  {supportSteps.map((step, i) => (
                    <div key={`m-${i}-${step.title}`} className="flex items-stretch gap-3">
                      <div className="flex w-9 flex-shrink-0 flex-col items-center">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/[0.07] text-xs font-bold tabular-nums text-primary">
                          {i + 1}
                        </div>
                        {i < supportSteps.length - 1 ? (
                          <div className="min-h-[0.5rem] flex-1 w-px self-center bg-gradient-to-b from-primary/45 to-border/40" />
                        ) : null}
                      </div>
                      <div className={cn("min-w-0 flex-1", i < supportSteps.length - 1 ? "pb-5" : "pb-0")}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/90">{step.timing}</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* md+: left-to-right flow; scroll when many steps */}
                <div className="hidden md:block overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                  <div className="flex min-w-0 items-stretch gap-2 md:min-w-min lg:gap-3">
                    {supportSteps.map((step, i) => (
                      <div key={`d-${i}-${step.title}`} className="flex min-w-0 items-stretch">
                        <div className="flex w-[min(100%,17.5rem)] min-w-[11.5rem] sm:min-w-[12.5rem] flex-col rounded-xl border border-border/60 bg-gradient-to-b from-background via-background to-muted/15 p-4 shadow-sm">
                          <div className="mb-2 flex items-start gap-2">
                            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold tabular-nums text-primary">
                              {i + 1}
                            </span>
                            <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase leading-tight tracking-wider text-primary/90">
                              {step.timing}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-snug">{step.title}</p>
                          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
                        </div>
                        {i < supportSteps.length - 1 ? (
                          <div className="flex w-5 flex-shrink-0 items-center justify-center self-center text-muted-foreground/40 sm:w-6">
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
