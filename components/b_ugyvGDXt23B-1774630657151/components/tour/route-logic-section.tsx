"use client"

import { Compass, ArrowRight, Clock, Sun, TrafficCone, Mountain } from "lucide-react"

const routeReasons = [
  {
    icon: Sun,
    title: "Morning light at the temple",
    description: "Start early at Haedong Yonggungsa for the best lighting and fewer crowds"
  },
  {
    icon: TrafficCone,
    title: "Traffic-optimized flow",
    description: "East-to-west route avoids rush hour bottlenecks through central Busan"
  },
  {
    icon: Clock,
    title: "Natural lunch timing",
    description: "Jagalchi Market arrives perfectly timed for a seafood lunch break"
  },
  {
    icon: Mountain,
    title: "Scenic progression",
    description: "Ends at Gwangalli Beach for golden hour views of Diamond Bridge"
  }
]

export function RouteLogicSection() {
  return (
    <section className="px-5 md:px-8 lg:px-0 py-10 md:py-14">
      <div className="max-w-4xl mx-auto lg:mx-0">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-accent" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">Route Logic</span>
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-3">
          Why this order makes sense
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mb-8">
          Every stop is strategically sequenced for optimal lighting, traffic flow, and energy levels throughout the day.
        </p>

        {/* Route timeline visualization */}
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-[19px] md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent/40 via-accent/20 to-accent/5" />
          
          <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-8">
            {routeReasons.map((reason, index) => (
              <div 
                key={index}
                className={`relative flex gap-4 ${index % 2 === 1 ? 'md:flex-row-reverse md:text-right' : ''}`}
              >
                {/* Timeline dot */}
                <div className="relative z-10 w-10 h-10 rounded-xl bg-card border border-border/60 shadow-sm flex items-center justify-center flex-shrink-0">
                  <reason.icon className="w-4 h-4 text-accent" />
                </div>
                
                {/* Content */}
                <div className={`flex-1 pb-2 ${index % 2 === 1 ? 'md:pr-4' : ''}`}>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{reason.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{reason.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary note */}
        <div className="mt-8 p-4 rounded-xl bg-accent/5 border border-accent/10">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ArrowRight className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm text-foreground font-medium mb-1">Result: More time exploring, less time in transit</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Total driving time is spread across the day (approximately 1.5 hours total), leaving maximum time at each destination.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
