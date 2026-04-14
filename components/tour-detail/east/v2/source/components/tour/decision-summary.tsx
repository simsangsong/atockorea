import { Camera, Mountain, Footprints, CloudRain, Users, Scale, type LucideIcon } from "lucide-react"
import type { V0CoreDecisionCell } from "@/lib/tour-detail/east/adapters/to-v0-core-product-view"

const ICON_BY_LABEL: Record<string, LucideIcon> = {
  "Photo Value": Camera,
  Scenic: Mountain,
  Walking: Footprints,
  "Rain Safety": CloudRain,
  "Family Fit": Users,
  Balance: Scale,
}

// Primary items get subtle visual prominence (v0 default copy)
const defaultPrimaryItems = [
  { icon: Camera, label: "Photo Value", value: "High" },
  { icon: Mountain, label: "Scenic", value: "High" },
]

const defaultSecondaryItems = [
  { icon: Footprints, label: "Walking", value: "Moderate" },
  { icon: CloudRain, label: "Rain Safety", value: "Medium" },
  { icon: Users, label: "Family Fit", value: "Good" },
  { icon: Scale, label: "Balance", value: "Mixed" },
]

function iconFor(cell: V0CoreDecisionCell): LucideIcon {
  return ICON_BY_LABEL[cell.label] ?? Camera
}

/** Snapshot copy can be long prose; cards show a short uppercase badge (text before an em dash, etc.). */
function compactValueForBadge(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  const head = t.split(/\s*[—–]\s*/)[0]?.trim() ?? t
  const head2 = head.split(/\s*-\s+/)[0]?.trim() ?? head
  const short = head2.length > 28 ? (head2.split(/\s+/)[0] ?? head2) : head2
  return short.toUpperCase()
}

export function DecisionSummary({ cells }: { cells?: V0CoreDecisionCell[] | null }) {
  const primaryFromData = cells?.filter((c) => c.tier === "primary") ?? []
  const secondaryFromData = cells?.filter((c) => c.tier === "secondary") ?? []

  const primaryItems =
    primaryFromData.length >= 2
      ? primaryFromData.slice(0, 2).map((c) => ({ icon: iconFor(c), label: c.label, value: c.value }))
      : defaultPrimaryItems.map((item) => {
          const match = primaryFromData.find((c) => c.label === item.label)
          return match ? { ...item, value: match.value } : item
        })

  const secondaryItems =
    secondaryFromData.length >= 4
      ? secondaryFromData.slice(0, 4).map((c) => ({ icon: iconFor(c), label: c.label, value: c.value }))
      : defaultSecondaryItems.map((item) => {
          const match = secondaryFromData.find((c) => c.label === item.label)
          return match ? { ...item, value: match.value } : item
        })

  const gridItems = [...primaryItems, ...secondaryItems]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">At a glance</h2>
        <p className="mt-1 text-sm text-slate-500">
          A quick read on scenery, walking comfort, and overall fit.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {gridItems.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center rounded-3xl border border-slate-100 bg-white p-4 text-center shadow-sm sm:p-5"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 sm:mb-4">
              <item.icon className="h-5 w-5 text-slate-500" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mb-1 text-sm font-semibold leading-snug text-slate-900 sm:text-base">{item.label}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">
              {compactValueForBadge(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
