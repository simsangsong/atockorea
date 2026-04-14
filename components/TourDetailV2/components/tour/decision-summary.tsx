import { Camera, Mountain, Footprints, CloudRain, Users, Scale } from "lucide-react"

const items = [
  { icon: Camera,    label: "Photo Value",  value: "High"     },
  { icon: Mountain,  label: "Scenic",       value: "High"     },
  { icon: Footprints,label: "Walking",      value: "Moderate" },
  { icon: CloudRain, label: "Rain Safety",  value: "Medium"   },
  { icon: Users,     label: "Family Fit",   value: "Good"     },
  { icon: Scale,     label: "Balance",      value: "Mixed"    },
]

export function DecisionSummary() {
  return (
    <div className="space-y-5">

      {/* Section header */}
      <div>
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
          At a glance
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
          A quick read on scenery, walking comfort, and overall fit.
        </p>
      </div>

      {/* 3 × 2 grid */}
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="group flex flex-col items-center text-center rounded-2xl px-2 py-4 transition-all duration-200 hover:shadow-md"
            style={{
              background: 'rgba(250, 249, 247, 0.92)',
              border: '1px solid rgba(0, 0, 0, 0.045)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 3px 10px rgba(0,0,0,0.02)',
            }}
          >
            {/* Icon – neutral glass tint, stays small and quiet */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl mb-3 transition-transform duration-200 group-hover:scale-105"
              style={{
                background: 'rgba(0, 0, 0, 0.035)',
                border: '1px solid rgba(0, 0, 0, 0.03)',
              }}
            >
              <item.icon
                className="h-[15px] w-[15px] text-foreground/60"
                strokeWidth={1.5}
              />
            </div>

            {/* Label – large, bold, prominent — the main element */}
            <p className="text-[15px] font-semibold text-foreground tracking-tight leading-none">
              {item.label}
            </p>

            {/* Value – small, uppercase, muted — the supporting detail */}
            <p className="mt-1.5 text-[9.5px] font-semibold tracking-[0.08em] uppercase text-muted-foreground leading-none">
              {item.value}
            </p>
          </div>
        ))}
      </div>

    </div>
  )
}
