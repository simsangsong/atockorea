"use client"

import { Route, Camera, Clock, Users, Sparkles } from "lucide-react"

const highlights = [
  {
    icon: Route,
    title: "Efficient Route",
    description: "Optimized path minimizes travel time between highlights"
  },
  {
    icon: Camera,
    title: "Photo Moments",
    description: "Curated stops at the most photogenic viewpoints"
  },
  {
    icon: Clock,
    title: "Flexible Pacing",
    description: "Adjust timing based on your interests and energy"
  },
  {
    icon: Users,
    title: "Private Experience",
    description: "Exclusive tour with your group only"
  }
]

export function HighlightsSection() {
  return (
    <section className="px-5 md:px-8 lg:px-0 py-12 md:py-16">
      <div className="max-w-4xl mx-auto lg:mx-0">
        {/* Section Header - Editorial style */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">Why This Tour</span>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-3">
            A premium Busan experience
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            부산의 핵심 명소를 효율적으로 둘러보는 프리미엄 프라이빗 투어입니다. 
            현지 가이드가 숨겨진 포토스팟과 로컬 맛집까지 안내합니다.
          </p>
        </div>

        {/* Highlights Grid - Glass cards with blue-white gradient */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {highlights.map((item, index) => (
            <div 
              key={index}
              className="group relative p-5 rounded-2xl glass-card hover:scale-[1.02] transition-all duration-300"
            >
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 via-transparent to-accent/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300 border border-accent/10">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
