"use client"

import { Star, Clock } from "lucide-react"
import type { V2RecommendationsShell } from "@/lib/tour-detail/v2/detail-page-v2"

const DEFAULT_ITEMS: NonNullable<V2RecommendationsShell["items"]> = [
  {
    id: 1,
    title: "West Coast Sunset Route",
    description: "Relaxed coastal route with sunset viewpoints, beaches, and local cafes.",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    rating: 4.7,
    reviews: 89,
    duration: "7 hrs",
    price: "79,000",
    tag: "Sunset",
    href: "#",
  },
  {
    id: 2,
    title: "Hallasan Mountain Day",
    description: "Full-day hiking to Jeju's highest peak with panoramic island views.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
    rating: 4.9,
    reviews: 156,
    duration: "9 hrs",
    price: "95,000",
    tag: "Adventure",
    href: "#",
  },
  {
    id: 3,
    title: "Local Food & Culture",
    description: "Markets, cooking experiences, and authentic local dining.",
    image: "https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80",
    rating: 4.8,
    reviews: 112,
    duration: "6 hrs",
    price: "72,000",
    tag: "Culinary",
    href: "#",
  },
  {
    id: 4,
    title: "South Shore Waterfalls",
    description: "Dramatic waterfalls and volcanic coastline exploration.",
    image: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=80",
    rating: 4.6,
    reviews: 78,
    duration: "7 hrs",
    price: "82,000",
    tag: "Nature",
    href: "#",
  },
]

export const DEFAULT_RECOMMENDATIONS_SHELL: V2RecommendationsShell = {
  eyebrow: "Explore next",
  title: "You might also like",
  subtitle: "Different pacing, different emphasis. Each is its own day.",
  items: DEFAULT_ITEMS,
}

export function RecommendationsSection({ data }: { data?: V2RecommendationsShell | null }) {
  const eyebrow = data?.eyebrow?.trim() || DEFAULT_RECOMMENDATIONS_SHELL.eyebrow!
  const title = data?.title?.trim() || DEFAULT_RECOMMENDATIONS_SHELL.title!
  const subtitle = data?.subtitle?.trim() || DEFAULT_RECOMMENDATIONS_SHELL.subtitle!
  const items = data?.items && data.items.length > 0 ? data.items : DEFAULT_ITEMS

  return (
    <div className="space-y-6">
      <div className="px-5">
        <p className="text-[10px] font-semibold text-primary tracking-wide">{eyebrow}</p>
        <h2 className="text-lg font-semibold text-foreground tracking-tight mt-1">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
      </div>

      <div
        className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-5"
        style={{ scrollPaddingLeft: "20px" }}
      >
        {items.map((rec) => (
          <a
            key={String(rec.id)}
            href={rec.href?.trim() || "#"}
            className="group flex-shrink-0 snap-start overflow-hidden rounded-xl card-hero transition-all duration-300 hover:shadow-premium-hero"
            style={{ width: "calc(78vw - 20px)", maxWidth: "320px" }}
          >
            <div className="relative h-44 overflow-hidden">
              <img src={rec.image} alt={rec.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/50 via-[#1A2332]/10 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#1A2332]/20" />

              <div className="absolute top-3 left-3">
                <span className="rounded-md bg-white/95 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-foreground shadow-md">
                  {rec.tag}
                </span>
              </div>

              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-white/95 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {rec.duration}
              </div>
            </div>

            <div className="p-4 pb-5">
              <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                {rec.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">{rec.description}</p>

              <div className="mt-3.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold text-foreground">{rec.rating}</span>
                  <span className="text-xs text-muted-foreground">({rec.reviews})</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block leading-none">from</span>
                  <span className="text-base font-semibold text-foreground">
                    {rec.price}
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">KRW</span>
                  </span>
                </div>
              </div>
            </div>
          </a>
        ))}

        <div className="flex-shrink-0 w-1" />
      </div>
    </div>
  )
}
