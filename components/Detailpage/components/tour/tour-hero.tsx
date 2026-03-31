'use client'

import Image from 'next/image'
import { Star, Clock, MapPin } from 'lucide-react'

export function TourHero() {
  return (
    <section className="relative">
      {/* Hero Image - cleaner, more cinematic */}
      <div className="relative h-[56vh] min-h-[400px] lg:h-[62vh] lg:min-h-[520px]">
        <Image
          src="https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1400&q=85"
          alt="Scenic view of Jeju Island coastline"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Simpler gradient - less heavy */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-90" />
        
        {/* Quieter badge */}
        <div className="absolute top-5 left-4 md:top-6 md:left-6">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-lg text-[10px] font-medium tracking-[0.04em] text-foreground/80">
            Signature Collection
          </span>
        </div>
      </div>

      {/* Content - cleaner card */}
      <div className="relative -mt-32 px-4 pb-6 md:px-6 lg:-mt-40 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-3xl">
          <div className="glass-card-elevated rounded-2xl p-5 md:p-7 lg:p-8">
            {/* Rating - minimal */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-foreground/70 text-foreground/70" />
                ))}
              </div>
              <span className="text-[12px] text-muted-foreground">4.9 (128)</span>
            </div>

            {/* Title - editorial */}
            <h1 className="font-serif text-[24px] leading-[1.15] font-normal text-foreground md:text-[30px] lg:text-[34px] text-balance tracking-[-0.01em]">
              East Signature Nature Core
            </h1>
            
            {/* Subtitle */}
            <p className="mt-4 text-[14px] text-muted-foreground leading-[1.6] md:text-[15px] max-w-xl">
              A refined East Jeju route for first-time visitors who want iconic scenery, local character, and a smooth all-day rhythm.
            </p>

            {/* Quick info - cleaner */}
            <div className="mt-5 pt-5 border-t border-border/50">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-foreground/60">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 opacity-50" />
                  <span>8-9 hours</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 opacity-50" />
                  <span>6 stops</span>
                </div>
                <span className="text-border">|</span>
                <span>Small group</span>
              </div>
            </div>

            {/* Route preview - simplified */}
            <div className="mt-5 pt-5 border-t border-border/50">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70 mb-3">Route</p>
              <p className="text-[13px] text-foreground/70 leading-relaxed">
                Hamdeok Beach — Seongeup — Local Lunch — Seopjikoji — Seongsan — Stone Park
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
