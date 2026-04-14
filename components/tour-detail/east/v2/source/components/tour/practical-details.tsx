"use client"

import { useMemo, useState } from "react"
import { ChevronDown, CloudSun, CloudRain, Check, X, Flower2, Sun, Leaf, Snowflake } from "lucide-react"
import { TourWeatherSection } from "@/components/tour-detail-template"
import type { V0PracticalAccordionItem, V0SeasonalVariationCard } from "@/lib/tour-detail/east/adapters/v0-support-product-slice"
import { cn } from "../../lib/utils"

interface AccordionItem {
  id: string
  title: string
  preview: string
  content: string[]
}

const defaultAccordionItems: AccordionItem[] = [
  {
    id: "pickup",
    title: "Pickup & drop-off",
    preview: "Hotel lobby pickup in Jeju City area",
    content: [
      "Pickup from your hotel lobby between 08:30-09:00",
      "Return drop-off by approximately 17:30-18:00",
      "Airport pickup available on request",
      "Specific pickup time confirmed the evening before"
    ]
  },
  {
    id: "walking",
    title: "Walking & terrain",
    preview: "Moderate overall, manageable for most",
    content: [
      "Total walking: approximately 4-6 km across all stops",
      "Stone Park: mostly flat with some uneven surfaces",
      "Micheongul Cave: underground walkways, can be slippery",
      "Seongsan: optional summit climb (~20 min, steep)",
      "Comfortable walking shoes strongly recommended"
    ]
  },
  {
    id: "weather",
    title: "Weather & closure handling",
    preview: "Runs in most conditions with adjustments",
    content: [
      "Light rain: tour proceeds normally",
      "Heavy rain: cave stop prioritized, outdoor minimized",
      "Strong wind: Seopjikoji may be shortened",
      "Site closures: alternative stops provided"
    ]
  },
  {
    id: "wear",
    title: "What to wear & bring",
    preview: "Comfortable shoes, layers, light jacket",
    content: [
      "Walking shoes with good grip",
      "Layers for varying temperatures",
      "Light wind-resistant jacket",
      "Hat and sunscreen",
      "Water bottle"
    ]
  },
  {
    id: "included",
    title: "Included / not included",
    preview: "Guide, vehicle, pickup, admission fees",
    content: [
      "Professional English-speaking guide",
      "Private or small-group vehicle",
      "Hotel pickup/drop-off (Jeju City)",
      "All admission fees",
      "Bottled water",
      "Lunch (pay directly at restaurant)",
      "Personal shopping",
      "Gratuities"
    ]
  }
]

const seasons = [
  {
    name: "Spring",
    icon: Flower2,
    description: "Canola blooms paint the coast gold",
    tag: "Peak flowers",
    bgClass: "bg-spring",
    iconColor: "text-pink-500"
  },
  {
    name: "Summer",
    icon: Sun,
    description: "Extended daylight, vibrant greens",
    tag: "Longest days",
    bgClass: "bg-summer",
    iconColor: "text-sky-500"
  },
  {
    name: "Autumn",
    icon: Leaf,
    description: "Clear skies, crisp visibility",
    tag: "Best views",
    bgClass: "bg-autumn",
    iconColor: "text-amber-600"
  },
  {
    name: "Winter",
    icon: Snowflake,
    description: "Quieter paths, shorter daylight",
    tag: "Peaceful mood",
    bgClass: "bg-winter",
    iconColor: "text-slate-500"
  }
]

function seasonIconForId(id: string) {
  const k = id.toLowerCase()
  if (k === "spring" || k.includes("spring")) return Flower2
  if (k === "summer" || k.includes("summer")) return Sun
  if (k === "fall" || k === "autumn" || k.includes("fall")) return Leaf
  if (k === "winter" || k.includes("winter")) return Snowflake
  if (k.includes("rain")) return CloudRain
  return Sun
}

