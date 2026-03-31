"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export function PremiumFAQ() {
  const faqs = [
    {
      question: "What happens if it rains?",
      answer: "Light rain rarely affects the tour—we provide umbrellas. For heavy rain, we offer free rescheduling or full refund."
    },
    {
      question: "Can you accommodate dietary needs?",
      answer: "Yes. Note any dietary needs when booking. Guides know the best vegetarian, vegan, halal, and allergy-friendly options."
    },
    {
      question: "Is this suitable for children?",
      answer: "Children 5+ generally enjoy this tour. Car seats available with advance notice."
    },
    {
      question: "How private is the tour?",
      answer: "Fully private—just your group and guide. No joining with strangers, no rigid schedule."
    },
    {
      question: "Can I customize the stops?",
      answer: "Minor adjustments welcome. For significant changes, consider our Custom Tour option."
    },
    {
      question: "What's the cancellation policy?",
      answer: "48+ hours: full refund. 24-48 hours: 50%. Within 24 hours: no refund. Weather cancellations by us: full refund."
    }
  ]

  return (
    <section className="px-4 lg:px-6 py-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-neutral-900 mb-1 tracking-tight">
          Common Questions
        </h2>
        <p className="text-[13px] text-neutral-500">
          Quick answers to help you decide
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 px-4">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`} 
              className="border-neutral-100"
            >
              <AccordionTrigger className="text-left text-[13px] font-medium text-neutral-900 hover:no-underline py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-[13px] text-neutral-600 leading-relaxed pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
