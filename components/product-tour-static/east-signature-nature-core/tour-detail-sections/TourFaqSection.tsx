"use client";

import { useState } from "react";
import { renderEmphasis } from "@/components/product-tour-static/_shared/inlineEmphasis";
import { ChevronDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

/**
 * Answers are authored with `**bold**` like the rest of the tour copy.
 *
 * `text-foreground` rather than the renderer's `text-slate-900` default: the FAQ
 * body already uses `text-muted-foreground`, so a hardcoded near-black would be
 * the one element in this section that ignores the theme.
 */
const FAQ_BOLD = "font-semibold text-foreground";

export type TourFaqSectionProps = Pick<EastSignatureNatureCoreDetailViewModel, "staticQuestions" | "sectionUi">;

export function TourFaqSection({ staticQuestions, sectionUi }: TourFaqSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>("first-time");
  const [showMore, setShowMore] = useState(false);

  const mainQuestions = staticQuestions.slice(0, 5);
  const moreQuestions = staticQuestions.slice(5);

  const toggleQuestion = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const openAssistant = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("atc:open-assistant", { detail: { source: "tour_faq_footer" } }),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.faqTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.faqSubtitle}</p>
      </div>

      <div className="overflow-hidden divide-y divide-border/60 rounded-[26px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        {mainQuestions.map((q) => (
          <div key={q.id}>
            <button
              onClick={() => toggleQuestion(q.id)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
            >
              <h3 className="text-sm font-medium text-foreground pr-4 leading-snug">{q.question}</h3>
              <div
                className={cn("flex-shrink-0 p-1 rounded-full transition-[transform,background-color] duration-200", expandedId === q.id ? "bg-primary/10 rotate-180" : "")}
              >
                <ChevronDown className={cn("h-4 w-4 transition-colors", expandedId === q.id ? "text-primary" : "text-muted-foreground")} />
              </div>
            </button>

            <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", expandedId === q.id ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                <div className="px-4 pb-5">
                  <p className="text-sm text-muted-foreground leading-[1.7]">
                    {renderEmphasis(q.answer, undefined, FAQ_BOLD)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div>
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
          >
            <span className="text-sm font-medium text-primary tracking-tight">
              {showMore
                ? sectionUi.faqShowFewer
                : sectionUi.faqMoreQuestionsTemplate.replace("{count}", String(moreQuestions.length))}
            </span>
            <div className={cn("flex-shrink-0 p-1 rounded-full transition-[transform,background-color] duration-200", showMore ? "bg-primary/10 rotate-180" : "")}>
              <ChevronDown className="h-4 w-4 text-primary" />
            </div>
          </button>
        </div>

        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", showMore ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden divide-y divide-border/60">
            {moreQuestions.map((q) => (
              <div key={q.id}>
                <button
                  onClick={() => toggleQuestion(q.id)}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
                >
                  <h3 className="text-sm font-medium text-foreground pr-4 leading-snug">{q.question}</h3>
                  <div
                    className={cn("flex-shrink-0 p-1 rounded-full transition-[transform,background-color] duration-200", expandedId === q.id ? "bg-primary/10 rotate-180" : "")}
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-colors", expandedId === q.id ? "text-primary" : "text-muted-foreground")} />
                  </div>
                </button>

                <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", expandedId === q.id ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {renderEmphasis(q.answer, undefined, FAQ_BOLD)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3.5 rounded-xl bg-mist-blue/70 border border-border/60 p-4 shadow-premium">
        <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageCircle className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{sectionUi.faqFooterTitle}</p>
          {/* Was `<a href="#">` with no handler — it looked like a link, and
              tapping it did nothing but jump to the top of the page. The
              assistant widget on this page exposes the same open hook the home
              sections use (`TourProductAiAssistantWidget` OPEN_ASSISTANT_EVENT),
              so this now opens the thing its label promises. */}
          <button
            type="button"
            onClick={openAssistant}
            className="text-sm text-primary hover:underline"
          >
            {sectionUi.faqFooterLink}
          </button>
        </div>
      </div>
    </div>
  );
}
