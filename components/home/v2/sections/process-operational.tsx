"use client";

import { useEffect, useRef } from "react";
import { Send, CheckCircle, MapIcon } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ProcessStep = {
  Icon: React.ComponentType<{ className?: string }>;
  accentBg: string;
  labelColor: string;
  shadowColor: string;
  labelKey: string;
  titleKey: string;
  bodyKey: string;
};

const STEPS: ReadonlyArray<ProcessStep> = [
  {
    Icon: Send,
    accentBg: "from-primary to-primary/80",
    labelColor: "text-sky-300",
    shadowColor: "shadow-primary/20",
    labelKey: "premium.v2.process.step1Label",
    titleKey: "premium.v2.process.step1Title",
    bodyKey: "premium.v2.process.step1Body",
  },
  {
    Icon: CheckCircle,
    accentBg: "from-emerald-500 to-emerald-600",
    labelColor: "text-emerald-400",
    shadowColor: "shadow-emerald-500/20",
    labelKey: "premium.v2.process.step2Label",
    titleKey: "premium.v2.process.step2Title",
    bodyKey: "premium.v2.process.step2Body",
  },
  {
    Icon: MapIcon,
    accentBg: "from-sky-500 to-sky-600",
    labelColor: "text-sky-400",
    shadowColor: "shadow-sky-500/20",
    labelKey: "premium.v2.process.step3Label",
    titleKey: "premium.v2.process.step3Title",
    bodyKey: "premium.v2.process.step3Body",
  },
  {
    Icon: CheckCircle,
    accentBg: "from-amber-500 to-orange-500",
    labelColor: "text-amber-400",
    shadowColor: "shadow-amber-500/20",
    labelKey: "premium.v2.process.step4Label",
    titleKey: "premium.v2.process.step4Title",
    bodyKey: "premium.v2.process.step4Body",
  },
];

function StepIconBadge({ step }: { step: ProcessStep }) {
  const { Icon } = step;
  return (
    <div
      className={cn(
        "relative w-9 h-9 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg ring-4 ring-white/10 flex-shrink-0",
        step.accentBg,
        step.shadowColor,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}

export function ProcessOperational() {
  const t = useTranslations("home");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.add("visible");
    }
  }, []);

  return (
    <section
      className="py-10 md:py-14 px-4"
      style={{ background: "linear-gradient(to bottom, #1C1810, #141008)" }}
    >
      <div ref={containerRef} className="max-w-5xl mx-auto scroll-animate">
        <div className="text-center mb-8 md:mb-10">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">
              {t("premium.v2.process.eyebrow")}
            </span>
          </div>
          <h2 className="text-h2 text-white">
            {t("premium.v2.process.title")}
          </h2>
        </div>

        <div className="relative">
          {/*
            Mobile vertical timeline rail — runs through the icon-badge column
            on the left. Hidden md+ where the grid layout takes over (and on
            lg the horizontal connector below kicks in).
          */}
          <div
            aria-hidden
            className="absolute left-[18px] top-5 bottom-5 w-px bg-gradient-to-b from-white/5 via-white/25 to-white/5 md:hidden"
          />

          {/* Desktop horizontal connector — unchanged. */}
          <div className="hidden lg:block absolute top-[24px] left-[40px] right-[40px] h-0.5 bg-gradient-to-r from-white/5 via-white/15 to-white/5 z-0" />

          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-4 relative z-10">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-3.5 md:block">
                {/* Mobile-only icon — sits on the vertical rail as a node */}
                <div className="md:hidden mt-0.5">
                  <StepIconBadge step={step} />
                </div>
                <div className="flex-1 min-w-0 md:flex-initial rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                  {/* md+ inline icon + label */}
                  <div className="hidden md:flex items-center gap-2.5 mb-2.5">
                    <StepIconBadge step={step} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", step.labelColor)}>
                      {t(step.labelKey)}
                    </span>
                  </div>
                  {/* Mobile: label without icon (icon lives on the rail) */}
                  <span className={cn("block md:hidden text-[10px] font-bold uppercase tracking-wider mb-1.5", step.labelColor)}>
                    {t(step.labelKey)}
                  </span>
                  <h4 className="text-[14px] font-semibold text-white mb-1">
                    {t(step.titleKey)}
                  </h4>
                  <p className="text-slate-400 text-[12.5px] leading-relaxed">
                    {t(step.bodyKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
