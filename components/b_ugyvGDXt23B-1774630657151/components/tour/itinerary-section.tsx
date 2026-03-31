"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, Camera, Clock, MapPin, Car } from "lucide-react"
import { cn } from "@/lib/utils"

const itineraryStops = [
  {
    id: 1,
    name: "해동 용궁사",
    nameEn: "Haedong Yonggungsa Temple",
    duration: "45-60 min",
    image: "https://images.unsplash.com/photo-1548115184-bc6544d06a58?w=400&h=300&fit=crop",
    highlight: "Temple perched on oceanside cliffs with stunning sunrise views",
    details: "One of Korea's most beautiful seaside temples. Walk through the traditional gate and descend the 108 steps to the main temple complex. Don't miss the golden Buddha statue overlooking the sea.",
    photoSpot: true,
    travelTime: null
  },
  {
    id: 2,
    name: "해운대 해변",
    nameEn: "Haeundae Beach",
    duration: "30-45 min",
    image: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=400&h=300&fit=crop",
    highlight: "Korea's most famous beach with a vibrant boardwalk",
    details: "Stroll along the crescent-shaped beach and enjoy the coastal atmosphere. Visit the interactive street art installations and take photos with the iconic skyline backdrop.",
    photoSpot: true,
    travelTime: "20 min"
  },
  {
    id: 3,
    name: "감천 문화마을",
    nameEn: "Gamcheon Culture Village",
    duration: "60-90 min",
    image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&h=300&fit=crop",
    highlight: "Colorful hillside village known as 'Machu Picchu of Korea'",
    details: "Wander through narrow alleyways adorned with murals and art installations. Find the famous Little Prince statue and enjoy panoramic views of the pastel-colored houses cascading down the hillside.",
    photoSpot: true,
    travelTime: "25 min"
  },
  {
    id: 4,
    name: "자갈치 시장",
    nameEn: "Jagalchi Fish Market",
    duration: "45-60 min",
    image: "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=400&h=300&fit=crop",
    highlight: "Korea's largest seafood market with fresh catches daily",
    details: "Experience the bustling atmosphere of Korea's largest fish market. Watch local vendors prepare fresh seafood and optionally enjoy a lunch of raw fish (sashimi) or grilled shellfish.",
    photoSpot: false,
    travelTime: "15 min"
  },
  {
    id: 5,
    name: "광안리 해변",
    nameEn: "Gwangalli Beach & Diamond Bridge",
    duration: "30-45 min",
    image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400&h=300&fit=crop",
    highlight: "Scenic beach with views of the illuminated Diamond Bridge",
    details: "Perfect spot for afternoon relaxation or evening views. The Diamond Bridge is especially spectacular when lit up at night, creating a perfect ending to your Busan tour.",
    photoSpot: true,
    travelTime: "10 min"
  }
]

export function ItinerarySection() {
  const [expandedId, setExpandedId] = useState<number | null>(1)

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <section className="px-5 md:px-8 lg:px-0 py-12 md:py-16">
      <div className="max-w-4xl mx-auto lg:mx-0">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-accent" />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">Itinerary</span>
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-2">
          Your journey through Busan
        </h2>
        <p className="text-sm text-muted-foreground mb-10">
          Tap each stop to explore details and tips
        </p>

        {/* Premium Timeline */}
        <div className="relative">
          {/* Vertical timeline line - blue gradient */}
          <div className="absolute left-5 md:left-6 top-6 bottom-6 w-px bg-gradient-to-b from-accent/60 via-accent/30 to-border/30" />

          <div className="space-y-3">
            {itineraryStops.map((stop) => (
              <div key={stop.id}>
                {/* Travel time indicator */}
                {stop.travelTime && (
                  <div className="flex items-center gap-3 py-2 pl-3 md:pl-4">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white border border-border/60 flex items-center justify-center shadow-sm">
                      <Car className="w-2 h-2 md:w-2.5 md:h-2.5 text-muted-foreground" />
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium">{stop.travelTime} drive</span>
                  </div>
                )}

                {/* Stop card - Glass effect */}
                <div 
                  className={cn(
                    "relative rounded-2xl overflow-hidden transition-all duration-300",
                    expandedId === stop.id 
                      ? "glass-card shadow-lg" 
                      : "glass-card-subtle hover:shadow-md"
                  )}
                >
                  {/* Stop number badge */}
                  <div className="absolute left-3 md:left-4 top-4 w-7 h-7 md:w-8 md:h-8 rounded-full bg-white border-2 border-accent/50 flex items-center justify-center z-10 shadow-sm">
                    <span className="text-xs md:text-sm font-bold text-accent">{stop.id}</span>
                  </div>

                  {/* Main content */}
                  <button
                    onClick={() => toggleExpand(stop.id)}
                    className="w-full flex items-start gap-3 p-4 pl-13 md:pl-14 text-left"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-18 h-18 md:w-22 md:h-22 rounded-xl overflow-hidden flex-shrink-0 shadow-md border border-white/50">
                      <Image
                        src={stop.image}
                        alt={stop.name}
                        fill
                        className="object-cover"
                      />
                      {stop.photoSpot && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent/90 flex items-center justify-center shadow-sm">
                          <Camera className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground leading-tight mb-0.5">
                            {stop.name}
                          </h3>
                          <p className="text-[11px] text-muted-foreground mb-2">
                            {stop.nameEn}
                          </p>
                        </div>
                        <ChevronDown 
                          className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform duration-300 flex-shrink-0 mt-0.5",
                            expandedId === stop.id && "rotate-180"
                          )}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">
                        {stop.highlight}
                      </p>

                      {/* Duration chip */}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-muted/80 to-muted/60 text-[10px] font-medium text-muted-foreground border border-border/30">
                        <Clock className="w-3 h-3" />
                        {stop.duration}
                      </span>
                    </div>
                  </button>

                  {/* Expanded details */}
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300",
                      expandedId === stop.id ? "max-h-52" : "max-h-0"
                    )}
                  >
                    <div className="px-4 pb-4 pl-13 md:pl-14">
                      <div className="pt-3 border-t border-border/30">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {stop.details}
                        </p>
                        {stop.photoSpot && (
                          <div className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-accent/8 to-accent/4 border border-accent/15">
                            <Camera className="w-3.5 h-3.5 text-accent" />
                            <span className="text-[11px] font-medium text-accent">Best photo opportunity</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Route summary - Glass card */}
        <div className="mt-8 p-5 rounded-2xl glass-card-subtle">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Flexible timing:</span> The order may be adjusted based on traffic and your preferences. Total driving time is approximately 1.5 hours spread throughout the day.
          </p>
        </div>
      </div>
    </section>
  )
}
