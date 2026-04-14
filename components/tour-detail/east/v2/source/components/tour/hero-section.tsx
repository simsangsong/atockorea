"use client"

import { Clock, MapPin, Footprints, Star } from "lucide-react"

export type V0HeroProductSlice = {
  titleLine1: string
  titleLine2: string
  subtitle: string
  backgroundImageUrl: string
  pill1: string
  pill2: string
  durationLabel: string
  regionLabel: string
  stopCountLabel: string
  ratingNumeric: string
  fullStars: number
  /** e.g. localized “(128 reviews)” — optional social proof beside stars */
  reviewsLine?: string | null
}

const DEFAULT_HERO: V0HeroProductSlice = {
  titleLine1: "East Signature",
  titleLine2: "Nature Core",
  subtitle: "Geology to coast. Cave to village to sea.",
  backgroundImageUrl: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80",
  pill1: "First-Time Friendly",
  pill2: "East Jeju",
  durationLabel: "8 hrs",
  regionLabel: "East Jeju",
  stopCountLabel: "6 stops",
  ratingNumeric: "4.8",
  fullStars: 4,
}

export function HeroSection({ product }: { product?: V0HeroProductSlice | null }) {
  const h = product ?? DEFAULT_HERO

  return (
    <section className="relative w-full">
      {/* Hero as one unified premium object - compact premium card feel on mobile */}
      <div className="relative h-[52vh] min-h-[400px] max-h-[520px] sm:h-[58vh] sm:min-h-[460px] sm:max-h-[600px] w-full overflow-hidden rounded-b-2xl shadow-hero">
        {/* Background Image - focal point adjusted for shorter mobile crop */}
        <div 
          className="absolute inset-0 bg-cover scale-[1.02]"
          style={{
            backgroundImage: `url(${JSON.stringify(h.backgroundImageUrl)})`,
            backgroundPosition: 'center 35%',
          }}
        />
        
        {/* Layer 1: Subtle top fade for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A2332]/12 via-transparent via-30% to-transparent" />
        
        {/* Layer 2: Main bottom gradient - smooth, cinematic */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/95 via-[#1A2332]/40 via-40% to-transparent" />
        
        {/* Layer 3: Very subtle warm atmospheric tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/[0.03] via-transparent to-transparent" />
        
        {/* Layer 4: Soft vignette around text area only */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 120% 80% at 10% 90%, rgba(26,35,50,0.25) 0%, transparent 50%)'
          }}
        />
        
        {/* Content Area */}
        <div className="absolute inset-0 flex flex-col justify-end">
          {/* Text Block with subtle glass backing - raised on mobile for compact feel */}
          <div className="relative px-5 pb-[72px] sm:pb-24">
            {/* Subtle local glass blur behind text - very soft */}
            <div 
              className="absolute -inset-x-2 -inset-y-3 -z-10 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(26,35,50,0.15) 0%, rgba(26,35,50,0.05) 100%)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                maskImage: 'linear-gradient(to right, black 0%, black 85%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, black 0%, black 85%, transparent 100%)',
              }}
            />
            
            {/* Title - strong, clean, premium hierarchy - tighter on mobile */}
            <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-white leading-[1.05] sm:text-[30px] sm:leading-[1.1] lg:text-[34px]">
              {h.titleLine1}
              {h.titleLine2 ? (
                <>
                  <br />
                  {h.titleLine2}
                </>
              ) : null}
            </h1>
            
            {/* Supporting copy - calm, editorial, not explanatory */}
            <p className="mt-3 sm:mt-4 max-w-sm text-[13px] sm:text-[14px] text-white/80 leading-[1.6] tracking-wide">
              {h.subtitle}
            </p>
            
            {/* Premium glass pills - max 2, elegant and quiet */}
            <div className="mt-4 sm:mt-6 flex flex-wrap gap-2">
              <span 
                className="rounded-full px-3.5 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-[11px] font-medium tracking-wide text-white/90"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                {h.pill1}
              </span>
              <span 
                className="rounded-full px-3.5 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-[11px] font-medium tracking-wide text-white/90"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                {h.pill2}
              </span>
            </div>
          </div>
          
          {/* Integrated Meta Bar - inside hero as dark translucent glass, compact on mobile */}
          <div className="absolute bottom-0 left-0 right-0">
            <div 
              className="mx-0 px-4 py-2.5 sm:px-5 sm:py-3.5"
              style={{
                background: 'linear-gradient(to right, rgba(26,35,50,0.88) 0%, rgba(26,35,50,0.78) 100%)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:gap-x-5 sm:gap-y-2">
                {/* Duration */}
                <div className="flex items-center gap-1.5 text-[13px] sm:text-sm text-white/90">
                  <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/60" />
                  <span className="font-medium">{h.durationLabel}</span>
                </div>
                
                {/* Separator */}
                <span className="hidden sm:block w-px h-3.5 bg-white/20" />
                
                {/* Region */}
                <div className="flex items-center gap-1.5 text-[13px] sm:text-sm text-white/90">
                  <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/60" />
                  <span>{h.regionLabel}</span>
                </div>
                
                {/* Separator */}
                <span className="hidden sm:block w-px h-3.5 bg-white/20" />
                
                {/* Stops */}
                <div className="flex items-center gap-1.5 text-[13px] sm:text-sm text-white/90">
                  <Footprints className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/60" />
                  <span>{h.stopCountLabel}</span>
                </div>
                
                {/* Rating - right aligned */}
                <div className="ml-auto flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${star <= h.fullStars ? 'fill-amber-400 text-amber-400' : 'fill-white/30 text-white/30'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-[13px] sm:text-sm font-semibold text-white shrink-0">{h.ratingNumeric}</span>
                  {h.reviewsLine?.trim() ? (
                    <span className="hidden sm:inline text-[11px] sm:text-xs text-white/70 truncate max-w-[9rem]">
                      {h.reviewsLine.trim()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
