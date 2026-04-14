"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, MessageCircle } from "lucide-react"
import type { V0FaqQuestion } from "@/lib/tour-detail/east/adapters/v0-support-product-slice"
import { cn } from "../../lib/utils"

interface Question {
  id: string
  question: string
  answer: string
}

const allQuestions: Question[] = [
  {
    id: "first-time",
    question: "Is this good for first-time visitors to Jeju?",
    answer: "Yes. It combines cultural atmosphere, East Jeju coastal scenery, and iconic landmarks in one balanced route."
  },
  {
    id: "walking",
    question: "Is the walking very difficult?",
    answer: "Not overall. The second half can feel more tiring, especially around Seopjikoji and Seongsan depending on weather and walking distance."
  },
  {
    id: "rain",
    question: "Can the tour still run if it rains?",
    answer: "Yes. The route adjusts?봠ave stops are prioritized in heavy rain, and outdoor exposure is managed."
  },
  {
    id: "parents",
    question: "Is it okay to join with parents?",
    answer: "Yes. The structure is generally comfortable, and exposed coastal sections can be shortened if needed."
  },
  {
    id: "children",
    question: "Can I join with children?",
    answer: "Yes. It is closer to scenic sightseeing than a high-activity family itinerary. Better for children 8+ who can handle moderate walking."
  },
  {
    id: "order",
    question: "Can the order change?",
    answer: "Yes. Coastal sections are sensitive to wind, traffic, and crowds; partial reordering can create a smoother flow?봮ptimization, not a downgrade."
  },
  {
    id: "lunch",
    question: "Is lunch included?",
    answer: "That depends on the product setup; the route is designed with a meal break in the middle. Check your booking fare."
  },
  {
    id: "why-stone-park",
    question: "Why start at Jeju Stone Park?",
    answer: "A calmer, more stable start. The route builds mood and scenery gradually instead of peaking immediately with open-sea views."
  },
  {
    id: "why-seongeup",
    question: "Why is Seongeup placed next?",
    answer: "It adds traditional village texture after the stone landscape so the first half feels layered rather than one-note nature."
  },
  {
    id: "why-lunch",
    question: "Why is lunch placed there?",
    answer: "It resets energy before the more exposed and visually intense afternoon at Seopjikoji, Seongsan, and Hamdeok."
  },
  {
    id: "later-structure",
    question: "Why is the later part structured this way?",
    answer: "Seopjikoji and Seongsan are signature highlights?봥rouping them focuses the scenic core of the day; Hamdeok releases intensity with a lighter finish."
  }
]

