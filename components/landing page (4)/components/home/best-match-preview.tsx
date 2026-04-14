'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Clock, Users, Star, ChevronRight } from 'lucide-react'
import Image from 'next/image'

export function BestMatchPreview() {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.classList.add('visible')
    }
  }, [])

  return (
    <section className="py-14 md:py-20 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-3 bg-slate-100/80 border border-slate-200/60 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Example Recommendation</span>
          </div>
          <p className="text-slate-600 text-[14px] font-medium max-w-sm mx-auto leading-relaxed">
            Based on your preferences, here&apos;s a sample of what we&apos;d recommend.
          </p>
        </div>

        {/* Sample Preferences - Slim inline bar */}
        <div className="flex items-center justify-center gap-1.5 mb-4 px-3 py-2 bg-slate-50/80 rounded-lg border border-slate-200/70">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Sample:</span>
          <span className="text-[11px] text-slate-600">First visit</span>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] text-slate-600">Scenic</span>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] text-slate-600">Light walking</span>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] text-slate-600">Jeju City</span>
        </div>

        {/* Compact Premium Card */}
        <div ref={cardRef} className="group relative scroll-animate">
          <div className="relative bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden border border-slate-200/70">
            
            {/* Image - Reduced height */}
            <div className="relative h-44 md:h-56 overflow-hidden" style={{ minHeight: '176px' }}>
              <Image
                src="/images/east-jeju-coast.jpg"
                alt="East Jeju coastal scenery"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
              
              {/* Content overlaid on image */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                {/* Title and price row */}
                <div className="flex items-end justify-between gap-3 mb-3">
                  <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
                    East Jeju Small Group
                  </h3>
                  <div className="text-right flex-shrink-0">
                    <span className="text-white/50 text-xs line-through block">$78</span>
                    <span className="text-xl font-bold text-white">$58</span>
                  </div>
                </div>
                
                {/* Meta row - compact */}
                <div className="flex items-center gap-3 text-white/90 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span className="font-semibold">4.9</span>
                    <span className="text-white/60">(234)</span>
                  </div>
                  <span className="text-white/40">·</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>8h</span>
                  </div>
                  <span className="text-white/40">·</span>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>Max 7</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content below image - very compact */}
            <div className="p-4 md:p-5">
              {/* Fit signals - 3 chips inline */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="px-2.5 py-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded-full">Hotel pickup</span>
                <span className="px-2.5 py-1 text-[10px] font-medium bg-sky-50 text-sky-700 rounded-full">Relaxed pace</span>
                <span className="px-2.5 py-1 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full">Coastal views</span>
              </div>

              {/* Match reason - single elegant line */}
              <p className="text-[13px] text-slate-600 mb-5 leading-relaxed">
                <span className="font-medium text-slate-700">Matched for you:</span> Scenic coastal route with light walking and Jeju City pickup — fits your relaxed travel style.
              </p>

              {/* CTA */}
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/95 text-white font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-sm shadow-[0_4px_16px_rgba(30,58,95,0.18)] hover:shadow-[0_6px_20px_rgba(30,58,95,0.22)] transition-all duration-300"
              >
                View tour details
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Compact alternatives hint */}
        <p className="text-center text-[12px] text-slate-500 mt-5">
          Not quite right? Private and bus options also available.
        </p>
      </div>
    </section>
  )
}
