"use client"

import { useState } from "react"
import { Check, Minus, Info, Package } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = ["Included", "Not Included", "Good to Know"]

const included = [
  "Private vehicle (sedan or SUV based on group size)",
  "Professional local driver-guide",
  "Hotel pickup and drop-off",
  "Bottled water",
  "All parking and toll fees",
  "Flexible itinerary adjustments"
]

const notIncluded = [
  "Meals and personal expenses",
  "Temple or attraction admission fees (if any)",
  "Tips for guide (appreciated but optional)",
  "Travel insurance",
  "Items not mentioned in inclusions"
]

const goodToKnow = [
  "Child seats available upon request (please mention when booking)",
  "Tour can accommodate luggage for travelers with late flights",
  "Weather-dependent activities may be adjusted",
  "Comfortable walking shoes recommended",
  "Some temple areas require modest dress",
  "Guide can recommend restaurants based on your preferences"
]

export function InclusionsSection() {
  const [activeTab, setActiveTab] = useState(0)

  const getContent = () => {
    switch (activeTab) {
      case 0:
        return included.map((item, i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center flex-shrink-0 mt-0.5 border border-accent/15">
              <Check className="w-3 h-3 text-accent" />
            </div>
            <span className="text-[13px] text-foreground leading-relaxed">{item}</span>
          </li>
        ))
      case 1:
        return notIncluded.map((item, i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              <Minus className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-[13px] text-muted-foreground leading-relaxed">{item}</span>
          </li>
        ))
      case 2:
        return goodToKnow.map((item, i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center flex-shrink-0 mt-0.5 border border-accent/15">
              <Info className="w-3 h-3 text-accent" />
            </div>
            <span className="text-[13px] text-foreground leading-relaxed">{item}</span>
          </li>
        ))
      default:
        return null
    }
  }

  return (
    <section className="relative py-12 md:py-16 overflow-hidden bg-white">
      <div className="relative px-5 md:px-8 lg:px-0">
        <div className="max-w-4xl mx-auto lg:mx-0">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-accent" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">Package Details</span>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-8">
            What&apos;s included
          </h2>

          {/* Premium pill tabs with glass effect */}
          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className={cn(
                  "px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap",
                  activeTab === index
                    ? "bg-gradient-to-r from-accent to-accent/90 text-white shadow-md shadow-accent/20"
                    : "glass-card-subtle text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content card - Glass effect */}
          <div className="p-6 rounded-2xl glass-card">
            <ul className="divide-y divide-border/30">
              {getContent()}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
