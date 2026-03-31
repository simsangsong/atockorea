'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'What time does the tour start and end?',
    answer: 'Hotel pickup between 8:30-9:00 AM, returning by 6:00-6:30 PM. Total duration is approximately 8-9 hours.',
  },
  {
    question: 'Is this tour suitable for children?',
    answer: 'Yes, suitable for children ages 6 and up. The walking is moderate with plenty of breaks. For younger children, please contact us.',
  },
  {
    question: 'What happens if it rains?',
    answer: 'We operate rain or shine with contingency stops for shelter. Severe weather cancellations are fully refunded.',
  },
  {
    question: 'Can the itinerary be customized?',
    answer: 'Minor adjustments for dietary or mobility needs are welcome. For major changes, inquire about our private tours.',
  },
  {
    question: 'What dietary options are available?',
    answer: 'We accommodate vegetarian, vegan, and common allergies with advance notice.',
  },
  {
    question: 'How many people will be on the tour?',
    answer: 'Maximum 8 guests per tour. Private tours are also available.',
  },
]

export function FAQSection() {
  return (
    <section className="px-5 py-14 md:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-[22px] font-normal text-foreground mb-2 md:text-[26px] tracking-tight">
          Questions
        </h2>
        <p className="text-[13px] text-muted-foreground mb-8 tracking-wide">
          Common questions from our guests
        </p>
        
        <div className="glass-card rounded-2xl overflow-hidden">
          <Accordion type="single" collapsible className="divide-y divide-border/40">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`} className="border-0">
                <AccordionTrigger className="px-6 py-5 text-left hover:no-underline hover:bg-secondary/30 transition-colors [&>svg]:shrink-0">
                  <span className="text-[14px] font-medium text-foreground pr-4">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
