"use client"

import { TimelineStop } from "../timeline-stop"
import { Info } from "lucide-react"

export function RouteTimeline() {
  const stops = [
    {
      number: 1,
      title: "Hamdeok Beach",
      subtitle: "Emerald Waters",
      duration: "45 min",
      description: "Start your day with Jeju's most photogenic beach. Crystal-clear emerald waters meet volcanic rock formations.",
      highlights: ["Iconic coastline", "Cafe option", "Photo spot"],
      imageSrc: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80",
      type: "scenic" as const
    },
    {
      number: 2,
      title: "Seongeup Folk Village",
      subtitle: "Living Heritage",
      duration: "50 min",
      description: "A genuine traditional village where Jeju's heritage lives on. Walk through stone-walled paths and meet local artisans.",
      highlights: ["Cultural immersion", "Local honey", "Stone walls"],
      imageSrc: "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=600&q=80",
      type: "cultural" as const
    },
    {
      number: 3,
      title: "Local Lunch",
      subtitle: "Curated Restaurant",
      duration: "60 min",
      description: "Enjoy authentic Jeju cuisine at a carefully selected local restaurant. Options include black pork or fresh seafood.",
      highlights: ["Black pork", "Fresh seafood", "Local flavors"],
      imageSrc: "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80",
      type: "dining" as const
    },
    {
      number: 4,
      title: "Seopjikoji",
      subtitle: "Dramatic Coastline",
      duration: "50 min",
      description: "Walk along dramatic coastal cliffs where land meets sea. Featured in Korean films and dramas.",
      highlights: ["Cliff walk", "Drama filming", "Ocean views"],
      imageSrc: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=600&q=80",
      type: "photo" as const
    },
    {
      number: 5,
      title: "Seongsan Viewpoint",
      subtitle: "Sunrise Peak View",
      duration: "40 min",
      description: "Marvel at Seongsan Ilchulbong, a UNESCO World Heritage site, from the best vantage point. No climbing required.",
      highlights: ["UNESCO site", "Crater view", "Easy access"],
      imageSrc: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80",
      type: "scenic" as const
    },
    {
      number: 6,
      title: "Jeju Stone Park",
      subtitle: "Peaceful Finale",
      duration: "45 min",
      description: "End your day at this contemplative park celebrating Jeju's volcanic stone heritage. A calming finish.",
      highlights: ["Stone art", "Gardens", "Relaxing"],
      imageSrc: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=600&q=80",
      type: "cultural" as const,
      isLast: true
    }
  ]

  return (
    <section className="px-4 lg:px-6 py-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-neutral-900 mb-1 tracking-tight">
          Your Day, Stop by Stop
        </h2>
        <p className="text-[13px] text-neutral-500">
          A carefully paced journey through East Jeju
        </p>
      </div>

      {/* Timeline */}
      <div className="mb-4">
        {stops.map((stop, index) => (
          <TimelineStop 
            key={stop.number} 
            {...stop} 
            isLast={index === stops.length - 1}
          />
        ))}
      </div>

      {/* Operational note */}
      <div className="flex items-start gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
        <Info className="h-4 w-4 text-neutral-400 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-neutral-600 leading-relaxed">
          Stop order may be adjusted based on wind, traffic, and crowding near Seongsan and Seopjikoji.
        </p>
      </div>
    </section>
  )
}
