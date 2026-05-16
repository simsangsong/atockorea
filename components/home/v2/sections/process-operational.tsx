"use client";

import { useEffect, useRef } from "react";
import { Send, CheckCircle, MapIcon, CalendarCheck } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

type ProcessStep = {
  Icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  titleKey: string;
  bodyKey: string;
};

const STEPS: ReadonlyArray<ProcessStep> = [
  {
    Icon: Send,
    labelKey: "premium.v2.process.step1Label",
    titleKey: "premium.v2.process.step1Title",
    bodyKey: "premium.v2.process.step1Body",
  },
  {
    Icon: CheckCircle,
    labelKey: "premium.v2.process.step2Label",
    titleKey: "premium.v2.process.step2Title",
    bodyKey: "premium.v2.process.step2Body",
  },
  {
    Icon: MapIcon,
    labelKey: "premium.v2.process.step3Label",
    titleKey: "premium.v2.process.step3Title",
    bodyKey: "premium.v2.process.step3Body",
  },
  {
    Icon: CalendarCheck,
    labelKey: "premium.v2.process.step4Label",
    titleKey: "premium.v2.process.step4Title",
    bodyKey: "premium.v2.process.step4Body",
  },
];

function StepIconBadge({ step }: { step: ProcessStep }) {
  const { Icon } = step;
  return (
    <div className="relative w-9 h-9 rounded-button bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
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
    <section className="section-py-md px-4 bg-white">
      <div ref={containerRef} className="max-w-5xl mx-auto scroll-animate">
        <div className="text-center mb-8 md:mb-10">
          <p className="mb-3 text-eyebrow md:mb-4">
            {t("premium.v2.process.eyebrow")}
          </p>
          <h2 className="text-h2 text-slate-900">
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
            className="absolute left-[18px] top-5 bottom-5 w-px bg-slate-200 md:hidden"
          />

          {/* Desktop horizontal connector */}
          <div className="hidden lg:block absolute top-[24px] left-[40px] right-[40px] h-px bg-slate-200 z-0" />

          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-4 relative z-10">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-3.5 md:block">
                {/* Mobile-only icon — sits on the vertical rail as a node */}
                <div className="md:hidden mt-0.5">
                  <StepIconBadge step={step} />
                </div>
                <div className="flex-1 min-w-0 md:flex-initial rounded-card border border-slate-200/70 bg-slate-50 p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                  {/* md+ inline icon + label */}
                  <div className="hidden md:flex items-center gap-2.5 mb-2.5">
                    <StepIconBadge step={step} />
                    <span className="text-eyebrow">
                      {t(step.labelKey)}
                    </span>
                  </div>
                  {/* Mobile: label without icon (icon lives on the rail) */}
                  <span className="block md:hidden text-eyebrow mb-1.5">
                    {t(step.labelKey)}
                  </span>
                  <h4 className="text-body font-semibold text-slate-900 mb-1">
                    {t(step.titleKey)}
                  </h4>
                  <p className="text-caption text-slate-600">
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
