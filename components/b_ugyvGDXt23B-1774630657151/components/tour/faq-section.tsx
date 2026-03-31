"use client"

import { useState } from "react"
import { ChevronDown, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const faqs = [
  {
    question: "Is hotel pickup included?",
    answer: "Yes, complimentary pickup is available from hotels in Haeundae, Seomyeon, and Busan Station areas. For locations outside these zones, we can arrange pickup at a nearby meeting point."
  },
  {
    question: "Is this tour suitable for children or seniors?",
    answer: "Absolutely. The tour involves moderate walking with plenty of rest opportunities. Child seats are available upon request. We can adjust the pace and itinerary based on your group's needs."
  },
  {
    question: "What happens if the weather is bad?",
    answer: "The tour operates rain or shine. In case of severe weather, we'll suggest indoor alternatives or reschedule at no extra cost. Most stops have covered areas, and we always have backup plans."
  },
  {
    question: "How much walking is involved?",
    answer: "Expect approximately 2-3 km of total walking spread throughout the day, mostly on paved paths. The temple visit includes some stairs. We can minimize walking based on your preferences."
  },
  {
    question: "Can I bring luggage on the tour?",
    answer: "Yes, the vehicle can accommodate standard luggage. This is ideal for travelers heading to the airport after the tour. Please mention your luggage needs when booking."
  },
  {
    question: "Can the route be customized?",
    answer: "Yes, the itinerary is flexible. You can request to spend more time at specific locations, add stops, or skip certain places. Discuss your preferences with your guide."
  },
  {
    question: "What is the cancellation policy?",
    answer: "Free cancellation up to 24 hours before the tour starts for a full refund. Cancellations within 24 hours may be subject to a 50% charge."
  }
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="relative py-12 md:py-16 overflow-hidden">
      {/* Subtle blue-tinted background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-muted/30 to-white" />
      
      <div className="relative px-5 md:px-8 lg:px-0">
        <div className="max-w-4xl mx-auto lg:mx-0">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-accent" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">FAQ</span>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-8">
            Common questions
          </h2>

          {/* Premium accordion with glass cards */}
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className={cn(
                  "rounded-2xl overflow-hidden transition-all duration-200",
                  openIndex === index 
                    ? "glass-card shadow-md" 
                    : "glass-card-subtle hover:shadow-sm"
                )}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-[13px] font-medium text-foreground pr-4 leading-relaxed">
                    {faq.question}
                  </span>
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 border",
                    openIndex === index 
                      ? "bg-gradient-to-br from-accent/15 to-accent/5 border-accent/20" 
                      : "bg-muted/50 border-border/40"
                  )}>
                    <ChevronDown 
                      className={cn(
                        "w-3.5 h-3.5 transition-all duration-200",
                        openIndex === index ? "rotate-180 text-accent" : "text-muted-foreground"
                      )}
                    />
                  </div>
                </button>
                <div 
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    openIndex === index ? "max-h-52" : "max-h-0"
                  )}
                >
                  <p className="px-5 pb-5 text-[13px] text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
