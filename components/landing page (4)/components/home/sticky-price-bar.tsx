'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Star, ChevronRight, Users } from 'lucide-react'

export function StickyPriceBar() {
  const [isVisible, setIsVisible] = useState(false)
  const [viewerCount, setViewerCount] = useState(12)

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past 600px (hero section)
      setIsVisible(window.scrollY > 600)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Simulate live viewer count fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => {
        const change = Math.random() > 0.5 ? 1 : -1
        const newCount = prev + change
        return Math.max(8, Math.min(18, newCount))
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]" />
      
      <div className="relative max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Price & Info */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-slate-500">From</span>
              <span className="text-2xl font-bold text-slate-900">$58</span>
              <span className="text-xs text-slate-500">/person</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium text-slate-600">4.9</span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500">Small Group</span>
            </div>
          </div>
        </div>

        {/* Center: Live viewers (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full">
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <Users className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-600">
            <span className="font-semibold">{viewerCount}</span> viewing now
          </span>
        </div>

        {/* Right: CTA Button */}
        <Button
          size="lg"
          className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-5 rounded-xl text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 whitespace-nowrap"
        >
          Find My Tour
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
