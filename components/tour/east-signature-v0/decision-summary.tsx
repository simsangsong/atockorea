import { Camera, Mountain, Footprints, CloudRain, Users, Scale } from "lucide-react"
import { cn } from "@/lib/utils"

// Primary items get subtle visual prominence
const primaryItems = [
  { icon: Camera, label: "Photo Value", value: "High" },
  { icon: Mountain, label: "Scenic", value: "High" },
]

// Secondary items are quieter
const secondaryItems = [
  { icon: Footprints, label: "Walking", value: "Moderate" },
  { icon: CloudRain, label: "Rain Safety", value: "Medium" },
  { icon: Users, label: "Family Fit", value: "Good" },
  { icon: Scale, label: "Balance", value: "Mixed" },
]

export function DecisionSummary() {
  return (
    <div className="space-y-5">
      {/* Section Header - concise, editorial */}
      <div>
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
          At a glance
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          A quick read on scenery, walking comfort, and overall fit.
        </p>
      </div>
      
      {/* 2-column grid with subtle hierarchy */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Primary row - Photo Value & Scenic get slightly more presence */}
        {primaryItems.map((item) => (
          <div
            key={item.label}
            className="group flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 hover:shadow-md"
            style={{
              background: 'rgba(250, 249, 247, 0.9)',
              border: '1px solid rgba(0, 0, 0, 0.04)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.02)',
            }}
          >
            {/* Refined icon - subtle neutral glass tint */}
            <div 
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
              style={{
                background: 'rgba(0, 0, 0, 0.03)',
                border: '1px solid rgba(0, 0, 0, 0.03)',
              }}
            >
              <item.icon className="h-[18px] w-[18px] text-foreground/70" strokeWidth={1.5} />
            </div>
            {/* Value-first typography */}
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground tracking-tight">
                {item.value}
              </p>
              <p className="text-[12px] font-medium text-muted-foreground mt-0.5">
                {item.label}
              </p>
            </div>
          </div>
        ))}
        
        {/* Secondary row - quieter presence */}
        {secondaryItems.map((item) => (
          <div
            key={item.label}
            className="group flex items-center gap-2.5 rounded-2xl px-3.5 py-3 transition-all duration-200 hover:shadow-md"
            style={{
              background: 'rgba(252, 251, 250, 0.85)',
              border: '1px solid rgba(0, 0, 0, 0.03)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02), 0 2px 8px rgba(0, 0, 0, 0.015)',
            }}
          >
            {/* Smaller, more restrained icon */}
            <div 
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
              style={{
                background: 'rgba(0, 0, 0, 0.025)',
              }}
            >
              <item.icon className="h-3.5 w-3.5 text-foreground/55" strokeWidth={1.5} />
            </div>
            {/* Value-first, quieter */}
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground/90 tracking-tight">
                {item.value}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