export function PracticalDetails({
  pickupPreview,
  importantNotice,
  guidedLanguageLine,
  practicalAccordionItems,
  practicalSectionSubtitle,
  seasonalVariations,
  weatherLatitude,
  weatherLongitude,
  weatherAreaLabel,
}: {
  pickupPreview?: string | null
  importantNotice?: string | null
  guidedLanguageLine?: string | null
  /** Live practical panels from `SmallGroupDetailContent` — when empty/missing, v0 defaults stay */
  practicalAccordionItems?: V0PracticalAccordionItem[] | null
  practicalSectionSubtitle?: string | null
  seasonalVariations?: V0SeasonalVariationCard[] | null
  weatherLatitude?: number | null
  weatherLongitude?: number | null
  weatherAreaLabel?: string | null
}) {
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const accordionItems = useMemo((): Array<
    V0PracticalAccordionItem | (typeof defaultAccordionItems)[number]
  > => {
    const live = practicalAccordionItems?.filter((i) => i.title.trim()) ?? []
    if (live.length > 0) {
      return live.map((item) => {
        if (item.id === "pickup" && pickupPreview?.trim()) {
          return { ...item, preview: pickupPreview.trim() }
        }
        return item
      })
    }
    return defaultAccordionItems.map((item) => {
      if (item.id === "pickup" && pickupPreview?.trim()) {
        return { ...item, preview: pickupPreview.trim() }
      }
      return item
    })
  }, [practicalAccordionItems, pickupPreview])

  const seasonCards = seasonalVariations?.length ? seasonalVariations : null

  const useLiveWeather =
    weatherLatitude != null &&
    weatherLongitude != null &&
    Number.isFinite(weatherLatitude) &&
    Number.isFinite(weatherLongitude)

  const toggleItem = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-7">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Practical details
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {practicalSectionSubtitle?.trim() ||
            "Pickup, walking, weather, packing, and inclusions."}
          {guidedLanguageLine?.trim() ? (
            <span className="block mt-1 text-muted-foreground/90">{guidedLanguageLine.trim()}</span>
          ) : null}
        </p>
        {importantNotice?.trim() ? (
          <p className="mt-3 text-sm text-foreground/90 leading-relaxed border-l-2 border-border pl-3">
            {importantNotice.trim()}
          </p>
        ) : null}
      </div>
      
      {/* Weather Widget - Calm, clean, premium */}
      <div className="card-premium p-4">
        {useLiveWeather ? (
          <TourWeatherSection
            appearance="v0EastPracticalEmbed"
            latitude={weatherLatitude!}
            longitude={weatherLongitude!}
            areaLabel={weatherAreaLabel ?? undefined}
            className=""
          />
        ) : (
          <>
            <p className="text-[10px] font-medium text-muted-foreground tracking-wide mb-3">
              Live weather · East Jeju region
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-3 rounded-xl bg-mist-blue/60 border border-border/40 px-3.5 py-3">
                <CloudSun className="h-8 w-8 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-xl font-semibold text-foreground leading-none">11°</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Today · Clear</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-cloud-gray/60 border border-border/40 px-3.5 py-3">
                <CloudRain className="h-8 w-8 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-xl font-semibold text-foreground leading-none">18°/13°</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Tomorrow · Drizzle</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Seasonal Variations - Route mood cards */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Seasonal variations</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            How this route feels through the year.
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-2.5">
          {seasonCards
            ? seasonCards.map((season) => {
                const Icon = seasonIconForId(season.id)
                return (
                  <div
                    key={season.id}
                    className={cn(
                      "relative rounded-xl border border-border/50 p-4 transition-all duration-200 hover:shadow-premium hover:border-border",
                      season.bgClass
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Icon className={cn("h-4.5 w-4.5", season.iconColor)} />
                      <span className="text-[9px] font-medium text-muted-foreground bg-white/70 px-1.5 py-0.5 rounded-md">
                        {season.tag}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">{season.name}</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      {season.description}
                    </p>
                  </div>
                )
              })
            : seasons.map((season) => (
                <div
                  key={season.name}
                  className={cn(
                    "relative rounded-xl border border-border/50 p-4 transition-all duration-200 hover:shadow-premium hover:border-border",
                    season.bgClass
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <season.icon className={cn("h-4.5 w-4.5", season.iconColor)} />
                    <span className="text-[9px] font-medium text-muted-foreground bg-white/70 px-1.5 py-0.5 rounded-md">
                      {season.tag}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{season.name}</h4>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    {season.description}
                  </p>
                </div>
              ))}
        </div>
      </div>
      
      {/* Accordion List - Concierge information feel */}
      <div className="card-premium overflow-hidden divide-y divide-border/60">
        {accordionItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => toggleItem(item.id)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
            >
              <div className="pr-4 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.preview}</p>
              </div>
              <div className={cn(
                "flex-shrink-0 p-1 rounded-full transition-all duration-200",
                expandedItems.includes(item.id) ? "bg-primary/10 rotate-180" : ""
              )}>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-colors",
                  expandedItems.includes(item.id) ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            </button>
            
            <div className={cn(
              "grid transition-all duration-200 ease-out",
              expandedItems.includes(item.id) ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}>
              <div className="overflow-hidden">
                <div className="px-4 pb-5">
                  {"renderMode" in item && item.renderMode === "includedSplit" ? (
                    <ul className="space-y-2.5">
                      {(item.includedLines ?? []).map((line: string, i: number) => (
                        <li key={`inc-${i}`} className="flex items-start gap-2.5 text-sm">
                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-foreground">{line}</span>
                        </li>
                      ))}
                      {(item.excludedLines ?? []).map((line: string, i: number) => (
                        <li key={`exc-${i}`} className="flex items-start gap-2.5 text-sm">
                          <X className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="space-y-2.5">
                      {("content" in item && Array.isArray(item.content) ? item.content : []).map((line: string, i: number) => {
                        if (item.id === "included") {
                          const isIncluded = i < 5
                          return (
                            <li key={i} className="flex items-start gap-2.5 text-sm">
                              {isIncluded ? (
                                <>
                                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                  <span className="text-foreground">{line}</span>
                                </>
                              ) : (
                                <>
                                  <X className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                                  <span className="text-muted-foreground">{line}</span>
                                </>
                              )}
                            </li>
                          )
                        }
                        return (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary/60 mt-2 flex-shrink-0" />
                            <span>{line}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

