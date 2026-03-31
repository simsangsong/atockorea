"use client"

import { Clock, Users, Globe, Car, MapPin, Footprints, Sparkles, CalendarCheck } from "lucide-react"
import { useRef } from "react"

const facts = [
  { icon: Clock, label: "Duration", value: "8-10 hours" },
  { icon: Users, label: "Group", value: "Private" },
  { icon: Globe, label: "Language", value: "Korean, English" },
  { icon: Car, label: "Vehicle", value: "Sedan / SUV" },
  { icon: MapPin, label: "Pickup", value: "Hotel included" },
  { icon: Footprints, label: "Walking", value: "Moderate" },
  { icon: Sparkles, label: "Best for", value: "First visitors" },
  { icon: CalendarCheck, label: "Booking", value: "Instant confirm" },
]

export function QuickFacts() {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <section className="relative bg-white border-b border-border/30">
      {/* Subtle top shadow for depth */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      
      {/* Mobile: Horizontal scroll with glass chips */}
      <div 
        ref={scrollRef}
        className="md:hidden flex gap-2.5 overflow-x-auto scrollbar-hide px-5 py-5 snap-x snap-mandatory"
      >
        {facts.map((fact, index) => (
          <div 
            key={index}
            className="flex-shrink-0 snap-start flex items-center gap-3 px-4 py-3 glass-card-subtle rounded-xl"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10">
              <fact.icon className="w-4 h-4 text-accent" />
            </div>
            <div className="flex flex-col pr-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{fact.label}</span>
              <span className="text-[13px] font-semibold text-foreground whitespace-nowrap">{fact.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Elegant divided bar with subtle glass effect */}
      <div className="hidden md:grid grid-cols-4 lg:grid-cols-8 bg-gradient-to-r from-muted/30 via-white to-muted/30">
        {facts.map((fact, index) => (
          <div 
            key={index}
            className="relative flex flex-col items-center justify-center py-6 px-3 text-center group hover:bg-accent/5 transition-colors"
          >
            {/* Divider line */}
            {index > 0 && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-10 bg-gradient-to-b from-transparent via-border to-transparent" />
            )}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/10 to-transparent flex items-center justify-center mb-2 group-hover:scale-110 transition-transform border border-accent/5">
              <fact.icon className="w-4 h-4 text-accent" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 font-medium">{fact.label}</span>
            <span className="text-[13px] font-semibold text-foreground">{fact.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
