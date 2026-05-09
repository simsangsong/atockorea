"use client";

import { useEffect, useRef } from "react";
import { Send, CheckCircle, MapIcon } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

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
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white tracking-tight mb-2">
            {t("premium.v2.process.title")}
          </h2>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-[24px] left-[40px] right-[40px] h-0.5 bg-gradient-to-r from-white/5 via-white/15 to-white/5 z-0" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-white/10 flex-shrink-0">
                  <Send className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider">
                  {t("premium.v2.process.step1Label")}
                </span>
              </div>
              <h4 className="text-[14px] font-semibold text-white mb-1">{t("premium.v2.process.step1Title")}</h4>
              <p className="text-slate-400 text-[12.5px] leading-relaxed">
                {t("premium.v2.process.step1Body")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-4 ring-white/10 flex-shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  {t("premium.v2.process.step2Label")}
                </span>
              </div>
              <h4 className="text-[14px] font-semibold text-white mb-1">{t("premium.v2.process.step2Title")}</h4>
              <p className="text-slate-400 text-[12.5px] leading-relaxed">
                {t("premium.v2.process.step2Body")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 ring-4 ring-white/10 flex-shrink-0">
                  <MapIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                  {t("premium.v2.process.step3Label")}
                </span>
              </div>
              <h4 className="text-[14px] font-semibold text-white mb-1">{t("premium.v2.process.step3Title")}</h4>
              <p className="text-slate-400 text-[12.5px] leading-relaxed">
                {t("premium.v2.process.step3Body")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 ring-4 ring-white/10 flex-shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  {t("premium.v2.process.step4Label")}
                </span>
              </div>
              <h4 className="text-[14px] font-semibold text-white mb-1">{t("premium.v2.process.step4Title")}</h4>
              <p className="text-slate-400 text-[12.5px] leading-relaxed">
                {t("premium.v2.process.step4Body")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
