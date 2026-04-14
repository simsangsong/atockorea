"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { Star, ChevronRight, ChevronDown, Users, MapPin } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";
import { buildCustomJoinTourHref } from "@/lib/home/services/custom-join-href";
import { appendIntentPhraseToIntentField } from "@/lib/home/services/hero-intent-append-chip";
import type { HeroDestination } from "@/lib/home/types/hero-planner";
import { HOME_STYLE_OPTIONS } from "@/src/components/home/home-style-options";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import { useHomeHeroMobileMq } from "@/hooks/home/useHomeHeroMobileMq";

/** Same split as legacy `HeroPremium` (calmer ATF). */
const HERO_CHIP_PREVIEW_COUNT = 3;

const CUSTOM_JOIN_HREF = "/custom-join-tour";

/** v0 hero video + poster (repo may not have `/images/jeju-hero.jpg`). */
const HERO_VIDEO_MP4 = "https://videos.pexels.com/video-files/3629519/3629519-uhd_2560_1440_30fps.mp4";
const HERO_VIDEO_POSTER =
  "https://images.unsplash.com/photo-1612540693280-56a6881c11f1?w=1920&q=80&auto=format&fit=crop";

export function HeroSection() {
  const t = useTranslations("home");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isMobileHome = useHomeHeroMobileMq();
  const { startInPageMatchFlow } = useHomeV2Match();

  const [destination, setDestination] = useState<HeroDestination>("jeju");
  const [intent, setIntent] = useState("");
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const styleChipOptions = useMemo(
    () =>
      HOME_STYLE_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(`premium.comparison.${opt.labelKey}`),
      })),
    [t],
  );

  const previewChips = useMemo(
    () => styleChipOptions.slice(0, HERO_CHIP_PREVIEW_COUNT),
    [styleChipOptions],
  );

  const extraChips = useMemo(
    () => styleChipOptions.slice(HERO_CHIP_PREVIEW_COUNT),
    [styleChipOptions],
  );

  const hasExpandableChips = extraChips.length > 0;

  const appendChip = useCallback((phrase: string) => {
    setIntent((prev) => appendIntentPhraseToIntentField(prev, phrase));
  }, []);

  const continueHref = useMemo(
    () => buildCustomJoinTourHref({ basePath: CUSTOM_JOIN_HREF, destination, intent }),
    [destination, intent],
  );

  const handleSubmit = useCallback(() => {
    if (isMobileHome) {
      startInPageMatchFlow();
      return;
    }
    analytics.heroFormStart();
    startTransition(() => {
      router.push(continueHref);
    });
  }, [continueHref, isMobileHome, router, startInPageMatchFlow]);

  const chipLooksSelected = useCallback((label: string) => intent.includes(label), [intent]);

  return (
    <section className="relative flex flex-col">
      <div className="relative min-h-[32vh] md:min-h-[44vh] flex flex-col justify-end pb-6 md:pb-12 overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={HERO_VIDEO_POSTER}
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src={HERO_VIDEO_MP4} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-900/25 to-slate-800/50" />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#faf9f7] via-white/5 to-transparent"
            style={{ height: "100%" }}
          />
        </div>

        <div className="relative z-10 px-5 md:px-8 max-w-2xl mx-auto w-full text-center">
          <h1
            className="text-[1.75rem] md:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.12] tracking-[-0.02em] mb-2"
            style={{
              textShadow: "0 2px 20px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Find the Korea day tour that fits you best
          </h1>

          <p
            className="text-[14px] md:text-base text-white/95 font-medium tracking-wide max-w-md mx-auto"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)" }}
          >
            Skip the endless OTA search. Explore proven tours in one place and get the best match for your style,
            budget, and destination.
          </p>
        </div>
      </div>

      <div
        className="relative px-4 md:px-8 pt-0 pb-8 md:pb-10"
        style={{ background: "linear-gradient(to bottom, #faf9f7, #fdfcfb, #ffffff)" }}
      >
        <div className="relative max-w-lg mx-auto -mt-3 md:-mt-4">
          <div className="absolute -inset-3 bg-gradient-to-b from-white/90 via-amber-50/20 to-transparent rounded-[28px] blur-2xl opacity-80" />

          <div
            className="relative rounded-[18px] md:rounded-[20px] p-5 md:p-7"
            style={{
              background: "linear-gradient(to bottom, #fffffe, #fdfcfa)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div className="mb-5 md:mb-6">
              <h2 className="text-[16px] md:text-lg font-semibold text-slate-800 tracking-[-0.01em] mb-1">
                Tell us what matters to you
              </h2>
              <p className="text-[13px] md:text-[14px] text-slate-600 leading-relaxed">
                We&apos;ll surface the tour style that fits you best.
              </p>
            </div>

            <div className="mb-5 md:mb-6">
              <label className="block text-[11px] md:text-[12px] font-semibold text-slate-600 tracking-wide mb-2 md:mb-3">
                Where would you like to go?
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDestination("jeju")}
                  className={`relative px-2 py-3 md:px-3 md:py-3.5 rounded-xl md:rounded-2xl font-medium transition-all duration-[250ms] text-center ${
                    destination === "jeju"
                      ? "bg-slate-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.12),0_6px_20px_rgba(0,0,0,0.08)]"
                      : "bg-slate-50/80 text-slate-600 hover:bg-slate-100/80 border border-slate-200/60"
                  }`}
                >
                  <span className="block text-[13px] md:text-[14px] font-semibold tracking-[-0.01em]">
                    {t("premium.hero.destJeju")}
                  </span>
                  <span
                    className={`flex items-center justify-center gap-1 text-[9px] md:text-[10px] mt-1 tracking-wide ${
                      destination === "jeju" ? "text-emerald-300" : "text-emerald-600"
                    }`}
                  >
                    <span
                      className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${
                        destination === "jeju" ? "bg-emerald-400" : "bg-emerald-500"
                      }`}
                    />
                    {t("premium.hero.destSegmentLabelAvailable")}
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  tabIndex={-1}
                  aria-disabled
                  aria-label={`${t("premium.hero.destSeoul")}, ${t("premium.hero.destStatusComingSoon")}`}
                  className="px-2 py-3 md:px-3 md:py-3.5 rounded-xl md:rounded-2xl text-center bg-slate-50/50 border border-slate-150/50 cursor-not-allowed"
                >
                  <span className="block text-[13px] md:text-[14px] font-medium text-slate-400 tracking-[-0.01em]">
                    {t("premium.hero.destSeoul")}
                  </span>
                  <span className="block text-[9px] md:text-[10px] mt-1 tracking-wide text-slate-400/70">
                    <span className="block">{t("premium.hero.destComingSoonLine1")}</span>
                    <span className="block">{t("premium.hero.destComingSoonLine2")}</span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  tabIndex={-1}
                  aria-disabled
                  aria-label={`${t("premium.hero.destBusan")}, ${t("premium.hero.destStatusComingSoon")}`}
                  className="px-2 py-3 md:px-3 md:py-3.5 rounded-xl md:rounded-2xl text-center bg-slate-50/50 border border-slate-150/50 cursor-not-allowed"
                >
                  <span className="block text-[13px] md:text-[14px] font-medium text-slate-400 tracking-[-0.01em]">
                    {t("premium.hero.destBusan")}
                  </span>
                  <span className="block text-[9px] md:text-[10px] mt-1 tracking-wide text-slate-400/70">
                    <span className="block">{t("premium.hero.destComingSoonLine1")}</span>
                    <span className="block">{t("premium.hero.destComingSoonLine2")}</span>
                  </span>
                </button>
              </div>
            </div>

            <div className="mb-4 md:mb-5">
              <label
                htmlFor="home-v2-hero-intent"
                className="block text-[11px] md:text-[12px] font-semibold text-slate-600 tracking-wide mb-2"
              >
                What kind of experience are you looking for?
              </label>
              <div className="relative">
                <textarea
                  id="home-v2-hero-intent"
                  ref={textareaRef}
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  onFocus={() => setIsInputExpanded(true)}
                  onBlur={() => {
                    if (!intent.trim()) setIsInputExpanded(false);
                  }}
                  placeholder={t("premium.hero.inputPlaceholder")}
                  rows={isInputExpanded ? 3 : 2}
                  autoComplete="off"
                  className={`w-full px-3.5 py-3 text-[13px] md:text-[14px] rounded-xl resize-none transition-all duration-300 placeholder:text-slate-400/80 ${
                    isInputExpanded ? "min-h-[88px]" : "min-h-[52px]"
                  }`}
                  style={{
                    background: "linear-gradient(to bottom, #fafafa, #ffffff)",
                    border: "1px solid rgba(0,0,0,0.06)",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
                    outline: "none",
                  }}
                  onFocusCapture={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(30,58,95,0.2)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(30,58,95,0.06), inset 0 1px 2px rgba(0,0,0,0.02)";
                  }}
                  onBlurCapture={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(0,0,0,0.06)";
                    e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
              <p className="text-[11px] md:text-[12px] text-slate-500 mt-2 leading-relaxed">
                {t("premium.hero.textareaHelperJeju")}
              </p>
            </div>

            <div className="mb-5 md:mb-6" role="group" aria-label={t("premium.comparison.chipsAria")}>
              <p className="text-[11px] md:text-[12px] font-semibold text-slate-600 tracking-wide mb-2">
                {t("premium.hero.chipsLegend")}
              </p>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {previewChips.map((tag) => {
                  const isSelected = chipLooksSelected(tag.label);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => appendChip(tag.label)}
                      className={`px-3 py-1.5 md:px-3.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-full transition-all duration-200 ${
                        isSelected
                          ? "bg-slate-800 text-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                          : "text-slate-600 hover:bg-slate-100/80"
                      }`}
                      style={
                        !isSelected
                          ? {
                              background: "linear-gradient(to bottom, #fafafa, #f5f5f5)",
                              border: "1px solid rgba(0,0,0,0.06)",
                            }
                          : undefined
                      }
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>

              {hasExpandableChips && chipsExpanded ? (
                <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                  {extraChips.map((tag) => {
                    const isSelected = chipLooksSelected(tag.label);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => appendChip(tag.label)}
                        className={`px-3 py-1.5 md:px-3.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-full transition-all duration-200 ${
                          isSelected
                            ? "bg-slate-800 text-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                            : "text-slate-600 hover:bg-slate-100/80"
                        }`}
                        style={
                          !isSelected
                            ? {
                                background: "linear-gradient(to bottom, #fafafa, #f5f5f5)",
                                border: "1px solid rgba(0,0,0,0.06)",
                              }
                            : undefined
                        }
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {hasExpandableChips && !chipsExpanded ? (
                <button
                  type="button"
                  onClick={() => setChipsExpanded(true)}
                  className="mt-2 text-[10px] md:text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-0.5"
                >
                  {t("premium.hero.chipsShowMore")}
                  <ChevronDown className="w-3 h-3" />
                </button>
              ) : null}

              {hasExpandableChips && chipsExpanded ? (
                <button
                  type="button"
                  onClick={() => setChipsExpanded(false)}
                  className="mt-2 text-[10px] md:text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {t("premium.hero.chipsShowLess")}
                </button>
              ) : null}
            </div>

            <p className="text-[11px] md:text-[12px] text-slate-500 text-center mb-4 leading-relaxed">
              Compare small group, private, and bus options next.
            </p>

            <V0ShadcnButton
              type="button"
              size="lg"
              disabled={isPending}
              aria-busy={isPending}
              onClick={handleSubmit}
              className="h-auto w-full font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-[14px] transition-all duration-300 disabled:opacity-70"
              style={{
                background: "linear-gradient(to bottom, #1e3a5f, #172d4a)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(30,58,95,0.2), 0 8px 24px rgba(30,58,95,0.1)",
                border: "none",
                color: "#fff",
              }}
            >
              {t("premium.hero.findMatchCta")}
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </V0ShadcnButton>
          </div>
        </div>

        <div className="mt-6 md:mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-6">
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 md:w-3.5 md:h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">Matched to you</span>
          </div>

          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-500" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">Clear pickup</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-500" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">Compare all types</span>
          </div>
        </div>
      </div>
    </section>
  );
}
