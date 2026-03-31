"use client"

import { useState } from "react"
import { Sun, Cloud, Wind, Snowflake, CloudRain, ChevronDown } from "lucide-react"

export function SeasonalInfo() {
  const [isExpanded, setIsExpanded] = useState(false)

  const seasons = [
    {
      name: "Spring",
      months: "Mar-May",
      icon: <Sun className="h-4 w-4" />,
      color: "text-amber-500",
      tip: "Cherry blossoms, canola flowers. Light layers."
    },
    {
      name: "Summer",
      months: "Jun-Aug",
      icon: <Cloud className="h-4 w-4" />,
      color: "text-blue-500",
      tip: "Vibrant greens. Sunscreen essential."
    },
    {
      name: "Autumn",
      months: "Sep-Nov",
      icon: <Wind className="h-4 w-4" />,
      color: "text-orange-500",
      tip: "Silver grass, clear skies. Most popular."
    },
    {
      name: "Winter",
      months: "Dec-Feb",
      icon: <Snowflake className="h-4 w-4" />,
      color: "text-cyan-500",
      tip: "Dramatic moods, fewer crowds."
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
            Seasonal Notes
          </h2>
          <p className="text-[13px] text-neutral-500 text-left">
            How conditions affect your experience
          </p>
        </div>
        <ChevronDown className={`h-5 w-5 text-neutral-400 transition-transform md:hidden ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {/* Mobile: Collapsed view */}
      <div className={`md:hidden ${isExpanded ? "block" : "hidden"}`}>
        <div className="space-y-2">
          {seasons.map((season, index) => (
            <div 
              key={index} 
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-100"
            >
              <div className={`${season.color}`}>
                {season.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-neutral-900">{season.name}</span>
                  <span className="text-[11px] text-neutral-400">{season.months}</span>
                </div>
                <p className="text-[12px] text-neutral-600 truncate">{season.tip}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: Preview when collapsed */}
      <div className={`md:hidden ${!isExpanded ? "block" : "hidden"}`}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {seasons.map((season, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-neutral-100"
            >
              <span className={season.color}>{season.icon}</span>
              <span className="text-[12px] font-medium text-neutral-700">{season.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Full grid */}
      <div className="hidden md:grid md:grid-cols-4 gap-3">
        {seasons.map((season, index) => (
          <div 
            key={index} 
            className="p-4 bg-white rounded-xl border border-neutral-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={season.color}>{season.icon}</span>
              <span className="text-sm font-semibold text-neutral-900">{season.name}</span>
            </div>
            <p className="text-[11px] text-neutral-400 mb-1">{season.months}</p>
            <p className="text-[12px] text-neutral-600 leading-relaxed">{season.tip}</p>
          </div>
        ))}
      </div>

      {/* Weather flexibility note */}
      <div className={`mt-4 flex items-start gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100 ${!isExpanded ? "hidden md:flex" : "flex"}`}>
        <CloudRain className="h-4 w-4 text-neutral-400 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-neutral-600 leading-relaxed">
          Tours operate in light rain with modified routes. Severe weather offers full rebooking.
        </p>
      </div>
    </section>
  )
}
