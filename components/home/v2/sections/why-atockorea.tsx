"use client";

import { useEffect, useRef } from "react";
import { Sparkles, Wand2, ShieldCheck, Headphones } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

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
    id: "ai-match",
    icon: Wand2,
    titleKey: "premium.v2.whyAtockorea.pillar2.title",
    titleAccentKey: "premium.v2.whyAtockorea.pillar2.titleAccent",
    bodyKey: "premium.v2.whyAtockorea.pillar2.body",
  },
  {
    id: "licensed",
    icon: ShieldCheck,
    titleKey: "premium.v2.whyAtockorea.pillar3.title",
    titleAccentKey: "premium.v2.whyAtockorea.pillar3.titleAccent",
    bodyKey: "premium.v2.whyAtockorea.pillar3.body",
  },
  {
    id: "support",
    icon: Headphones,
    titleKey: "premium.v2.whyAtockorea.pillar4.title",
    titleAccentKey: "premium.v2.whyAtockorea.pillar4.titleAccent",
    bodyKey: "premium.v2.whyAtockorea.pillar4.body",
  },
];

export function WhyAtockorea() {
  const t = useTranslations("home");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const children = containerRef.current.querySelectorAll("[data-pillar]");
      children.forEach((child, index) => {
        window.setTimeout(() => {
          child.classList.add("visible");
        }, index * 100);
      });
    }
  }, []);

  return (
    <section
      className="relative overflow-hidden px-4 section-py-sm"
      style={{ background: "var(--surface-section-warm)" }}
    >
      <div ref={containerRef} className="relative z-[1] mx-auto max-w-5xl">
        <div className="mb-7 text-center md:mb-9">
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
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                data-pillar
                className="group relative overflow-hidden scroll-animate home-neutral-card rounded-card p-4 md:p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 motion-reduce:transition-none"
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
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-caption text-slate-500 md:mt-7">
          {t("premium.v2.whyAtockorea.tagline")}
        </p>
      </div>
    </section>
  );
}
