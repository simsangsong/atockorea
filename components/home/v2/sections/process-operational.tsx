"use client";

import { useEffect, useRef } from "react";
import { Send, CheckCircle, MapIcon, MapPin, Bell, Headphones } from "lucide-react";
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
      className="py-14 md:py-20 px-4"
      style={{ background: "linear-gradient(to bottom, rgba(242, 245, 255, 0.4), rgba(248, 245, 240, 0.25))" }}
    >
      <div ref={containerRef} className="max-w-5xl mx-auto scroll-animate">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight mb-3">
            {t("premium.v2.process.title")}
          </h2>
        </div>

        <div className="relative mb-12">
          <div className="hidden lg:block absolute top-[28px] left-[40px] right-[40px] h-0.5 bg-gradient-to-r from-slate-200 via-primary/20 via-primary/10 to-slate-200 z-0" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            <div className="home-neutral-process p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-white flex-shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-primary/70 uppercase tracking-wider">
                  {t("premium.v2.process.step1Label")}
                </span>
              </div>
              <h4 className="text-[15px] font-semibold text-slate-800 mb-1.5">{t("premium.v2.process.step1Title")}</h4>
              <p className="text-slate-600 text-[13px] leading-relaxed">
                {t("premium.v2.process.step1Body")}
              </p>
            </div>

            <div className="home-neutral-process p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-4 ring-white flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  {t("premium.v2.process.step2Label")}
                </span>
              </div>
              <h4 className="text-[15px] font-semibold text-slate-800 mb-1.5">{t("premium.v2.process.step2Title")}</h4>
              <p className="text-slate-600 text-[13px] leading-relaxed">
                {t("premium.v2.process.step2Body")}
              </p>
            </div>

            <div className="home-neutral-process p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 ring-4 ring-white flex-shrink-0">
                  <MapIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                  {t("premium.v2.process.step3Label")}
                </span>
              </div>
              <h4 className="text-[15px] font-semibold text-slate-800 mb-1.5">{t("premium.v2.process.step3Title")}</h4>
              <p className="text-slate-600 text-[13px] leading-relaxed">
                {t("premium.v2.process.step3Body")}
              </p>
            </div>

            <div className="home-neutral-process p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 ring-4 ring-white flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  {t("premium.v2.process.step4Label")}
                </span>
              </div>
              <h4 className="text-[15px] font-semibold text-slate-800 mb-1.5">{t("premium.v2.process.step4Title")}</h4>
              <p className="text-slate-600 text-[13px] leading-relaxed">
                {t("premium.v2.process.step4Body")}
              </p>
            </div>
          </div>
        </div>

        <div className="home-panel-closing p-6 md:p-8">
          <h3 className="text-lg md:text-xl font-bold text-slate-900 text-center mb-6">
            {t("premium.v2.process.trustPanelTitle")}
          </h3>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[14px] text-slate-800 font-semibold mb-1">{t("premium.v2.process.trust1Title")}</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  {t("premium.v2.process.trust1Body")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <p className="text-[14px] text-slate-800 font-semibold mb-1">{t("premium.v2.process.trust2Title")}</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  {t("premium.v2.process.trust2Body")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Headphones className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[14px] text-slate-800 font-semibold mb-1">{t("premium.v2.process.trust3Title")}</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  {t("premium.v2.process.trust3Body")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
