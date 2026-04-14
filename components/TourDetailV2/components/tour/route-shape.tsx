"use client"

import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const stops = [
  { id: "01", name: "Stone Park", theme: "Geology" },
  { id: "02", name: "Seopjikoji", theme: "Coast" },
  { id: "03", name: "Lunch", theme: "Reset" },
  { id: "04", name: "Seongsan", theme: "Crater" },
  { id: "05", name: "Ilchulland", theme: "Garden" },
  { id: "06", name: "Village", theme: "Culture" },
]

const phases = [
  { 
    label: "Morning", 
    range: "1-2", 
    theme: "Stone to coast", 
    bgClass: "bg-sky-50/70",
    textClass: "text-sky-700",
    dotClass: "bg-sky-500"
  },
  { 
    label: "Midday", 
    range: "3-4", 
    theme: "Lunch & Crater", 
    bgClass: "bg-amber-50/70",
    textClass: "text-amber-700",
    dotClass: "bg-amber-500"
  },
  { 
    label: "Finish", 
    range: "5-6", 
    theme: "Garden & Village", 
    bgClass: "bg-emerald-50/70",
    textClass: "text-emerald-700",
    dotClass: "bg-emerald-500"
  },
]

export function RouteShape() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          How this day moves
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          Stone to coast, lunch, then crater to village. 09:00 to 17:00.
        </p>
      </div>
      
      {/* Stop Flow - Elegant horizontal display */}
      <div className="card-premium p-4 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-0.5 min-w-max">
          {stops.map((stop, i) => (
            <div key={stop.id} className="flex items-center gap-0.5">
              <div className="flex flex-col items-center px-2">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-white text-xs font-semibold shadow-md ring-2 ring-white">
                  {stop.id}
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-foreground whitespace-nowrap">{stop.name}</span>
                <span className="text-[10px] text-muted-foreground">{stop.theme}</span>
              </div>
              {i < stops.length - 1 && (
                <div className="flex items-center px-1 mt-[-20px]">
                  <div className="w-4 h-px bg-border" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Phase Summary - Editorial timing markers */}
      <div className="grid grid-cols-3 gap-2.5 mt-1">
        {phases.map((phase) => (
          <div 
            key={phase.label} 
            className={cn(
              "rounded-xl px-3 py-4 text-center border border-transparent transition-all duration-200 hover:shadow-premium hover:border-border/50",
              phase.bgClass
            )}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", phase.dotClass)} />
              <p className={cn("text-[10px] font-semibold tracking-wide", phase.textClass)}>
                {phase.label}
              </p>
            </div>
            <p className="text-xs font-medium text-foreground">Stops {phase.range}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{phase.theme}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
