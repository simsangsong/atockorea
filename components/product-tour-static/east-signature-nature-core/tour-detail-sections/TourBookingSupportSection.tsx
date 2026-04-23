"use client";

import { useState } from "react";
import { CheckCircle, Users, Route, ChevronDown, Clock3, Mountain } from "lucide-react";
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
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.bookingSupportTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.bookingSupportSubtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {bookingTrustItems.map((item) => {
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

      <div className="card-premium overflow-hidden">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/20 transition-colors"
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">{sectionUi.bookingAfterTitle}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{sectionUi.bookingAfterSubtitle}</p>
          </div>
          <div
            className={cn(
              "flex-shrink-0 p-1.5 rounded-full transition-all duration-200",
              showTimeline ? "bg-primary/10 rotate-180" : "bg-muted/60",
            )}
          >
            <ChevronDown className={cn("h-4 w-4 transition-colors", showTimeline ? "text-primary" : "text-muted-foreground")} />
          </div>
        </button>

        <div className={cn("grid transition-all duration-300 ease-out", showTimeline ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="border-t border-border/60 p-5">
              <div className="space-y-0">
                {bookingSupportSteps.map((step, i) => (
                  <div key={step.title} className="relative pl-7 pb-5 last:pb-0">
                    {i < bookingSupportSteps.length - 1 && (
                      <div className="absolute left-[9px] top-5 bottom-0 w-px bg-gradient-to-b from-primary/25 to-border/50" />
                    )}
                    <div className="absolute left-0 top-1 h-[18px] w-[18px] rounded-full border-2 border-primary/80 bg-white shadow-sm" />
                    <div>
                      <p className="text-[10px] font-semibold text-primary tracking-wide">{step.timing}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
