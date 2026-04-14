"use client"

import { useState } from "react"
import { Clock, ChevronDown, Camera, Lightbulb, Ticket, Bath, Car, Footprints } from "lucide-react"
import { cn } from "../../lib/utils"

export interface Stop {
  number: number
  time: string
  duration: string
  name: string
  category: string
  description: string
  image: string
  highlights: string[]
  whyOnRoute: string
  timeUsed: string[]
  visitBasics: {
    hours: string
    closed: string
    admission: string
    walking: string
  }
  convenience: {
    restroom: string
    parking: string
  }
  smartNotes: {
    photo: string
    facilities: string
    tip: string
  }
}

const DEFAULT_STOPS: Stop[] = [
  {
    number: 1,
    time: "09:00",
    duration: "60 min",
    name: "Jeju Stone Park",
    category: "Geology & Stone Culture",
    description: "This is where the day begins to make sense. Stone Park gives the group a clear introduction to Jeju's volcanic identity before the route opens into coast, crater, cave, and village landscapes.",
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80",
    highlights: [
      "Stone figures, towers, and wide open grounds",
      "Strong introduction to Jeju's stone culture",
      "Clean photo zones with broad visual spacing",
      "Indoor museum elements that deepen the geology story"
    ],
    timeUsed: [
      "Short orientation walk through the main stone zone",
      "Photo and explanation time around the open stone fields",
      "Museum section or closing interpretation before departure"
    ],
    whyOnRoute: "Starting here gives the later coastal, crater, and lava-tube stops a clearer frame.",
    visitBasics: {
      hours: "09:00-18:00",
      closed: "Mondays",
      admission: "Adults 5,000 / Teens 3,500 KRW",
      walking: "Easy to moderate"
    },
    convenience: {
      restroom: "Entrance and museum area",
      parking: "Available"
    },
    smartNotes: {
      photo: "Wide compositions work better here than tight close-ups.",
      facilities: "Cleanest restroom and museum support in early route.",
      tip: "This stop works best as a calm opener, not a rushed photo stop."
    }
  },
  {
    number: 2,
    time: "10:40",
    duration: "60 min",
    name: "Seopjikoji",
    category: "Open Ridge Coastline",
    description: "After Stone Park, the route opens outward. Seopjikoji brings in sea wind, ridge views, and open coastline before the day moves into lunch and the main Seongsan highlight.",
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",
    highlights: [
      "Open ridge coastline and sea-facing paths",
      "Seasonal flower fields depending on time of year",
      "Lighthouse viewpoint and broad ocean framing",
      "A lighter scenic stop with strong visual contrast to Stone Park"
    ],
    timeUsed: [
      "Arrival and short route choice at the entrance area",
      "Main ridge walk with open coastal views",
      "Photo stop and return with a relaxed pace"
    ],
    whyOnRoute: "Seopjikoji opens the sea mood early, so Seongsan can land later as the stronger volcanic highlight.",
    visitBasics: {
      hours: "Open 24 hours",
      closed: "None",
      admission: "Free (parking fee)",
      walking: "Easy to moderate"
    },
    convenience: {
      restroom: "Entrance area",
      parking: "Paid parking"
    },
    smartNotes: {
      photo: "Wind and open sky make side-angle shots better than front-facing still poses.",
      facilities: "Limited facilities?봱estrooms at entrance.",
      tip: "This stop is more exposed than the earlier stop, so wind and sun matter more here."
    }
  },
  {
    number: 3,
    time: "12:00",
    duration: "60 min",
    name: "Lunch",
    category: "Midday Reset",
    description: "Lunch sits in the middle of the route as a true reset, not just a break. It creates clean pacing before the day's main activity at Seongsan Ilchulbong.",
    image: "https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=800&q=80",
    highlights: [
      "Midday energy reset before the most active stop",
      "Natural pause between coastal walking and crater activity",
      "Better pacing for mixed-age groups",
      "Cleaner rhythm for the second half of the day"
    ],
    timeUsed: [
      "Arrival and seating",
      "Meal and short rest",
      "Departure preparation for Seongsan"
    ],
    whyOnRoute: "Placing lunch here keeps the Seongsan stop more comfortable and less rushed.",
    visitBasics: {
      hours: "Restaurant hours",
      closed: "Varies",
      admission: "Included or 횪 la carte",
      walking: "Minimal"
    },
    convenience: {
      restroom: "Restaurant facilities",
      parking: "Available"
    },
    smartNotes: {
      photo: "Focus on local dishes if interested in food photography.",
      facilities: "Full restaurant amenities.",
      tip: "Midday pacing matters more than speed here; a clean lunch stop improves the whole second half."
    }
  },
  {
    number: 4,
    time: "13:15",
    duration: "90 min",
    name: "Seongsan Ilchulbong",
    category: "Crater Walk & Haenyeo Show",
    description: "This is the main volcanic highlight of the day. Seongsan brings together crater scenery, coastal scale, and?봡epending on timing?봳he haenyeo show context that makes the stop feel even more distinctly Jeju.",
    image: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=80",
    highlights: [
      "UNESCO-listed volcanic crater landscape",
      "Strong panoramic views around the base and upper routes",
      "Iconic coastal geology and steep formation lines",
      "Haenyeo show context adds local cultural meaning to the stop"
    ],
    timeUsed: [
      "Arrival, orientation, and entry area setup",
      "Main walking segment, with route adjusted by group pace",
      "Crater / base viewing and haenyeo show timing if available"
    ],
    whyOnRoute: "After lunch, Seongsan becomes the natural main event of the day?봞ctive, scenic, and culturally distinct.",
    visitBasics: {
      hours: "07:00-20:00 (summer) / 07:30-19:00 (winter)",
      closed: "Open year-round",
      admission: "Adults 5,000 / Teens 2,500 KRW",
      walking: "Challenging if summit"
    },
    convenience: {
      restroom: "Base and near summit",
      parking: "Large area available"
    },
    smartNotes: {
      photo: "Wider crater and coastline compositions usually work better than tight summit-only shots.",
      facilities: "Good facilities at base, basic near summit.",
      tip: "Group pace, weather, and crowd conditions can affect whether the stop leans more toward walking, viewing, or show timing."
    }
  },
  {
    number: 5,
    time: "15:00",
    duration: "55 min",
    name: "Ilchulland",
    category: "Lava Tube Garden",
    description: "After Seongsan, Ilchulland softens the day's rhythm. The lava-tube-and-garden setting feels cooler, calmer, and more enclosed after the open crater and coast.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    highlights: [
      "Lava-tube atmosphere within a more controlled garden setting",
      "Visual contrast after the exposed Seongsan stop",
      "Shaded pathways and softer pacing",
      "Good transition from major highlight to late-day flow"
    ],
    timeUsed: [
      "Garden entry and route orientation",
      "Main lava-tube or interior-themed exploration",
      "Short garden finish and regroup before departure"
    ],
    whyOnRoute: "Ilchulland works best here as a softer post-Seongsan transition, not as the day's main geological opener.",
    visitBasics: {
      hours: "09:00-18:00",
      closed: "Varies",
      admission: "Adults 4,000 / Teens 2,000 KRW",
      walking: "Moderate"
    },
    convenience: {
      restroom: "At entrance",
      parking: "Available"
    },
    smartNotes: {
      photo: "Mixed indoor-outdoor lighting can create strong mood shots if exposure is kept balanced.",
      facilities: "Basic facilities at entrance.",
      tip: "This stop feels easier after Seongsan because the pace is more contained and shaded."
    }
  },
  {
    number: 6,
    time: "16:20",
    duration: "40 min",
    name: "Seongeup Folk Village",
    category: "Village Texture",
    description: "Seongeup closes the day with lived culture rather than another major scenic push. After stone, coast, crater, and cave-garden textures, the village adds human scale and historical atmosphere.",
    image: "https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=800&q=80",
    highlights: [
      "Traditional thatched-roof homes and stone walls",
      "A village setting that feels cultural rather than purely scenic",
      "Local texture, heritage atmosphere, and slower walking rhythm",
      "A strong closing contrast to the earlier natural landmarks"
    ],
    timeUsed: [
      "Village arrival and short orientation",
      "Walk through the main village paths and architectural points",
      "Closing explanation and light browsing before departure"
    ],
    whyOnRoute: "Ending here gives the day a more grounded finish after the stronger natural highlights.",
    visitBasics: {
      hours: "Open daylight hours",
      closed: "None",
      admission: "Free",
      walking: "Easy, mostly flat"
    },
    convenience: {
      restroom: "Village center",
      parking: "Nearby"
    },
    smartNotes: {
      photo: "Narrow paths, rooflines, and wall textures usually work better than broad center-framed shots.",
      facilities: "Basic village facilities.",
      tip: "This stop closes the route best when kept focused and unhurried."
    }
  }
]

