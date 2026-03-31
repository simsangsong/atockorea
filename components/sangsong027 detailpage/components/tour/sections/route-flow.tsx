"use client"

import { useState } from "react"
import { Route, Clock, Sun, Users, ChevronDown } from "lucide-react"

export function RouteFlow() {
  const [isExpanded, setIsExpanded] = useState(false)

  const reasons = [
    {
      icon: <Sun className="h-4 w-4" />,
      title: "Morning Light",
      short: "Best light at Hamdeok",
      description: "Hamdeok's emerald waters are most stunning in the soft morning light."
    },
    {
      icon: <Users className="h-4 w-4" />,
      title: "Crowd Timing",
      short: "Avoid tour buses",
      description: "We visit Seopjikoji and Seongsan when tour buses have cleared."
    },
    {
      icon: <Clock className="h-4 w-4" />,
      title: "Energy Pacing",
      short: "Active to relaxed",
      description: "Active stops early, satisfying lunch, then relaxed afternoon."
    },
    {
      icon: <Route className="h-4 w-4" />,
      title: "Efficient Flow",
      short: "No backtracking",
      description: "Natural east-coast arc minimizing travel time."
    }
  ]

  return (
    <section className="px-4 lg:px-6 py-6">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-4 md:pointer-events-none"
      >
        <div>
          <h2 className="text-base font-semibold text-neutral-900 tracking-tight text-left">
            Why This Order
          </h2>
          <p className="text-[13px] text-neutral-500 text-left">
            Every sequence choice has a reason
          </p>
        </div>
        <ChevronDown className={`h-5 w-5 text-neutral-400 transition-transform md:hidden ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {/* Mobile: Compact preview */}
      <div className={`md:hidden ${!isExpanded ? "block" : "hidden"}`}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {reasons.map((reason, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl border border-neutral-100"
            >
              <span className="text-neutral-500">{reason.icon}</span>
              <span className="text-[12px] font-medium text-neutral-700 whitespace-nowrap">{reason.short}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: Expanded */}
      <div className={`md:hidden ${isExpanded ? "block" : "hidden"}`}>
        <div className="space-y-2">
          {reasons.map((reason, index) => (
            <div key={index} className="flex gap-3 p-3 bg-white rounded-xl border border-neutral-100">
              <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                {reason.icon}
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-neutral-900">{reason.title}</h3>
                <p className="text-[12px] text-neutral-600">{reason.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Full grid */}
      <div className="hidden md:grid md:grid-cols-2 gap-3">
        {reasons.map((reason, index) => (
          <div key={index} className="flex gap-3 p-4 bg-white rounded-xl border border-neutral-100">
            <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
              {reason.icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-1">{reason.title}</h3>
              <p className="text-[13px] text-neutral-600 leading-relaxed">{reason.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
