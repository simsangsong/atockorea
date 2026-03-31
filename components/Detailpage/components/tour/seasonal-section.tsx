'use client'

import { useState } from 'react'

const seasons = [
  {
    id: 'spring',
    name: 'Spring',
    months: 'Mar - May',
    weather: 'Mild and pleasant',
    highlights: 'Canola flowers bloom across the island, creating golden fields. Ideal weather for walking.',
    tip: 'Peak season - book early',
  },
  {
    id: 'summer',
    name: 'Summer',
    months: 'Jun - Aug',
    weather: 'Hot and humid',
    highlights: 'Lush greenery and vibrant beaches. Occasional rain showers provide dramatic skies.',
    tip: 'We adjust timing for midday heat',
  },
  {
    id: 'autumn',
    name: 'Autumn',
    months: 'Sep - Nov',
    weather: 'Cool and clear',
    highlights: 'Silver grass covers the volcanic hills. Crisp air and excellent visibility.',
    tip: 'Our favorite for photography',
  },
  {
    id: 'winter',
    name: 'Winter',
    months: 'Dec - Feb',
    weather: 'Cold with occasional snow',
    highlights: 'Dramatic winter landscapes and fewer crowds. Snow-capped Hallasan creates stunning backdrops.',
    tip: 'Dress warmly for coastal wind',
  },
]

export function SeasonalSection() {
  const [activeSeason, setActiveSeason] = useState('spring')
  const active = seasons.find(s => s.id === activeSeason)

  return (
    <section className="px-5 py-14 md:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-[22px] font-normal text-foreground mb-2 md:text-[26px] tracking-tight">
          Seasonal Variations
        </h2>
        <p className="text-[13px] text-muted-foreground mb-8 tracking-wide">
          Each season brings its own magic to this route
        </p>
        
        {/* Season tabs - refined */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-5 px-5 md:mx-0 md:px-0">
          {seasons.map((season) => (
            <button
              key={season.id}
              onClick={() => setActiveSeason(season.id)}
              className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-200 whitespace-nowrap ${
                activeSeason === season.id
                  ? 'bg-foreground text-background'
                  : 'bg-secondary/60 text-foreground/70 hover:bg-secondary hover:text-foreground'
              }`}
            >
              {season.name}
            </button>
          ))}
        </div>
        
        {/* Active season content - refined */}
        {active && (
          <div className="glass-card rounded-2xl p-7">
            <div className="flex items-baseline justify-between mb-6">
              <h3 className="font-serif text-xl font-normal text-foreground tracking-tight">{active.name}</h3>
              <span className="text-[12px] text-muted-foreground tracking-wide">{active.months}</span>
            </div>
            
            <div className="space-y-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Weather</p>
                <p className="text-[14px] text-foreground">{active.weather}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Experience</p>
                <p className="text-[14px] text-foreground/80 leading-relaxed">{active.highlights}</p>
              </div>
            </div>
            
            <div className="mt-6 pt-5 border-t border-border/40">
              <p className="text-[13px] text-primary font-medium">
                {active.tip}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
