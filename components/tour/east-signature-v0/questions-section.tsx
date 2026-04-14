"use client"

import { useState } from "react"
import { ChevronDown, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

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
    answer: "Yes. The route adjusts—cave stops are prioritized in heavy rain, and outdoor exposure is managed."
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
    answer: "Yes. Coastal sections are sensitive to wind, traffic, and crowds; partial reordering can create a smoother flow—optimization, not a downgrade."
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
    answer: "Seopjikoji and Seongsan are signature highlights—grouping them focuses the scenic core of the day; Hamdeok releases intensity with a lighter finish."
  }
]

export function QuestionsSection() {
  const [expandedId, setExpandedId] = useState<string | null>("first-time")
  const [showMore, setShowMore] = useState(false)

  const mainQuestions = allQuestions.slice(0, 5)
  const moreQuestions = allQuestions.slice(5)

  const toggleQuestion = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Questions
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          The few questions that usually decide it.
        </p>
      </div>
      
      {/* FAQ List - Cleaner, lighter, premium */}
      <div className="card-premium overflow-hidden divide-y divide-border/60">
        {mainQuestions.map((q) => (
          <div key={q.id}>
            <button
              onClick={() => toggleQuestion(q.id)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
            >
              <h3 className="text-sm font-medium text-foreground pr-4 leading-snug">{q.question}</h3>
              <div className={cn(
                "flex-shrink-0 p-1 rounded-full transition-all duration-200",
                expandedId === q.id ? "bg-primary/10 rotate-180" : ""
              )}>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-colors",
                  expandedId === q.id ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            </button>
            
            <div className={cn(
              "grid transition-all duration-200 ease-out",
              expandedId === q.id ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}>
              <div className="overflow-hidden">
                <div className="px-4 pb-5">
                  <p className="text-sm text-muted-foreground leading-[1.7]">{q.answer}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Show More Toggle - Intentional and branded */}
        <div>
          <button
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
            {moreQuestions.map((q) => (
              <div key={q.id}>
                <button
                  onClick={() => toggleQuestion(q.id)}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
                >
                  <h3 className="text-sm font-medium text-foreground pr-4 leading-snug">{q.question}</h3>
                  <div className={cn(
                    "flex-shrink-0 p-1 rounded-full transition-all duration-200",
                    expandedId === q.id ? "bg-primary/10 rotate-180" : ""
                  )}>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-colors",
                      expandedId === q.id ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                </button>
                
                <div className={cn(
                  "grid transition-all duration-200 ease-out",
                  expandedId === q.id ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
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
      </div>
      
      {/* Contact CTA - Premium concierge prompt */}
      <div className="flex items-center gap-3.5 rounded-xl bg-mist-blue/70 border border-border/60 p-4 shadow-premium">
        <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageCircle className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Questions before booking?</p>
          <a href="#" className="text-sm text-primary hover:underline">Message us anytime</a>
        </div>
      </div>
    </div>
  )
}
