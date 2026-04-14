"use client"

import { useState } from "react"
import { CheckCircle, Users, Route, ChevronDown } from "lucide-react"
import type { V0BookingTrustCard, V0SupportTimelineStep } from "@/lib/tour-detail/east/adapters/v0-support-product-slice"
import { cn } from "../../lib/utils"

const trustItems = [
  {
    icon: CheckCircle,
    title: "Licensed local",
    description: "Jeju-licensed guiding",
    iconBg: "bg-emerald-50/80",
    iconColor: "text-emerald-600"
  },
  {
    icon: Route,
    title: "Route experts",
    description: "Tuned to east coast",
    iconBg: "bg-sky-50/80",
    iconColor: "text-sky-600"
  },
  {
    icon: Users,
    title: "Small groups",
    description: "Max 8 guests",
    iconBg: "bg-amber-50/80",
    iconColor: "text-amber-600"
  }
]

const supportSteps = [
  { timing: "Immediately", title: "Instant Confirmation", detail: "Booking confirmation with itinerary summary" },
  { timing: "12 hours before", title: "12-Hour Reminder", detail: "Weather update and any adjustments" },
  { timing: "Evening before", title: "Final Pickup Guide", detail: "Exact pickup time and driver contact" },
  { timing: "Morning of tour", title: "Day-Of Route Notes", detail: "Morning briefing with conditions" },
  { timing: "During tour", title: "Stop-by-Stop Tips", detail: "Real-time guidance at each location" },
  { timing: "After tour", title: "Post-Tour Support", detail: "Follow-up and recommendations" },
]

const TRUST_ICONS = [CheckCircle, Route, Users] as const

export function BookingSupport({
  trustCards,
  supportTimelineSteps,
}: {
  trustCards?: V0BookingTrustCard[] | null
  supportTimelineSteps?: V0SupportTimelineStep[] | null
}) {
  const [showTimeline, setShowTimeline] = useState(false)

  const trust = trustCards?.length ? trustCards : null
  const steps = supportTimelineSteps?.length ? supportTimelineSteps : null

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Booking & support
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          What to expect before, during, and after.
        </p>
      </div>
      
      {/* Trust Summary - Distinctive high-end cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {(trust
          ? trust.map((item) => {
              const Icon = TRUST_ICONS[item.iconIndex % TRUST_ICONS.length]!
              const palette = [
                { iconBg: "bg-emerald-50/80", iconColor: "text-emerald-600" },
                { iconBg: "bg-sky-50/80", iconColor: "text-sky-600" },
                { iconBg: "bg-amber-50/80", iconColor: "text-amber-600" },
              ][item.iconIndex % 3]!
              return (
                <div
                  key={item.title}
                  className="text-center card-utility p-4 transition-all duration-200 hover:shadow-premium hover:border-border"
                >
                  <div className={cn("w-9 h-9 mx-auto mb-2 rounded-lg flex items-center justify-center", palette.iconBg)}>
                    <Icon className={cn("h-4 w-4", palette.iconColor)} />
                  </div>
                  <h3 className="text-xs font-semibold text-foreground">{item.title}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              )
            })
          : trustItems.map((item) => (
          <div 
            key={item.title} 
            className="text-center card-utility p-4 transition-all duration-200 hover:shadow-premium hover:border-border"
          >
            <div className={cn(
              "w-9 h-9 mx-auto mb-2 rounded-lg flex items-center justify-center",
              item.iconBg
            )}>
              <item.icon className={cn("h-4 w-4", item.iconColor)} />
            </div>
            <h3 className="text-xs font-semibold text-foreground">{item.title}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
          </div>
        )))}
      </div>
      
      {/* After Booking Timeline - Premium service journey */}
      <div className="card-premium overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTimeline(!showTimeline)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/20 transition-colors"
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">After booking</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Support you receive before, during, and after</p>
          </div>
          <div className={cn(
            "flex-shrink-0 p-1.5 rounded-full transition-all duration-200",
            showTimeline ? "bg-primary/10 rotate-180" : "bg-muted/60"
          )}>
            <ChevronDown className={cn(
              "h-4 w-4 transition-colors",
              showTimeline ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
        </button>
        
        <div className={cn(
          "grid transition-all duration-300 ease-out",
          showTimeline ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}>
          <div className="overflow-hidden">
            <div className="border-t border-border/60 p-5">
              <div className="space-y-0">
                {(steps ?? supportSteps).map((step, i, arr) => (
                  <div key={i} className="relative pl-7 pb-5 last:pb-0">
                    {/* Timeline line - elegant */}
                    {i < arr.length - 1 && (
                      <div className="absolute left-[9px] top-5 bottom-0 w-px bg-gradient-to-b from-primary/25 to-border/50" />
                    )}
                    
                    {/* Dot - refined */}
                    <div className="absolute left-0 top-1 h-[18px] w-[18px] rounded-full border-2 border-primary/80 bg-white shadow-sm" />
                    
                    <div>
                      <p className="text-[10px] font-semibold text-primary tracking-wide">{step.timing}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

