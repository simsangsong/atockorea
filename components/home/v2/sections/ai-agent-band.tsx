"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  ClipboardList,
  Headphones,
  MessageCircle,
  Receipt,
  Search,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";

/**
 * L2 (chatbot promo) — "Your Korea travel agent" band.
 *
 * Promotes the always-present global assistant as a full-funnel agent rather
 * than a canned-FAQ bot. Every capability chip maps to a real capability in
 * `app/api/tour-product/assistant/route.ts` (RAG answers, matcher recommend,
 * quote/catalog, booking-credential intake, booking lookup, human handoff), so
 * the promise is honest (no fabricated claims — §13 guard). The sample
 * exchange is explicitly labelled "Example" so it reads as illustrative, not a
 * fake testimonial/product card. Tight single band (not a long explainer page
 * — §13). Opens the widget via the `atc:open-assistant` CustomEvent (L3 hook).
 */
const CAPS = [
  { id: "answer", icon: MessageCircle },
  { id: "recommend", icon: Sparkles },
  { id: "quote", icon: Receipt },
  { id: "details", icon: ClipboardList },
  { id: "lookup", icon: Search },
  { id: "human", icon: Headphones },
] as const;

export function AiAgentBand() {
  const t = useTranslations("home");
  const reveal = useRevealContainerProps();

  const openAssistant = () => {
    analytics.homeCtaClick({ source: "chatbot_open_aiagent_band" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("atc:open-assistant", { detail: { source: "aiagent_band" } }),
      );
    }
  };

  return (
    <section className="section-py-sm px-4 md:px-6 bg-slate-50">
      <motion.div {...reveal} className="mx-auto max-w-5xl">
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="mb-7 text-center md:mb-9">
          <p className="mb-3 text-eyebrow md:mb-4">{t("premium.v2.aiAgent.eyebrow")}</p>
          <h2 className="mb-2 text-balance text-h2 text-slate-900">
            {t("premium.v2.aiAgent.title")}{" "}
            <span className="font-extrabold text-amber-700">
              {t("premium.v2.aiAgent.titleAccent")}
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-body text-slate-600">
            {t("premium.v2.aiAgent.subtitle")}
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-[1.05fr_1fr] md:items-stretch">
          {/* Capability chips — each maps to a real assistant capability. */}
          <motion.ul
            variants={REVEAL_ITEM_VARIANTS}
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2"
          >
            {CAPS.map(({ id, icon: Icon }) => (
              <li
                key={id}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-3 shadow-sm"
              >
                <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-caption font-semibold leading-snug text-slate-800">
                  {t(`premium.v2.aiAgent.cap.${id}`)}
                </span>
              </li>
            ))}
          </motion.ul>

          {/* Sample exchange — labelled "Example" so it's clearly illustrative. */}
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            className="flex flex-col rounded-card border border-slate-200/70 bg-white p-4 shadow-sm md:p-5"
          >
            <p className="mb-3 text-micro font-semibold uppercase tracking-wider text-slate-400">
              {t("premium.v2.aiAgent.sampleLabel")}
            </p>
            <div className="flex flex-1 flex-col gap-2.5">
              <div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2 text-caption leading-snug text-white">
                {t("premium.v2.aiAgent.sampleUser")}
              </div>
              <div className="max-w-[92%] self-start rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2 text-caption leading-snug text-slate-700">
                {t("premium.v2.aiAgent.sampleAgent")}
              </div>
            </div>
            <button
              type="button"
              onClick={openAssistant}
              className="focus-ring mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-caption font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4 flex-none text-amber-400" aria-hidden />
              {t("premium.v2.aiAgent.cta")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
