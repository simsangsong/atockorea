"use client"

import { Check, X, Footprints, Camera, Sun, Heart, Baby, Briefcase, Eye } from "lucide-react"

const snapshotItems = [
  { icon: Footprints, label: "Walking level", value: "Moderate" },
  { icon: Camera, label: "Photo appeal", value: "High" },
  { icon: Sun, label: "Weather flex", value: "Indoor options" },
  { icon: Heart, label: "Pace", value: "Relaxed" },
  { icon: Baby, label: "Kid-friendly", value: "Ages 5+" },
  { icon: Briefcase, label: "Luggage", value: "Can store" },
]

const goodFor = [
  "First-time visitors to Busan",
  "Couples and families",
  "Those who prefer comfort over adventure",
  "Photography enthusiasts"
]

const notIdeal = [
  "Travelers seeking extreme adventure",
  "Those who prefer fully independent exploration"
]

export function TourSnapshot() {
  return (
    <section className="relative py-12 md:py-16 overflow-hidden">
      {/* Subtle blue-tinted background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-muted/40 to-muted/50" />
      
      <div className="relative px-5 md:px-8 lg:px-0">
        <div className="max-w-4xl mx-auto lg:mx-0">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-accent" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">At a Glance</span>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-8">
            Is this tour right for you?
          </h2>

          {/* Snapshot grid - Glass chips */}
          <div className="flex flex-wrap gap-3 mb-10">
            {snapshotItems.map((item, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass-card-subtle hover:scale-[1.02] transition-transform"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/12 to-accent/5 flex items-center justify-center flex-shrink-0 border border-accent/10">
                  <item.icon className="w-4 h-4 text-accent" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none mb-0.5">
                    {item.label}
                  </span>
                  <span className="text-[13px] font-semibold text-foreground leading-tight">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Good fit / Not ideal - Glass split cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Good fit card */}
            <div className="relative p-6 rounded-2xl glass-card overflow-hidden">
              {/* Subtle blue accent glow */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-accent/8 rounded-full blur-3xl" />
              
              <div className="relative">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center border border-accent/20">
                    <Check className="w-3.5 h-3.5 text-accent" />
                  </span>
                  Good fit for
                </h3>
                <ul className="space-y-3">
                  {goodFor.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-[13px] text-foreground/85">
                      <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Not ideal card */}
            <div className="relative p-6 rounded-2xl glass-card-subtle overflow-hidden">
              <div className="relative">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border border-border/50">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </span>
                  Not ideal for
                </h3>
                <ul className="space-y-3">
                  {notIdeal.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-[13px] text-muted-foreground">
                      <X className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
