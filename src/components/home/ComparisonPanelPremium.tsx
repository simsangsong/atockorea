"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { HOME_STYLE_OPTIONS, styleChipButtonClass } from "@/src/components/home/home-style-options";

const BRAND_NAVY = "#0A1F44";
const CUSTOM_JOIN_HREF = "/custom-join-tour";

/**
 * Optional style tags layered on the hero match request—not a second matching funnel.
 */
export default function ComparisonPanelPremium() {
  const t = useTranslations("home");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const continueHref = useMemo(() => {
    const ids = [...selected].sort().join(",");
    if (!ids) return CUSTOM_JOIN_HREF;
    return `${CUSTOM_JOIN_HREF}?styles=${encodeURIComponent(ids)}`;
  }, [selected]);

  return (
    <section
      className="home-section-y-tight home-section-divide w-full overflow-visible"
      aria-labelledby="travel-styles-branching-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-center sm:mb-7 md:mb-8">
          <p className="home-type-eyebrow">
            {t("premium.comparison.eyebrow")}
          </p>
          <h2
            id="travel-styles-branching-heading"
            className="home-type-display mx-auto mt-3 max-w-[22rem] text-[1.35rem] leading-[1.15] sm:max-w-xl sm:text-[1.65rem] md:max-w-2xl md:text-[1.95rem]"
            style={{ color: BRAND_NAVY }}
          >
            {t("premium.comparison.title")}
          </h2>
          <p className="home-type-body mx-auto mt-3 max-w-lg">
            {t("premium.comparison.subtitle")}
          </p>
        </div>

        <div className="home-panel-refinement p-6 sm:p-7 md:p-8">
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="home-support-micro mx-auto mb-5 block w-full max-w-md text-center sm:mb-6">
              {t("premium.comparison.chipsLegend")}
            </legend>

            <div
              className="flex flex-wrap justify-center gap-2 sm:gap-2.5 md:gap-3 md:justify-center"
              role="group"
              aria-label={t("premium.comparison.chipsAria")}
            >
              {HOME_STYLE_OPTIONS.map(({ id, labelKey }) => {
                const isOn = selected.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggle(id)}
                    className={styleChipButtonClass(isOn)}
                  >
                    {t(`premium.comparison.${labelKey}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <p className="home-type-meta mt-5 text-center sm:mt-6">
            {selected.size === 0
              ? t("premium.comparison.selectionEmpty")
              : t("premium.comparison.selectionStatus", { count: selected.size })}
          </p>

          <div className="mt-6 flex justify-center border-t border-slate-200/40 pt-6 sm:mt-7 sm:pt-7">
            <Link href={continueHref} className="home-btn-secondary px-8 text-center">
              {t("premium.comparison.planningLink")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
