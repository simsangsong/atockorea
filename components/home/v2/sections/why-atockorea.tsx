"use client";

import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Headphones } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";

type Pillar = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  titleAccentKey: string;
  bodyKey: string;
};

const PILLARS: ReadonlyArray<Pillar> = [
  {
    id: "curated",
    icon: Sparkles,
    titleKey: "premium.v2.whyAtockorea.pillar1.title",
    titleAccentKey: "premium.v2.whyAtockorea.pillar1.titleAccent",
    bodyKey: "premium.v2.whyAtockorea.pillar1.body",
  },
  {
    id: "trusted-globally",
    icon: ShieldCheck,
    titleKey: "premium.v2.whyAtockorea.pillar2.title",
    titleAccentKey: "premium.v2.whyAtockorea.pillar2.titleAccent",
    bodyKey: "premium.v2.whyAtockorea.pillar2.body",
  },
  {
    id: "support",
    icon: Headphones,
    titleKey: "premium.v2.whyAtockorea.pillar3.title",
    titleAccentKey: "premium.v2.whyAtockorea.pillar3.titleAccent",
    bodyKey: "premium.v2.whyAtockorea.pillar3.body",
  },
];

export function WhyAtockorea() {
  const t = useTranslations("home");
  const reveal = useRevealContainerProps();

  return (
    <section
      className="relative overflow-hidden px-4 section-py-sm"
      style={{ background: "var(--surface-section-warm)" }}
    >
      <motion.div {...reveal} className="relative z-[1] mx-auto max-w-5xl">
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="mb-7 text-center md:mb-9">
          <p className="mb-3 text-eyebrow md:mb-4">
            {t("premium.v2.whyAtockorea.eyebrow")}
          </p>
          <h2 className="mb-2 text-balance text-h2 text-slate-900">
            {t("premium.v2.whyAtockorea.title")}{" "}
            <span className="font-extrabold text-amber-700">
              {t("premium.v2.whyAtockorea.titleAccent")}
            </span>
          </h2>
          <p className="mx-auto max-w-xl text-body text-slate-600">
            {t("premium.v2.whyAtockorea.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.id}
                variants={REVEAL_ITEM_VARIANTS}
                className="group relative overflow-hidden home-neutral-card rounded-card p-4 md:p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 motion-reduce:transition-none"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 text-h3 text-slate-900">
                      <span className="font-extrabold text-slate-900">
                        {t(pillar.titleAccentKey)}
                      </span>{" "}
                      {t(pillar.titleKey)}
                    </h3>
                    <p className="text-caption text-slate-600">
                      {t(pillar.bodyKey)}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p variants={REVEAL_ITEM_VARIANTS} className="mt-6 text-center text-caption text-slate-500 md:mt-7">
          {t("premium.v2.whyAtockorea.tagline")}
        </motion.p>
      </motion.div>
    </section>
  );
}
