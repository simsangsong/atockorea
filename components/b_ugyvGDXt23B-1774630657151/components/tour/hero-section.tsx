"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Heart, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"

const heroImages = [
  {
    src: "https://images.unsplash.com/photo-1548115184-bc6544d06a58?w=1200&h=800&fit=crop",
    alt: "Haedong Yonggungsa Temple by the sea",
  },
  {
    src: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&h=800&fit=crop",
    alt: "Gamcheon Culture Village colorful houses",
  },
  {
    src: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200&h=800&fit=crop",
    alt: "Scenic coastal drive",
  }
]

export function HeroSection() {
  const [currentImage, setCurrentImage] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const nextImage = useCallback(() => {
    setCurrentImage((prev) => (prev + 1) % heroImages.length)
  }, [])

  const prevImage = useCallback(() => {
    setCurrentImage((prev) => (prev - 1 + heroImages.length) % heroImages.length)
  }, [])

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(nextImage, 5000)
    return () => clearInterval(timer)
  }, [nextImage])

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return
    const diff = touchStart - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextImage() : prevImage()
    }
    setTouchStart(null)
  }

  return (
    <section className="relative">
      {/* Image Carousel - Constrained height on mobile (max 360px) */}
      <div 
        className="relative h-[360px] md:h-[420px] lg:h-[480px] xl:h-[520px] overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {heroImages.map((image, index) => (
          <div
            key={index}
            className={cn(
              "absolute inset-0 transition-all duration-700 ease-out",
              index === currentImage 
                ? "opacity-100 scale-100" 
                : "opacity-0 scale-105"
            )}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-cover"
              priority={index === 0}
              sizes="100vw"
            />
          </div>
        ))}
        
        {/* Premium layered gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20" />

        {/* Top Navigation Bar - Glass buttons */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <button className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white hover:bg-white/25 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button 
              className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white hover:bg-white/25 active:scale-95 transition-all"
              onClick={() => setIsLiked(!isLiked)}
            >
              <Heart className={cn("w-5 h-5 transition-colors", isLiked && "fill-rose-400 text-rose-400")} />
            </button>
            <button className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white hover:bg-white/25 active:scale-95 transition-all">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Desktop Carousel Controls - Glass */}
        <button
          onClick={prevImage}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/25 items-center justify-center text-white hover:bg-white/25 transition-all hidden md:flex"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={nextImage}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/25 items-center justify-center text-white hover:bg-white/25 transition-all hidden md:flex"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Hero Content - Bottom aligned */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-5 pb-6 md:p-8 lg:p-12">
          <div className="max-w-4xl">
            {/* Trust Chips - Glass style with blue tint */}
            <div className="flex flex-wrap gap-2 mb-4">
              {["Private Tour", "Free Cancellation", "Local Guide"].map((chip) => (
                <span 
                  key={chip}
                  className="px-3.5 py-1.5 text-[11px] font-medium tracking-wide bg-white/15 backdrop-blur-md border border-white/25 text-white rounded-full"
                >
                  {chip}
                </span>
              ))}
            </div>

            {/* Title - Editorial typography */}
            <h1 className="text-[1.75rem] md:text-4xl lg:text-5xl font-bold text-white leading-[1.15] tracking-tight text-balance mb-3">
              부산 프라이빗 투어
            </h1>
            <p className="text-[15px] md:text-lg text-white/90 font-light leading-relaxed max-w-xl mb-5">
              현지 가이드와 함께하는 부산의 숨겨진 명소와 해안 절경
            </p>

            {/* Price Anchor - Glass card with blue-white gradient feel */}
            <div className="inline-flex items-baseline gap-2 px-5 py-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25"
                 style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
              <span className="text-xs text-white/80 font-medium">From</span>
              <span className="text-2xl md:text-3xl font-bold text-white tracking-tight">$260</span>
              <span className="text-xs text-white/80">/ person</span>
            </div>
          </div>
        </div>

        {/* Image Indicators - Pill style */}
        <div className="absolute bottom-5 right-5 md:right-8 z-10 flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/25 backdrop-blur-md">
          {heroImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImage(index)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === currentImage 
                  ? "w-5 bg-white" 
                  : "w-1.5 bg-white/40 hover:bg-white/60"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
