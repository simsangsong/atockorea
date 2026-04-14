"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { ChevronDown, Sun, Mountain, Wind, Check, X } from "lucide-react"
import { cn } from "../../lib/utils"
import type { V2ExperienceSectionGroup, V2ExperienceShell } from "@/lib/tour-detail/v2/detail-page-v2"

const ICON_MAP: Record<V2ExperienceSectionGroup["icon"], LucideIcon> = {
  Sun,
  Mountain,
  Wind,
}

const DEFAULT_BEST_FOR = [
  "First-time visitors, couples",
  "Adult families",
  "Travelers who like context",
  "Active seniors",
]

const DEFAULT_LESS_IDEAL = ["Avoiding stairs or caves", "Stroller-heavy groups", "Very young children"]

const DEFAULT_FAMILY_NOTE =
  "Families: Good for ages 8+; younger children possible but the crater climb makes it better for older kids. Seniors: Comfortable when Seongsan uses the lighter coastal option."

const DEFAULT_ROUTE_LOGIC_SECTIONS: V2ExperienceSectionGroup[] = [
  {
    title: "Pacing & structure",
    icon: "Sun",
    iconBg: "bg-amber-50/80",
    iconColor: "text-amber-600",
    items: [
      {
        label: "Stone First, Before the Coast",
        detail: "Stone Park frames Jeju first, before the route opens into wider sea views.",
      },
      {
        label: "Lunch at Midday, Right on Time",
        detail: "The route reaches lunch at noon, creating a clean reset before the main Seongsan stop.",
      },
      {
        label: "Main Highlight After Lunch",
        detail:
          "Seongsan sits right after lunch so the most active part of the day lands with better energy and a clearer rhythm.",
      },
    ],
  },
  {
    title: "Route build",
    icon: "Mountain",
    iconBg: "bg-sky-50/80",
    iconColor: "text-sky-600",
    items: [
      {
        label: "Coast Before Crater",
        detail: "Seopjikoji opens the sea mood first, then Seongsan carries the strongest volcanic highlight.",
      },
      {
        label: "Garden After the Peak",
        detail: "Ilchulland works as a softer lava-tube-and-garden transition after Seongsan.",
      },
      {
        label: "Village at the End",
        detail: "Seongeup closes the day with lived culture and local texture after the scenic highlights.",
      },
    ],
  },
  {
    title: "When conditions shift",
    icon: "Wind",
    iconBg: "bg-slate-50/80",
    iconColor: "text-slate-600",
    items: [
      { label: "No Monday Departures", detail: "This route does not operate on Mondays." },
      {
        label: "Weather & Wind",
        detail: "Seopjikoji and Seongsan are the most weather-sensitive parts of the day.",
      },
      {
        label: "Walking Balance",
        detail: "Seongsan pacing can be adjusted depending on group energy, weather, and on-site conditions.",
      },
    ],
  },
]

export const DEFAULT_EXPERIENCE_SHELL: V2ExperienceShell = {
  title: "Why this tour works",
  subtitle: "Who this cadence suits and how the day is sequenced.",
  bestFor: DEFAULT_BEST_FOR,
  lessIdealFor: DEFAULT_LESS_IDEAL,
  familyNote: DEFAULT_FAMILY_NOTE,
  routeLogicLabel: "Route logic",
  routeLogicHint: "Pacing, sequence, stop timing, and why the day flows this way",
  routeLogicSections: DEFAULT_ROUTE_LOGIC_SECTIONS,
}

export function ExperienceSection({ data }: { data?: V2ExperienceShell | null }) {
  const [showLogic, setShowLogic] = useState(false)

  const title = data?.title?.trim() || DEFAULT_EXPERIENCE_SHELL.title!
  const subtitle = data?.subtitle?.trim() || DEFAULT_EXPERIENCE_SHELL.subtitle!
  const bestFor = data?.bestFor?.length ? data.bestFor : DEFAULT_BEST_FOR
  const lessIdealFor = data?.lessIdealFor?.length ? data.lessIdealFor : DEFAULT_LESS_IDEAL
  const familyNote = data?.familyNote?.trim() || DEFAULT_FAMILY_NOTE
  const routeLogicLabel = data?.routeLogicLabel?.trim() || DEFAULT_EXPERIENCE_SHELL.routeLogicLabel!
  const routeLogicHint = data?.routeLogicHint?.trim() || DEFAULT_EXPERIENCE_SHELL.routeLogicHint!
  const routeLogicSections =
    data?.routeLogicSections && data.routeLogicSections.length > 0
      ? data.routeLogicSections
      : DEFAULT_ROUTE_LOGIC_SECTIONS

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
      </div>

      <div className="card-premium p-5 space-y-5">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-foreground tracking-wide mb-3">Best for</h3>
            <ul className="space-y-2">
              {bestFor.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                  <div className="mt-0.5 flex-shrink-0 h-4 w-4 rounded-full bg-emerald-50/80 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-emerald-600" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-foreground tracking-wide mb-3">Less ideal for</h3>
            <ul className="space-y-2">
              {lessIdealFor.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <div className="mt-0.5 flex-shrink-0 h-4 w-4 rounded-full bg-slate-50/80 flex items-center justify-center">
                    <X className="h-2.5 w-2.5 text-slate-400" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-4 border-t border-border/60">
          <p className="text-sm text-muted-foreground leading-relaxed">{familyNote}</p>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLogic(!showLogic)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/20 transition-colors"
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">{routeLogicLabel}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{routeLogicHint}</p>
          </div>
          <div
            className={cn(
              "flex-shrink-0 p-1.5 rounded-full transition-all duration-200",
              showLogic ? "bg-primary/10 rotate-180" : "bg-muted/60"
            )}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-colors", showLogic ? "text-primary" : "text-muted-foreground")}
            />
          </div>
        </button>

        <div className={cn("grid transition-all duration-300 ease-out", showLogic ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="border-t border-border/60 p-5 space-y-5">
              {routeLogicSections.map((section) => {
                const Icon = ICON_MAP[section.icon] ?? Sun
                return (
                  <div key={section.title}>
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", section.iconBg)}>
                        <Icon className={cn("h-3.5 w-3.5", section.iconColor)} />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                    </div>
                    <div className="space-y-2.5 pl-10">
                      {section.items.map((item, i) => (
                        <div key={i}>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
