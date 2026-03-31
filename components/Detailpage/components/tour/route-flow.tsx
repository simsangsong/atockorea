'use client'

import { useState } from 'react'
import { Sun, MapPin, Utensils, Sunset, Wind, Users, CloudRain, ChevronDown } from 'lucide-react'

const flowReasons = [
  {
    icon: Sun,
    title: 'Morning Light Advantage',
    summary: 'Beach first for best colors',
    description: 'Hamdeok Beach at its most magical when crowds are sparse and morning light creates the most vivid turquoise water. Starting here sets a calm, beautiful tone.',
  },
  {
    icon: MapPin,
    title: 'Geographic Flow',
    summary: 'Natural east coast progression',
    description: 'The route follows East Jeju naturally from north to south, minimizing backtracking and maximizing scenic coastal driving between stops.',
  },
  {
    icon: Utensils,
    title: 'Lunch Placement',
    summary: 'Energy reset mid-day',
    description: 'After the cultural village, lunch provides a natural energy reset. Indoor dining offers rest before the more active afternoon coastal stops.',
  },
  {
    icon: Sunset,
    title: 'Afternoon Calm',
    summary: 'Later stops feel lighter',
    description: 'Final stops are intentionally calmer. Stone Park provides a contemplative finish, allowing the day to wind down gracefully rather than rush to the end.',
  },
]

const adjustmentFactors = [
  {
    icon: CloudRain,
    title: 'Weather',
    description: 'Rain may shift outdoor stops earlier or add indoor alternatives. We monitor forecasts closely.',
  },
  {
    icon: Wind,
    title: 'Wind Conditions',
    description: 'Strong coastal winds may adjust cliff walk timing or duration for comfort and safety.',
  },
  {
    icon: Users,
    title: 'Crowding',
    description: 'If popular spots are unusually busy, we may reorder to find quieter windows.',
  },
]

export function RouteFlow() {
  const [expandedReason, setExpandedReason] = useState<string | null>(null)
  const [showAdjustments, setShowAdjustments] = useState(false)

  return (
    <section className="px-5 py-14 md:px-8 lg:px-10 bg-secondary/40">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-[22px] font-normal text-foreground mb-2 md:text-[26px] tracking-tight">
          Why This Order
        </h2>
        <p className="text-[13px] text-muted-foreground mb-8 tracking-wide">
          Every detail considered for optimal comfort and flow
        </p>
        
        {/* Main Reasons */}
        <div className="space-y-3 mb-8">
          {flowReasons.map((reason) => {
            const isExpanded = expandedReason === reason.title
            return (
              <button
                key={reason.title}
                onClick={() => setExpandedReason(isExpanded ? null : reason.title)}
                className="w-full glass-card rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
                    <reason.icon className="h-4 w-4 text-foreground/50" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[14px] font-medium text-foreground">{reason.title}</h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5">{reason.summary}</p>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    {isExpanded && (
                      <p className="text-[13px] text-muted-foreground leading-relaxed mt-3 animate-in fade-in duration-200">
                        {reason.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        
        {/* Adjustments Section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowAdjustments(!showAdjustments)}
            className="w-full p-5 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70 mb-1">Real-World Flexibility</p>
              <h3 className="text-[14px] font-medium text-foreground">Route Adjustments</h3>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${showAdjustments ? 'rotate-180' : ''}`} />
          </button>
          
          {showAdjustments && (
            <div className="px-5 pb-5 animate-in slide-in-from-top-2 fade-in duration-200">
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
                Your guide may adjust stop order or duration based on conditions. These changes improve your comfort and experience.
              </p>
              <div className="space-y-4">
                {adjustmentFactors.map((factor) => (
                  <div key={factor.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                      <factor.icon className="h-3.5 w-3.5 text-foreground/50" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{factor.title}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{factor.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