export function QuestionsSection({
  faqMain,
  faqMore,
  sectionSubtitle,
  emptyMessage,
  contactHref,
}: {
  /** When both arrays are provided, FAQ copy and order match small-group template (pre-partitioned). */
  faqMain?: V0FaqQuestion[] | null
  faqMore?: V0FaqQuestion[] | null
  sectionSubtitle?: string | null
  emptyMessage?: string | null
  contactHref?: string | null
}) {
  const useLive = faqMain != null && faqMore != null
  const mainQuestions: Question[] | V0FaqQuestion[] = useLive ? faqMain : allQuestions.slice(0, 5)
  const moreQuestions: Question[] | V0FaqQuestion[] = useLive ? faqMore : allQuestions.slice(5)

  const [expandedId, setExpandedId] = useState<string | null>("first-time")
  const [showMore, setShowMore] = useState(false)

  /**
   * Primitives only — parent often passes new `faqMain`/`faqMore` arrays each render (`useMemo` output with
   * unstable deps). Sync expanded FAQ only when the first main question identity actually changes.
   */
  const expandedSyncKey = useMemo(() => {
    if (faqMain == null || faqMore == null) return "static"
    if (faqMain.length === 0) return "live-empty"
    const q = faqMain[0]!
    const id = q.id?.trim() || `main-0-${q.question.slice(0, 16)}`
    return `live:${encodeURIComponent(id)}`
  }, [
    faqMain == null || faqMore == null,
    faqMain?.length ?? 0,
    faqMain?.[0]?.id ?? "",
    faqMain?.[0]?.question ?? "",
  ])

  useEffect(() => {
    if (expandedSyncKey === "static") setExpandedId("first-time")
    else if (expandedSyncKey === "live-empty") setExpandedId(null)
    else setExpandedId(decodeURIComponent(expandedSyncKey.slice(5)))
  }, [expandedSyncKey])

  const toggleQuestion = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const questionKey = (q: Question | V0FaqQuestion, i: number, prefix: string) =>
    "id" in q && q.id ? q.id : `${prefix}-${i}-${q.question.slice(0, 16)}`

  const linkHref = contactHref?.trim() || "#"
  const liveEmpty = useLive && faqMain.length === 0 && faqMore.length === 0

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Questions
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {sectionSubtitle?.trim() || "The few questions that usually decide it."}
        </p>
      </div>
      
      {/* FAQ List - Cleaner, lighter, premium */}
      {liveEmpty ? (
        <p className="text-sm text-muted-foreground leading-relaxed" role="status">
          {emptyMessage?.trim() || "Frequently asked questions for this experience will appear here."}
        </p>
      ) : (
      <div className="card-premium overflow-hidden divide-y divide-border/60">
        {mainQuestions.map((q, i) => (
          <div key={questionKey(q, i, "main")}>
            <button
              type="button"
              onClick={() => toggleQuestion(questionKey(q, i, "main"))}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
            >
              <h3 className="text-sm font-medium text-foreground pr-4 leading-snug">{q.question}</h3>
              <div className={cn(
                "flex-shrink-0 p-1 rounded-full transition-all duration-200",
                expandedId === questionKey(q, i, "main") ? "bg-primary/10 rotate-180" : ""
              )}>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-colors",
                  expandedId === questionKey(q, i, "main") ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            </button>
            
            <div className={cn(
              "grid transition-all duration-200 ease-out",
              expandedId === questionKey(q, i, "main") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}>
              <div className="overflow-hidden">
                <div className="px-4 pb-5">
                  <p className="text-sm text-muted-foreground leading-[1.7]">{q.answer}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {moreQuestions.length > 0 ? (
          <>
            {/* Show More Toggle - Intentional and branded */}
            <div>
              <button
                type="button"
                onClick={() => setShowMore(!showMore)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm font-medium text-primary tracking-tight">
                  {showMore ? "Show fewer" : `${moreQuestions.length} more questions`}
                </span>
                <div className={cn(
                  "flex-shrink-0 p-1 rounded-full transition-all duration-200",
                  showMore ? "bg-primary/10 rotate-180" : ""
                )}>
                  <ChevronDown className="h-4 w-4 text-primary" />
                </div>
              </button>
            </div>
            
            {/* More Questions */}
            <div className={cn(
              "grid transition-all duration-300 ease-out",
              showMore ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}>
              <div className="overflow-hidden divide-y divide-border/60">
                {moreQuestions.map((q, i) => (
                  <div key={questionKey(q, i, "more")}>
                    <button
                      type="button"
                      onClick={() => toggleQuestion(questionKey(q, i, "more"))}
                      className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
                    >
                      <h3 className="text-sm font-medium text-foreground pr-4 leading-snug">{q.question}</h3>
                      <div className={cn(
                        "flex-shrink-0 p-1 rounded-full transition-all duration-200",
                        expandedId === questionKey(q, i, "more") ? "bg-primary/10 rotate-180" : ""
                      )}>
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-colors",
                          expandedId === questionKey(q, i, "more") ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                    </button>
                    
                    <div className={cn(
                      "grid transition-all duration-200 ease-out",
                      expandedId === questionKey(q, i, "more") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}>
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">{q.answer}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
      )}
      
      {/* Contact CTA - Premium concierge prompt */}
      <div className="flex items-center gap-3.5 rounded-xl bg-mist-blue/70 border border-border/60 p-4 shadow-premium">
        <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageCircle className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Questions before booking?</p>
          <a href={linkHref} className="text-sm text-primary hover:underline">Message us anytime</a>
        </div>
      </div>
    </div>
  )
}

