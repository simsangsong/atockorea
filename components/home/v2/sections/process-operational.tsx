"use client";

import { motion } from "framer-motion";
import { Send, CheckCircle, MapIcon, CalendarCheck } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";

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
    <div className="relative w-9 h-9 rounded-button bg-white/10 text-white/90 flex items-center justify-center ring-1 ring-white/15 flex-shrink-0">
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}

export function ProcessOperational() {
  const t = useTranslations("home");
  const reveal = useRevealContainerProps();

  return (
    <section
      className="section-py-md px-4"
      style={{ background: "linear-gradient(to bottom, #1C1810, #141008)" }}
    >
      <motion.div {...reveal} className="max-w-5xl mx-auto">
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="text-center mb-10 md:mb-12">
          <p className="mb-3 text-eyebrow text-amber-300 md:mb-4">
            {t("premium.v2.process.eyebrow")}
          </p>
          <h2 className="text-balance text-display text-white">
            {t("premium.v2.process.title")}
          </h2>
        </motion.div>

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

          {/* Desktop horizontal connector */}
          <div className="hidden lg:block absolute top-[24px] left-[40px] right-[40px] h-px bg-gradient-to-r from-white/5 via-white/15 to-white/5 z-0" />

          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-4 relative z-10">
            {STEPS.map((step, i) => (
              <motion.div key={i} variants={REVEAL_ITEM_VARIANTS} className="flex items-start gap-3.5 md:block">
                {/* Mobile-only icon — sits on the vertical rail as a node */}
                <div className="md:hidden mt-0.5">
                  <StepIconBadge step={step} />
                </div>
                <div className="flex-1 min-w-0 md:flex-initial rounded-card border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                  {/* md+ inline icon + label */}
                  <div className="hidden md:flex items-center gap-2.5 mb-2.5">
                    <StepIconBadge step={step} />
                    <span className="text-eyebrow text-amber-300">
                      {t(step.labelKey)}
                    </span>
                  </div>
                  {/* Mobile: label without icon (icon lives on the rail) */}
                  <span className="block md:hidden text-eyebrow text-amber-300 mb-1.5">
                    {t(step.labelKey)}
                  </span>
                  <h4 className="text-h3 text-white mb-1.5">
                    {t(step.titleKey)}
                  </h4>
                  <p className="text-caption text-slate-400">
                    {t(step.bodyKey)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
