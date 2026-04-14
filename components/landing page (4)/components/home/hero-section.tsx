'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Star, ChevronRight, ChevronDown, Users, MapPin } from 'lucide-react'

const STARTER_TAGS = [
  { label: 'Scenic' },
  { label: 'Family-friendly' },
  { label: 'Light walking' },
  { label: 'Less crowded' },
]

const MORE_TAGS = [
  { label: 'Nature + cafes' },
  { label: 'Cultural sites' },
  { label: 'Fixed itinerary' },
  { label: 'Flexible pace' },
]

export function HeroSection() {
  const [selectedDestination, setSelectedDestination] = useState('jeju')
  const [preferences, setPreferences] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isInputExpanded, setIsInputExpanded] = useState(false)
  const [showMoreTags, setShowMoreTags] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const toggleTag = (label: string) => {
    setSelectedTags(prev => 
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    )
  }

  const handleInputFocus = () => {
    setIsInputExpanded(true)
  }

  const handleInputBlur = () => {
    if (!preferences) {
      setIsInputExpanded(false)
    }
  }

  return (
    <section className="relative flex flex-col">
      {/* ===== HERO ZONE - Scenic Background ===== */}
      <div className="relative min-h-[32vh] md:min-h-[44vh] flex flex-col justify-end pb-6 md:pb-12 overflow-hidden">
        {/* Background Video */}
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/images/jeju-hero.jpg"
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="https://videos.pexels.com/video-files/3629519/3629519-uhd_2560_1440_30fps.mp4" type="video/mp4" />
          </video>
          {/* Controlled overlays - premium and airy */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-900/25 to-slate-800/50" />
          {/* Soft bottom fade to form zone */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#faf9f7] via-white/5 to-transparent" style={{ height: '100%' }} />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 px-5 md:px-8 max-w-2xl mx-auto w-full text-center">
          {/* Main Headline */}
          <h1 
            className="text-[1.75rem] md:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.12] tracking-[-0.02em] mb-2"
            style={{ 
              textShadow: '0 2px 20px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)',
              fontFamily: 'var(--font-sans)'
            }}
          >
            Find the Korea day tour that fits you best
          </h1>
          
          {/* Subheadline */}
          <p 
            className="text-[14px] md:text-base text-white/95 font-medium tracking-wide max-w-md mx-auto"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)' }}
          >
            Skip the endless OTA search. Explore proven tours in one place and get the best match for your style, budget, and destination.
          </p>
        </div>
      </div>

      {/* ===== FORM ZONE - Premium Warm Surface ===== */}
      <div className="relative px-4 md:px-8 pt-0 pb-8 md:pb-10" style={{ background: 'linear-gradient(to bottom, #faf9f7, #fdfcfb, #ffffff)' }}>
        {/* Form Card - Premium Travel Concierge Panel */}
        <div className="relative max-w-lg mx-auto -mt-3 md:-mt-4">
          {/* Soft ambient glow */}
          <div className="absolute -inset-3 bg-gradient-to-b from-white/90 via-amber-50/20 to-transparent rounded-[28px] blur-2xl opacity-80" />
          
          <div 
            className="relative rounded-[18px] md:rounded-[20px] p-5 md:p-7"
            style={{
              background: 'linear-gradient(to bottom, #fffffe, #fdfcfa)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.03)',
              border: '1px solid rgba(0,0,0,0.04)'
            }}
          >
            {/* 1. Intro - Premium and intentional */}
            <div className="mb-5 md:mb-6">
              <h2 className="text-[16px] md:text-lg font-semibold text-slate-800 tracking-[-0.01em] mb-1">
                Tell us what matters to you
              </h2>
              <p className="text-[13px] md:text-[14px] text-slate-600 leading-relaxed">
                We&apos;ll surface the tour style that fits you best.
              </p>
            </div>

            {/* 2. Destination Tiles - Compact on mobile */}
            <div className="mb-5 md:mb-6">
              <label className="block text-[11px] md:text-[12px] font-semibold text-slate-600 tracking-wide mb-2 md:mb-3">
                Where would you like to go?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {/* Jeju - Active */}
                <button
                  onClick={() => setSelectedDestination('jeju')}
                  className={`relative px-2 py-3 md:px-3 md:py-3.5 rounded-xl md:rounded-2xl font-medium transition-all duration-250 text-center ${
                    selectedDestination === 'jeju'
                      ? 'bg-slate-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.12),0_6px_20px_rgba(0,0,0,0.08)]'
                      : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100/80 border border-slate-200/60'
                  }`}
                >
                  <span className="block text-[13px] md:text-[14px] font-semibold tracking-[-0.01em]">Jeju</span>
                  <span className={`flex items-center justify-center gap-1 text-[9px] md:text-[10px] mt-1 tracking-wide ${selectedDestination === 'jeju' ? 'text-emerald-300' : 'text-emerald-600'}`}>
                    <span className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${selectedDestination === 'jeju' ? 'bg-emerald-400' : 'bg-emerald-500'}`}></span>
                    Available
                  </span>
                </button>
                {/* Seoul */}
                <button disabled className="px-2 py-3 md:px-3 md:py-3.5 rounded-xl md:rounded-2xl text-center bg-slate-50/50 border border-slate-150/50 cursor-not-allowed">
                  <span className="block text-[13px] md:text-[14px] font-medium text-slate-400 tracking-[-0.01em]">Seoul</span>
                  <span className="block text-[9px] md:text-[10px] mt-1 tracking-wide text-slate-400/70">Coming</span>
                </button>
                {/* Busan */}
                <button disabled className="px-2 py-3 md:px-3 md:py-3.5 rounded-xl md:rounded-2xl text-center bg-slate-50/50 border border-slate-150/50 cursor-not-allowed">
                  <span className="block text-[13px] md:text-[14px] font-medium text-slate-400 tracking-[-0.01em]">Busan</span>
                  <span className="block text-[9px] md:text-[10px] mt-1 tracking-wide text-slate-400/70">Coming</span>
                </button>
              </div>
            </div>

            {/* 3. Preference Input - Compact on mobile */}
            <div className="mb-4 md:mb-5">
              <label className="block text-[11px] md:text-[12px] font-semibold text-slate-600 tracking-wide mb-2">
                What kind of experience are you looking for?
              </label>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Describe your ideal day..."
                  rows={isInputExpanded ? 3 : 2}
                  className={`w-full px-3.5 py-3 text-[13px] md:text-[14px] rounded-xl resize-none transition-all duration-300 placeholder:text-slate-400/80 ${
                    isInputExpanded ? 'min-h-[88px]' : 'min-h-[52px]'
                  }`}
                  style={{
                    background: 'linear-gradient(to bottom, #fafafa, #ffffff)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                    outline: 'none'
                  }}
                  onFocusCapture={(e) => {
                    e.currentTarget.style.border = '1px solid rgba(30,58,95,0.2)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30,58,95,0.06), inset 0 1px 2px rgba(0,0,0,0.02)'
                  }}
                  onBlurCapture={(e) => {
                    e.currentTarget.style.border = '1px solid rgba(0,0,0,0.06)'
                    e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.02)'
                  }}
                />
              </div>
              {/* Helper line */}
              <p className="text-[11px] md:text-[12px] text-slate-500 mt-2 leading-relaxed">
                e.g. scenic stops, less walking, family-friendly
              </p>
            </div>

            {/* 4. Helpful Starters - Compact chips */}
            <div className="mb-5 md:mb-6">
              <p className="text-[11px] md:text-[12px] font-semibold text-slate-600 tracking-wide mb-2">
                Helpful starters
              </p>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {STARTER_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.label)
                  return (
                    <button
                      key={tag.label}
                      onClick={() => toggleTag(tag.label)}
                      className={`px-3 py-1.5 md:px-3.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-slate-800 text-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                          : 'text-slate-600 hover:bg-slate-100/80'
                      }`}
                      style={!isSelected ? {
                        background: 'linear-gradient(to bottom, #fafafa, #f5f5f5)',
                        border: '1px solid rgba(0,0,0,0.06)'
                      } : undefined}
                    >
                      {tag.label}
                    </button>
                  )
                })}
              </div>
              
              {/* Expandable more options */}
              {showMoreTags && (
                <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                  {MORE_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag.label)
                    return (
                      <button
                        key={tag.label}
                        onClick={() => toggleTag(tag.label)}
                        className={`px-3 py-1.5 md:px-3.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-full transition-all duration-200 ${
                          isSelected
                            ? 'bg-slate-800 text-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                            : 'text-slate-600 hover:bg-slate-100/80'
                        }`}
                        style={!isSelected ? {
                          background: 'linear-gradient(to bottom, #fafafa, #f5f5f5)',
                          border: '1px solid rgba(0,0,0,0.06)'
                        } : undefined}
                      >
                        {tag.label}
                      </button>
                    )
                  })}
                </div>
              )}
              
              {!showMoreTags && (
                <button 
                  onClick={() => setShowMoreTags(true)}
                  className="mt-2 text-[10px] md:text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-0.5"
                >
                  More options
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 5. Reassurance line */}
            <p className="text-[11px] md:text-[12px] text-slate-500 text-center mb-4 leading-relaxed">
              Compare small group, private, and bus options next.
            </p>

            {/* 6. CTA Button */}
            <Button
              size="lg"
              className="w-full font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-[14px] transition-all duration-300"
              style={{
                background: 'linear-gradient(to bottom, #1e3a5f, #172d4a)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(30,58,95,0.2), 0 8px 24px rgba(30,58,95,0.1)',
                border: 'none'
              }}
            >
              See my best-fit options
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Trust indicators - compact row */}
        <div className="mt-6 md:mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-6">
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 md:w-3.5 md:h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">Matched to you</span>
          </div>

          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-500" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">Clear pickup</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-500" />
            <span className="text-[11px] md:text-[13px] font-medium text-slate-600">Compare all types</span>
          </div>
        </div>
      </div>
    </section>
  )
}
