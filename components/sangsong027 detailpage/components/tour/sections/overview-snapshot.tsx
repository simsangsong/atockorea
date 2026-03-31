"use client"

import { 
  Footprints, 
  CloudSun, 
  Camera, 
  Compass, 
  Users, 
  TreePine 
} from "lucide-react"

export function OverviewSnapshot() {
  const snapshots = [
    {
      icon: <Camera className="h-4 w-4" />,
      label: "Photo Value",
      value: "High",
      highlight: true
    },
    {
      icon: <Compass className="h-4 w-4" />,
      label: "Scenic",
      value: "High"
    },
    {
      icon: <Footprints className="h-4 w-4" />,
      label: "Walking",
      value: "Moderate"
    },
    {
      icon: <CloudSun className="h-4 w-4" />,
      label: "Rain Safety",
      value: "Medium"
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: "Family Fit",
      value: "Good"
    },
    {
      icon: <TreePine className="h-4 w-4" />,
      label: "Balance",
      value: "Outdoor"
    }
  ]

  return (
    <section className="px-4 lg:px-6 py-6">
      <h2 className="text-base font-semibold text-neutral-900 mb-4 tracking-tight">
        At a Glance
      </h2>
      
      {/* Mobile: 3x2 compact grid */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        {snapshots.map((snapshot, index) => (
          <div 
            key={index} 
            className={`
              flex flex-col items-center justify-center py-3 px-2 rounded-xl text-center
              ${snapshot.highlight 
                ? "bg-neutral-900 text-white" 
                : "bg-neutral-50 border border-neutral-100"
              }
            `}
          >
            <div className={`mb-1.5 ${snapshot.highlight ? "text-white/80" : "text-neutral-400"}`}>
              {snapshot.icon}
            </div>
            <span className={`text-[13px] font-semibold ${snapshot.highlight ? "text-white" : "text-neutral-900"}`}>
              {snapshot.value}
            </span>
            <span className={`text-[10px] mt-0.5 ${snapshot.highlight ? "text-white/60" : "text-neutral-500"}`}>
              {snapshot.label}
            </span>
          </div>
        ))}
      </div>

      {/* Tablet/Desktop: horizontal row */}
      <div className="hidden md:flex gap-3 overflow-x-auto scrollbar-hide">
        {snapshots.map((snapshot, index) => (
          <div 
            key={index} 
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl flex-shrink-0
              ${snapshot.highlight 
                ? "bg-neutral-900 text-white" 
                : "bg-white border border-neutral-100"
              }
            `}
          >
            <div className={`
              h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0
              ${snapshot.highlight ? "bg-white/10" : "bg-neutral-100"}
            `}>
              <span className={snapshot.highlight ? "text-white" : "text-neutral-600"}>
                {snapshot.icon}
              </span>
            </div>
            <div>
              <span className={`block text-sm font-semibold ${snapshot.highlight ? "text-white" : "text-neutral-900"}`}>
                {snapshot.value}
              </span>
              <span className={`text-[11px] ${snapshot.highlight ? "text-white/60" : "text-neutral-500"}`}>
                {snapshot.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
