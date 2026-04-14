"use client"

import { useState } from "react"
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "../../lib/utils"
import type { V0CoreGalleryItem } from "@/lib/tour-detail/east/adapters/to-v0-core-product-view"

interface MediaItem {
  id: number
  type: "photo" | "video"
  src: string
  thumbnail?: string
  location: string
  atmosphere: string
  alt: string
}

const defaultGalleryItems: MediaItem[] = [
  {
    id: 1,
    type: "video",
    src: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1200&q=80",
    location: "Route Overview",
    atmosphere: "The day at a glance",
    alt: "East Jeju coastal route overview"
  },
  {
    id: 2,
    type: "photo",
    src: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80",
    location: "Stone landscape opening",
    atmosphere: "Morning geology",
    alt: "Jeju Stone Park stone figures"
  },
  {
    id: 3,
    type: "photo",
    src: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    location: "Lava cave interior",
    atmosphere: "Underground texture",
    alt: "Micheongul lava cave interior"
  },
  {
    id: 4,
    type: "photo",
    src: "https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=800&q=80",
    location: "Village texture",
    atmosphere: "Lived culture",
    alt: "Seongeup Folk Village"
  },
  {
    id: 5,
    type: "photo",
    src: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=80",
    location: "Volcanic crater coast",
    atmosphere: "Summit drama",
    alt: "Seongsan Ilchulbong crater"
  },
  {
    id: 6,
    type: "video",
    src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",
    location: "Open ridge shoreline",
    atmosphere: "Coast release",
    alt: "Seopjikoji coastal walk"
  }
]

function mapCoreToMedia(items: V0CoreGalleryItem[]): MediaItem[] {
  return items.map((it) => ({
    id: it.id,
    type: it.type,
    src: it.src,
    location: it.location,
    atmosphere: it.atmosphere,
    alt: it.alt,
  }))
}

export function RouteGallery({ items }: { items?: V0CoreGalleryItem[] | null }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const galleryItems =
    items && items.length > 0 ? mapCoreToMedia(items) : defaultGalleryItems

  const featuredItem = galleryItems[0]
  const scrollItems = galleryItems.slice(1)

  const openLightbox = (index: number) => {
    setActiveIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => setLightboxOpen(false)

  const goNext = () => setActiveIndex((prev) => (prev + 1) % galleryItems.length)
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + galleryItems.length) % galleryItems.length)

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            See the route atmosphere
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Before the details, this is how the day feels.
          </p>
        </div>

        {/* Featured Media Card - Level 1 Hero card */}
        <button
          onClick={() => openLightbox(0)}
          className="group relative w-full aspect-[16/9] rounded-xl overflow-hidden card-hero transition-all duration-300 hover:shadow-premium-hero"
        >
          <img
            src={featuredItem.src}
            alt={featuredItem.alt}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          {/* Cinematic gradient overlay - premium tasteful */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/70 via-transparent to-[#1A2332]/5" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#1A2332]/20" />
          
          {/* Play indicator for video - premium styling */}
          {featuredItem.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-white">
                <Play className="h-7 w-7 text-foreground ml-1" fill="currentColor" />
              </div>
            </div>
          )}
          
          {/* Atmospheric label */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <span className="rounded-full bg-white/95 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg">
              {featuredItem.location}
            </span>
          </div>
        </button>

        {/* Scrollable Gallery Row - Curated feel */}
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {scrollItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => openLightbox(index + 1)}
              className="group relative flex-shrink-0 w-[100px] rounded-lg overflow-hidden shadow-premium transition-all duration-300 hover:shadow-premium-elevated"
            >
              <div className="aspect-[4/3] relative">
                <img
                  src={item.src}
                  alt={item.alt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Soft overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/60 via-[#1A2332]/10 to-transparent" />
                
                {/* Play indicator for video */}
                {item.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-md">
                      <Play className="h-3 w-3 text-foreground ml-px" fill="currentColor" />
                    </div>
                  </div>
                )}
                
                {/* Atmospheric location label */}
                <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-medium text-white/95 truncate leading-tight">
                  {item.location}
                </span>
              </div>
            </button>
          ))}
          <div className="flex-shrink-0 w-1" />
        </div>
      </div>

      {/* Lightbox Modal - Premium styling */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-[#1A2332]/95 flex items-center justify-center backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button 
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          
          {/* Navigation */}
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
          
          {/* Main image */}
          <div 
            className="relative max-w-4xl max-h-[80vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={galleryItems[activeIndex].src}
              alt={galleryItems[activeIndex].alt}
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl"
            />
            
            {/* Caption */}
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <span className="inline-block rounded-full bg-black/40 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white">
                {galleryItems[activeIndex].location}
              </span>
            </div>
            
            {/* Video play overlay */}
            {galleryItems[activeIndex].type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-xl cursor-pointer hover:scale-105 transition-transform">
                  <Play className="h-8 w-8 text-foreground ml-1" fill="currentColor" />
                </div>
              </div>
            )}
          </div>
          
          {/* Thumbnails */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
            {galleryItems.map((item, index) => (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); setActiveIndex(index); }}
                className={cn(
                  "w-12 h-8 rounded-md overflow-hidden transition-all",
                  activeIndex === index 
                    ? "ring-2 ring-white ring-offset-2 ring-offset-[#1A2332]" 
                    : "opacity-50 hover:opacity-80"
                )}
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

