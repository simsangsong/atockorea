'use client'

import { useState } from 'react'
import { 
  Footprints, 
  CloudRain, 
  Users, 
  Camera, 
  Sparkles,
  Sun,
  Heart,
  Mountain,
} from 'lucide-react'

const overviewItems = [
  { 
    icon: Footprints, 
    label: 'Walking Level', 
    value: 'Moderate', 
    detail: 'Mix of paved paths, sand, and gentle trails. Comfortable shoes recommended.',
    rating: 3
  },
  { 
    icon: CloudRain, 
    label: 'Rain Safety', 
    value: 'Medium', 
    detail: 'Some indoor alternatives available. Tour runs in light rain with adjusted stops.',
    rating: 3
  },
  { 
    icon: Users, 
    label: 'Family Fit', 
    value: 'Good', 
    detail: 'Best for ages 6+. Younger children may find some walking tiring.',
    rating: 4
  },
  { 
    icon: Heart, 
    label: 'Senior Fit', 
    value: 'Moderate', 
    detail: 'Manageable for active seniors. Some uneven terrain and optional trails.',
    rating: 3
  },
  { 
    icon: Camera, 
    label: 'Photo Value', 
    value: 'Excellent', 
    detail: 'Multiple iconic viewpoints and golden hour positioning for stunning shots.',
    rating: 5
  },
  { 
    icon: Sparkles, 
    label: 'Scenic Intensity', 
    value: 'High', 
    detail: 'Continuous natural beauty with varied landscapes throughout the day.',
    rating: 5
  },
  { 
    icon: Mountain, 
    label: 'Relaxation Level', 
    value: 'Balanced', 
    detail: 'Active exploration with built-in rest moments and a calm, reflective finish.',
    rating: 4
  },
  { 
    icon: Sun, 
    label: 'Outdoor Balance', 
    value: '80% Outdoor', 
    detail: 'Mostly outdoor with some shaded areas and a calmer indoor finish.',
    rating: 4
  },
]

function RatingDots({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1 mt-2">
      {[1, 2, 3, 4, 5].map((dot) => (
        <div 
          key={dot}
          className={`w-1.5 h-1.5 rounded-full ${
            dot <= rating ? 'bg-primary/60' : 'bg-border'
          }`}
        />
      ))}
    </div>
  )
}

export function OverviewCards() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  return (
    <section className="px-5 py-14 md:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-[22px] font-normal text-foreground mb-2 md:text-[26px] tracking-tight">
          At a Glance
        </h2>
        <p className="text-[13px] text-muted-foreground mb-8 tracking-wide">
          Key attributes to help you decide
        </p>
        
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
          {overviewItems.map((item) => {
            const isExpanded = expandedCard === item.label
            return (
              <button
                key={item.label}
                onClick={() => setExpandedCard(isExpanded ? null : item.label)}
                className={`glass-card rounded-2xl p-4 lg:p-5 text-left transition-all duration-300 hover:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.08)] ${
                  isExpanded ? 'col-span-2 md:col-span-2' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-secondary/80 flex items-center justify-center shrink-0">
                    <item.icon className="h-3.5 w-3.5 text-foreground/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-0.5">{item.label}</p>
                    <p className="text-[14px] font-medium text-foreground">{item.value}</p>
                    <RatingDots rating={item.rating} />
                    {isExpanded && (
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-3 animate-in fade-in duration-200">
                        {item.detail}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        
        <p className="text-[11px] text-muted-foreground/60 text-center mt-6">
          Tap any card for more detail
        </p>
      </div>
    </section>
  )
}
