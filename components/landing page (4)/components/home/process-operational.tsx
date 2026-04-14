'use client'

import { useEffect, useRef } from 'react'
import { Send, CheckCircle, MapIcon, MapPin, Bell, Headphones } from 'lucide-react'

export function ProcessOperational() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.add('visible')
    }
  }, [])

  return (
    <section className="py-14 md:py-20 px-4" style={{background: "linear-gradient(to bottom, rgba(242, 245, 255, 0.4), rgba(248, 245, 240, 0.25))"}}>
      <div ref={containerRef} className="max-w-5xl mx-auto scroll-animate">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight mb-3">
            What happens next
          </h2>
        </div>

        {/* Process Steps - 4 Steps with Flow */}
        <div className="relative mb-12">
          {/* Connecting Line - Desktop only, spans all 4 steps */}
          <div className="hidden lg:block absolute top-[28px] left-[40px] right-[40px] h-0.5 bg-gradient-to-r from-slate-200 via-primary/20 via-primary/10 to-slate-200 z-0" />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            {/* Step 1 - Tell us what matters to you */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-white flex-shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-primary/70 uppercase tracking-wider">Step 1</span>
              </div>
              <h4 className="text-[15px] font-semibold text-slate-800 mb-1.5">Tell us what matters to you</h4>
              <p className="text-slate-600 text-[13px] leading-relaxed">
                Share your destination, budget, and travel preferences.
              </p>
            </div>

            {/* Step 2 - See your best-fit options */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-4 ring-white flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Step 2</span>
              </div>
              <h4 className="text-[15px] font-semibold text-slate-800 mb-1.5">See your best-fit options</h4>
              <p className="text-slate-600 text-[13px] leading-relaxed">
                We show the strongest match first, with private or traditional bus alternatives when they fit better.
              </p>
            </div>

            {/* Step 3 - Compare with clarity */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 ring-4 ring-white flex-shrink-0">
                  <MapIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">Step 3</span>
              </div>
              <h4 className="text-[15px] font-semibold text-slate-800 mb-1.5">Compare with clarity</h4>
              <p className="text-slate-600 text-[13px] leading-relaxed">
                Review proven tours, pricing, and key details in one place.
              </p>
            </div>

            {/* Step 4 - Book with more confidence */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 ring-4 ring-white flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Step 4</span>
              </div>
              <h4 className="text-[15px] font-semibold text-slate-800 mb-1.5">Book with more confidence</h4>
              <p className="text-slate-600 text-[13px] leading-relaxed">
                Less guesswork, less searching, and a clearer decision.
              </p>
            </div>
          </div>
        </div>

        {/* Operational Trust Block */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6 md:p-8">
          <h3 className="text-lg md:text-xl font-bold text-slate-900 text-center mb-6">
            Why travelers feel more confident here
          </h3>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[14px] text-slate-800 font-semibold mb-1">Fewer wrong turns</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Too many choices can make the wrong one easier to pick. We shortlist tours with proven track records.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <p className="text-[14px] text-slate-800 font-semibold mb-1">More useful detail</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Instead of jumping between listings, reviews, and scattered content, review the details that matter in one place.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Headphones className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[14px] text-slate-800 font-semibold mb-1">Better value, less friction</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  By reducing unnecessary layers, we help you reach better-fit tours with stronger overall value.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
