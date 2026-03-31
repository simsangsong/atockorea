'use client'

import { useState } from 'react'
import { Mail, MessageCircle, MapPin, Clock, FileText, Lightbulb, ChevronRight } from 'lucide-react'

const steps = [
  {
    icon: Mail,
    title: 'Instant Confirmation',
    timing: 'Immediately',
    description: 'Booking confirmation email with tour summary, meeting point, and contact details.',
    detail: 'Save this email - it contains your booking reference and emergency contact numbers.',
  },
  {
    icon: Clock,
    title: '12-Hour Reminder',
    timing: '12 hours before',
    description: 'WhatsApp message with final pickup time, weather forecast, and last-minute tips.',
    detail: 'We\'ll confirm your exact hotel lobby pickup time and share the day\'s weather outlook.',
  },
  {
    icon: MapPin,
    title: 'Final Pickup Guide',
    timing: 'Evening before',
    description: 'Detailed pickup instructions with driver photo, vehicle description, and direct contact.',
    detail: 'Your guide\'s WhatsApp number for any morning-of questions or delays.',
  },
  {
    icon: FileText,
    title: 'Day-Of Route Notes',
    timing: 'Morning of tour',
    description: 'Brief overview of the day\'s plan with any weather-based adjustments.',
    detail: 'If conditions require stop changes, your guide explains alternatives before departure.',
  },
  {
    icon: Lightbulb,
    title: 'Stop-by-Stop Tips',
    timing: 'During tour',
    description: 'Your guide shares photo spots, local insights, and timing suggestions at each location.',
    detail: 'Feel free to ask questions - guides love sharing Jeju knowledge beyond the basics.',
  },
  {
    icon: MessageCircle,
    title: 'Post-Tour Support',
    timing: 'After tour',
    description: 'Need restaurant recommendations or help with the rest of your trip? We\'re here.',
    detail: 'Our WhatsApp stays open for questions about your remaining time in Jeju.',
  },
]

export function AfterBooking() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  return (
    <section className="px-5 py-14 md:px-8 lg:px-10 bg-secondary/40">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-[22px] font-normal text-foreground mb-2 md:text-[26px] tracking-tight">
          After You Book
        </h2>
        <p className="text-[13px] text-muted-foreground mb-8 tracking-wide">
          The support you receive before, during, and after your experience
        </p>
        
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isExpanded = expandedStep === index
            return (
              <button
                key={step.title}
                onClick={() => setExpandedStep(isExpanded ? null : index)}
                className="w-full glass-card rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
                      <step.icon className="h-4 w-4 text-foreground/50" />
                    </div>
                    {/* Step number */}
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 mb-0.5">
                          {step.timing}
                        </p>
                        <h3 className="text-[14px] font-medium text-foreground">{step.title}</h3>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground/40 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-1.5">
                      {step.description}
                    </p>
                    {isExpanded && (
                      <p className="text-[12px] text-muted-foreground/70 leading-relaxed mt-3 pt-3 border-t border-border/30 animate-in fade-in duration-200">
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        
        {/* Trust note */}
        <div className="mt-8 text-center">
          <p className="text-[12px] text-muted-foreground/60">
            Questions before booking? <span className="text-primary">Message us anytime</span>
          </p>
        </div>
      </div>
    </section>
  )
}
