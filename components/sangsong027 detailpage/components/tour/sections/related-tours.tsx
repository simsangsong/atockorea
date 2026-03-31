"use client"

import { RelatedTourCard } from "../related-tour-card"
import { ChevronRight } from "lucide-react"

export function RelatedTours() {
  const tours = [
    {
      title: "West Scenic Heritage",
      subtitle: "Tea plantations, dramatic cliffs, and sunset views on Jeju's quieter western coast",
      imageSrc: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=600&q=80",
      duration: "8h",
      stops: 5,
      badge: "Hidden Gems",
      price: "₩185,000"
    },
    {
      title: "South Coast Cafe Trail",
      subtitle: "Jeju's most photogenic cafes paired with stunning ocean viewpoints",
      imageSrc: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
      duration: "7h",
      stops: 6,
      price: "₩165,000"
    },
    {
      title: "Hallasan Nature Walk",
      subtitle: "A gentle forest trail with expert naturalist guide—no summit required",
      imageSrc: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80",
      duration: "6h",
      stops: 3,
      badge: "Nature Focus",
      price: "₩155,000"
    },
    {
      title: "Cultural Deep Dive",
      subtitle: "Markets, museums, and local artisans—Jeju beyond the landscapes",
      imageSrc: "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=600&q=80",
      duration: "8h",
      stops: 5,
      price: "₩175,000"
    }
  ]

  return (
    <section className="py-6 pb-32 lg:pb-6">
      <div className="px-4 lg:px-6 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 mb-0.5 tracking-tight">
            You Might Also Like
          </h2>
          <p className="text-[13px] text-neutral-500">
            Other curated Jeju experiences
          </p>
        </div>
        <button className="hidden md:flex items-center gap-1 text-[13px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
          View all
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile: Horizontal scroll - elegant padding */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide lg:hidden">
        {tours.map((tour, index) => (
          <div key={index} className="snap-start first:pl-0">
            <RelatedTourCard {...tour} />
          </div>
        ))}
      </div>

      {/* Desktop: Grid */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-4 px-6">
        {tours.slice(0, 4).map((tour, index) => (
          <RelatedTourCard key={index} {...tour} />
        ))}
      </div>
    </section>
  )
}