function StopCard({
  stop,
  isExpanded,
  onToggle,
  totalStops,
}: {
  stop: Stop
  isExpanded: boolean
  onToggle: () => void
  totalStops: number
}) {
  return (
    <div className="relative pl-12">
      {/* Timeline line - more elegant */}
      {stop.number < totalStops && (
        <div className="absolute left-[19px] top-[52px] bottom-0 w-px bg-gradient-to-b from-border to-transparent" />
      )}
      
      {/* Stop number circle - luxurious, deliberate */}
      <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-white text-sm font-semibold shadow-lg ring-[3px] ring-white">
        {String(stop.number).padStart(2, '0')}
      </div>
      
      <div className="pb-5">
        {/* Collapsed Summary - Level 2 card */}
        <button
          onClick={onToggle}
          className={cn(
            "w-full text-left rounded-xl bg-white border border-border p-4 transition-all duration-200",
            isExpanded 
              ? "rounded-b-none border-b-transparent shadow-none" 
              : "shadow-premium hover:shadow-premium-elevated hover:border-primary/10"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{stop.time}</span>
                <span className="text-border">쨌</span>
                <span>{stop.duration}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-foreground tracking-tight">{stop.name}</h3>
              <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted/80 rounded-md">
                {stop.category}
              </span>
            </div>
            <div className={cn(
              "flex-shrink-0 mt-1 p-1.5 rounded-full transition-all duration-200",
              isExpanded ? "bg-primary/10 rotate-180" : "bg-muted/60"
            )}>
              <ChevronDown className={cn(
                "h-4 w-4 transition-colors",
                isExpanded ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
          </div>
        </button>
        
        {/* Expanded Content - Curated field note feel */}
        <div className={cn(
          "grid transition-all duration-300 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}>
          <div className="overflow-hidden">
            <div className="rounded-b-xl border border-t-0 border-border bg-white shadow-premium">
              {/* Image - Premium crop and overlay */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={stop.image}
                  alt={stop.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/35 via-[#1A2332]/5 to-transparent" />
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground shadow-md">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {stop.duration}
                </div>
              </div>
              
              <div className="p-5 space-y-6">
                {/* Introduction */}
                <p className="text-sm text-foreground leading-relaxed">{stop.description}</p>
                
                {/* Highlights - Properly designed content block */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground tracking-wide mb-3">Highlights</h4>
                  <ul className="grid grid-cols-1 gap-2">
                    {stop.highlights.map((highlight, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* How Time is Used - Elegant sub-layout */}
                <div className="rounded-xl bg-mist-blue/70 border border-border/40 p-4">
                  <h4 className="text-xs font-semibold text-foreground tracking-wide mb-3">How the time is used</h4>
                  <div className="flex items-start gap-2">
                    {stop.timeUsed.map((step, i) => (
                      <div key={i} className="flex-1 text-center">
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-white text-primary text-[11px] font-semibold flex items-center justify-center shadow-sm border border-border/50">
                          {i + 1}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Why This Stop - Premium smart note */}
                <div className="flex items-start gap-3 rounded-xl bg-sand-blush/80 border border-accent/15 px-4 py-3.5">
                  <Lightbulb className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed">{stop.whyOnRoute}</p>
                </div>
                
                {/* Grouped Logistics - Better scan */}
                <div className="border-t border-border/80 pt-5 space-y-4">
                  {/* Visit Basics */}
                  <div>
                    <h4 className="text-xs font-semibold text-foreground tracking-wide mb-3">Visit basics</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-muted-foreground">Hours</p>
                          <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.hours}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Ticket className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-muted-foreground">Admission</p>
                          <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.admission}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Footprints className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-muted-foreground">Walking</p>
                          <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.walking}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 text-center text-[10px] font-bold">X</div>
                        <div>
                          <p className="text-muted-foreground">Closed</p>
                          <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.closed}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Convenience */}
                  <div className="flex gap-5 text-xs border-t border-border/60 pt-4">
                    <div className="flex items-center gap-2">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{stop.convenience.restroom}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{stop.convenience.parking}</span>
                    </div>
                  </div>
                </div>
                
                {/* Smart Notes - Useful and premium */}
                <div className="border-t border-border/80 pt-5 space-y-3">
                  <h4 className="text-xs font-semibold text-foreground tracking-wide">Smart notes</h4>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Camera className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Photo:</span> {stop.smartNotes.photo}</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Lightbulb className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Tip:</span> {stop.smartNotes.tip}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ItinerarySection({ stops: stopsProp }: { stops?: Stop[] | null }) {
  const [expandedStop, setExpandedStop] = useState<number | null>(null)

  const stopsList =
    stopsProp && stopsProp.length > 0
      ? stopsProp.map((s, i) => ({ ...s, number: i + 1 }))
      : DEFAULT_STOPS

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Your Day, Stop by Stop
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          Each stop builds naturally into the next. Expand any for full detail.
        </p>
      </div>
      
      <div>
        {stopsList.map((stop) => (
          <StopCard
            key={stop.number}
            stop={stop}
            totalStops={stopsList.length}
            isExpanded={expandedStop === stop.number}
            onToggle={() => setExpandedStop(expandedStop === stop.number ? null : stop.number)}
          />
        ))}
      </div>
    </div>
  )
}

