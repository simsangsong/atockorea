'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, Check, Car, Bus, Award } from 'lucide-react'

export function ChooseTravelStyle() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Add visible class to all animated children on mount
    if (containerRef.current) {
      const children = containerRef.current.querySelectorAll('[data-animate]')
      children.forEach((child, index) => {
        setTimeout(() => {
          child.classList.add('visible')
        }, index * 100)
      })
    }
  }, [])
  return (
    <section className="py-14 md:py-20 px-4 md:px-6 bg-gradient-to-b from-slate-50/80 to-white">
      <div ref={containerRef} className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-3 bg-white border border-slate-200/60 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Choose Your Style</span>
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800 tracking-tight mb-3">
            Three ways to explore
          </h2>
          <p className="text-slate-600 text-[14px] md:text-[15px] font-medium max-w-lg mx-auto leading-relaxed">
            We recommend small group for most travelers, with private and traditional bus as strong alternatives depending on your priorities.
          </p>
        </div>

        {/* Primary Option - Small Group (Lead recommendation) */}
        <div className="relative mb-5 scroll-animate" data-animate>
          <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 md:p-8 overflow-hidden border border-slate-700/50">
            {/* Recommended Badge */}
            <div className="absolute top-0 right-5 md:right-6 z-10">
              <div className="bg-emerald-500 text-white text-[9px] md:text-[10px] font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-b-lg shadow-md flex items-center gap-1.5 tracking-wide">
                <Award className="w-3 h-3 md:w-3.5 md:h-3.5" />
                RECOMMENDED
              </div>
            </div>
            
            {/* Subtle background accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full -mr-32 -mt-32" />
            
            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 md:gap-6 mb-6 md:mb-8">
                <div>
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2">
                    Small Group Tour
                  </h3>
                  <p className="text-sm md:text-base text-slate-300 max-w-md leading-relaxed">
                    Ideal for travelers seeking a smoother pace, fewer crowds, and a more personal experience.
                  </p>
                </div>
                <div className="text-left md:text-right flex-shrink-0">
                  <p className="text-xs text-slate-400 mb-1">From</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base text-slate-500 line-through">$78</span>
                    <span className="text-3xl md:text-4xl font-bold text-white">$58</span>
                  </div>
                  <p className="text-xs text-emerald-300 font-semibold">per person</p>
                </div>
              </div>

              {/* Features - Responsive grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3 mb-6 md:mb-8 p-4 md:p-5 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-300" />
                  </div>
                  <span className="font-medium text-white/90 text-sm">Comfortable pacing</span>
                </div>
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-300" />
                  </div>
                  <span className="font-medium text-white/90 text-sm">Less crowding</span>
                </div>
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-300" />
                  </div>
                  <span className="font-medium text-white/90 text-sm">Personal feel</span>
                </div>
              </div>

              {/* CTA */}
              <Button
                size="lg"
                className="w-full bg-white hover:bg-white/95 text-slate-900 font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-sm shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition-all duration-300"
              >
                Explore small group tours
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Alternative Options - Equal visual weight */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Private Tour - Warm tones */}
          <div className="group bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-200/70 p-5 md:p-6 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] hover:border-slate-300 transition-all duration-300 relative overflow-hidden scroll-animate" data-animate>
            {/* Subtle accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300" />
            
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Car className="w-4 h-4 md:w-5 md:h-5 text-amber-700" />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full tracking-wide">MORE FLEXIBILITY</span>
            </div>
            
            <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-1">
              Private Tour
            </h3>
            <div className="mb-3">
              <span className="text-xs text-slate-400 line-through mr-1.5">$248</span>
              <span className="text-2xl md:text-3xl font-bold text-slate-900">$198</span>
              <span className="text-slate-500 text-xs ml-1">/person</span>
            </div>

            <p className="text-[13px] md:text-[14px] text-slate-600 mb-5 leading-relaxed">
              Perfect for families or groups who want a dedicated vehicle and flexible pacing.
            </p>

            <div className="space-y-2.5 mb-5">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[13px] md:text-[14px] text-slate-700">Dedicated vehicle</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[13px] md:text-[14px] text-slate-700">Flexible pacing</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[13px] md:text-[14px] text-slate-700">Private comfort</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full border-amber-300/80 bg-amber-50/50 text-amber-800 hover:bg-amber-100 hover:border-amber-400 font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-sm transition-all"
            >
              Explore private tours
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Traditional Bus Tour - Warm dependable classic */}
          <div className="group bg-gradient-to-br from-amber-50/40 via-stone-50 to-orange-50/30 rounded-2xl shadow-[0_4px_24px_rgba(120,90,50,0.06)] border border-amber-200/60 p-5 md:p-6 hover:shadow-[0_8px_28px_rgba(120,90,50,0.1)] hover:border-amber-300/70 transition-all duration-300 relative overflow-hidden scroll-animate" data-animate>
            {/* Warm top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300/80 via-stone-400 to-amber-300/80" />
            
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              {/* Warm icon container with depth */}
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-100 to-stone-100 flex items-center justify-center border border-amber-200/60 shadow-[0_2px_8px_rgba(180,130,60,0.15)]">
                <Bus className="w-5 h-5 md:w-[22px] md:h-[22px] text-amber-700" />
              </div>
              {/* Refined warm badge */}
              <span className="text-[9px] md:text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200/70 px-3 py-1.5 rounded-lg tracking-wide shadow-sm">TRUSTED CLASSIC</span>
            </div>
            
            {/* Title */}
            <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight mb-1.5">
              Traditional Bus Tour
            </h3>
            
            {/* Price */}
            <div className="mb-4">
              <span className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">$48</span>
              <span className="text-amber-700/70 text-xs font-medium ml-1.5">/person</span>
            </div>

            {/* Description */}
            <p className="text-[13px] md:text-sm text-stone-600 mb-5 leading-relaxed">
              Dependable routes with clear structure and strong value — a smart choice for straightforward sightseeing.
            </p>

            {/* Benefits with warm accents */}
            <div className="space-y-2.5 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-100/80 border border-amber-200/60 flex items-center justify-center">
                  <Check className="w-3 h-3 text-amber-700" />
                </div>
                <span className="text-[13px] md:text-sm text-slate-700 font-medium">Proven route</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-100/80 border border-amber-200/60 flex items-center justify-center">
                  <Check className="w-3 h-3 text-amber-700" />
                </div>
                <span className="text-[13px] md:text-sm text-slate-700 font-medium">Structured day</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-100/80 border border-amber-200/60 flex items-center justify-center">
                  <Check className="w-3 h-3 text-amber-700" />
                </div>
                <span className="text-[13px] md:text-sm text-slate-700 font-medium">Easy value</span>
              </div>
            </div>

            {/* CTA with warm accent */}
            <Button
              variant="outline"
              size="lg"
              className="w-full border-amber-300/70 bg-white text-amber-800 hover:bg-amber-50 hover:border-amber-400 font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-sm transition-all"
            >
              Browse bus tours
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
